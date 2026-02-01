/**
 * Main Application Entry Point
 * Wires together Canvas, UI, and WebSocket managers
 */

import { CanvasManager } from './canvas';
import { UIManager } from './ui';
import { WebSocketManager, ConnectionState } from './websocket';
import { Point, Stroke, Shape, TextElement, User, DEFAULTS } from '../../shared/types';

interface GhostCursor {
  element: HTMLDivElement;
  lastUpdate: number;
}

// Performance tracking
interface PerformanceStats {
  fps: number;
  frameCount: number;
  lastFpsUpdate: number;
  latency: number;
}

class App {
  private canvas!: CanvasManager;
  private ui!: UIManager;
  private ws!: WebSocketManager;
  private ghostCursors: Map<string, GhostCursor> = new Map();
  private cursorContainer!: HTMLDivElement;
  private usersListElement!: HTMLDivElement;
  private connectionIndicator!: HTMLDivElement;
  private performancePanel!: HTMLDivElement;
  private currentUsers: User[] = [];
  private currentUser: User | null = null;
  private currentRoomId: string = DEFAULTS.ROOM_ID;
  
  // Performance tracking
  private perfStats: PerformanceStats = {
    fps: 0,
    frameCount: 0,
    lastFpsUpdate: performance.now(),
    latency: 0
  };
  private animationFrameId: number = 0;
  private username: string = '';

  constructor() {
    console.log('Initializing App...');
    
    // Show username modal first
    this.setupUsernameModal();
  }

  private setupUsernameModal(): void {
    const modal = document.getElementById('username-modal');
    const input = document.getElementById('username-input') as HTMLInputElement;
    const joinBtn = document.getElementById('join-btn');
    const app = document.getElementById('app');

    if (!modal || !input || !joinBtn || !app) {
      console.error('Modal elements not found');
      return;
    }

    // Check for saved username
    const savedUsername = localStorage.getItem('canvas-username');
    if (savedUsername) {
      input.value = savedUsername;
    }

    // Handle join
    const handleJoin = () => {
      const name = input.value.trim();
      if (name.length < 2) {
        input.style.borderColor = '#ef4444';
        input.focus();
        return;
      }

      this.username = name;
      localStorage.setItem('canvas-username', name);

      // Hide modal, show app
      modal.classList.add('hidden');
      app.classList.remove('hidden');

      // Initialize the app
      this.initializeApp();
    };

    joinBtn.addEventListener('click', handleJoin);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleJoin();
    });

    input.addEventListener('input', () => {
      input.style.borderColor = '#e0e0e0';
    });

    // Focus input
    setTimeout(() => input.focus(), 100);
  }

  private initializeApp(): void {
    this.canvas = new CanvasManager('canvas');
    this.ui = new UIManager();
    this.ws = new WebSocketManager();

    this.createCursorContainer();
    this.createUsersPanel();
    this.createConnectionIndicator();
    this.createPerformancePanel();

    this.setupUICallbacks();
    this.setupCanvasCallbacks();
    this.setupWebSocketCallbacks();

    // Check URL for room ID
    this.checkUrlForRoom();

    // Connect to server with username
    this.ws.connect(this.username);

    // Cleanup old cursors periodically
    setInterval(() => this.cleanupOldCursors(), 5000);
    
    // Start performance monitoring
    this.startPerformanceMonitoring();

    // Handle page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.ws.isConnected()) {
        console.log('Page visible, reconnecting...');
        this.ws.forceReconnect();
      }
    });

    console.log('App initialized successfully');
  }

  private checkUrlForRoom(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) {
      this.currentRoomId = roomId;
      this.ui.updateRoomId(roomId);
    }
  }

  private createCursorContainer(): void {
    this.cursorContainer = document.createElement('div');
    this.cursorContainer.id = 'cursor-container';
    this.cursorContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
    `;
    document.body.appendChild(this.cursorContainer);
  }

  private createUsersPanel(): void {
    this.usersListElement = document.createElement('div');
    this.usersListElement.id = 'users-list';
    this.usersListElement.style.cssText = `
      position: fixed;
      top: 120px;
      right: 10px;
      background: rgba(255, 255, 255, 0.95);
      color: #333;
      padding: 12px;
      border-radius: 8px;
      font-size: 13px;
      z-index: 1001;
      min-width: 140px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      border: 1px solid #e0e0e0;
    `;
    this.usersListElement.innerHTML = `
      <div style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;">
        <span style="width:8px;height:8px;border-radius:50%;background:#FFA500;margin-right:8px;" id="status-dot"></span>
        <span id="users-title">Connecting...</span>
      </div>
      <div id="users-content"></div>
    `;
    document.body.appendChild(this.usersListElement);
  }

  private createConnectionIndicator(): void {
    this.connectionIndicator = document.createElement('div');
    this.connectionIndicator.id = 'connection-indicator';
    this.connectionIndicator.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      font-size: 16px;
      z-index: 2000;
      display: none;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(this.connectionIndicator);
  }

  private createPerformancePanel(): void {
    this.performancePanel = document.createElement('div');
    this.performancePanel.id = 'performance-panel';
    this.performancePanel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-family: 'Consolas', 'Monaco', monospace;
      z-index: 1001;
      min-width: 120px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      user-select: none;
    `;
    this.performancePanel.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="opacity:0.7;">FPS:</span>
          <span id="fps-value" style="font-weight:600;color:#4CAF50;">--</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="opacity:0.7;">Latency:</span>
          <span id="latency-value" style="font-weight:600;color:#2196F3;">-- ms</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="opacity:0.7;">Strokes:</span>
          <span id="strokes-count" style="font-weight:600;color:#FF9800;">0</span>
        </div>
      </div>
    `;
    document.body.appendChild(this.performancePanel);
  }

  private startPerformanceMonitoring(): void {
    const updatePerformance = () => {
      this.perfStats.frameCount++;
      
      const now = performance.now();
      const elapsed = now - this.perfStats.lastFpsUpdate;
      
      // Update FPS every 500ms
      if (elapsed >= 500) {
        this.perfStats.fps = Math.round((this.perfStats.frameCount * 1000) / elapsed);
        this.perfStats.frameCount = 0;
        this.perfStats.lastFpsUpdate = now;
        
        // Update latency from WebSocket manager
        this.perfStats.latency = this.ws.getLatency();
        
        // Update UI
        this.updatePerformanceDisplay();
      }
      
      this.animationFrameId = requestAnimationFrame(updatePerformance);
    };
    
    this.animationFrameId = requestAnimationFrame(updatePerformance);
  }

  private updatePerformanceDisplay(): void {
    const fpsEl = document.getElementById('fps-value');
    const latencyEl = document.getElementById('latency-value');
    const strokesEl = document.getElementById('strokes-count');
    
    if (fpsEl) {
      fpsEl.textContent = this.perfStats.fps.toString();
      // Color code FPS: green (60+), yellow (30-59), red (<30)
      if (this.perfStats.fps >= 55) {
        fpsEl.style.color = '#4CAF50'; // Green
      } else if (this.perfStats.fps >= 30) {
        fpsEl.style.color = '#FF9800'; // Orange
      } else {
        fpsEl.style.color = '#f44336'; // Red
      }
    }
    
    if (latencyEl) {
      const latency = this.ws.getAverageLatency();
      latencyEl.textContent = latency > 0 ? `${latency} ms` : '-- ms';
      // Color code latency: green (<50), yellow (50-150), red (>150)
      if (latency > 0 && latency < 50) {
        latencyEl.style.color = '#4CAF50'; // Green
      } else if (latency >= 50 && latency <= 150) {
        latencyEl.style.color = '#FF9800'; // Orange
      } else if (latency > 150) {
        latencyEl.style.color = '#f44336'; // Red
      }
    }
    
    if (strokesEl) {
      strokesEl.textContent = (this.canvas.getStrokesCount() + this.canvas.getShapesCount()).toString();
    }
  }

  private setupUICallbacks(): void {
    this.ui.onToolChange((tool) => this.canvas.setTool(tool));
    this.ui.onColorChange((color) => this.canvas.setColor(color));
    this.ui.onStrokeWidthChange((width) => this.canvas.setStrokeWidth(width));
    this.ui.onFillChange((filled) => this.canvas.setFilled(filled));
    this.ui.onUndo(() => this.ws.emitUndo());
    this.ui.onRedo(() => this.ws.emitRedo());
    this.ui.onClear(() => this.canvas.clearCanvas());
    
    // Export callbacks
    this.ui.onExportPNG(() => {
      this.canvas.exportToPNG();
      this.showNotification('PNG exported!', 'success');
    });
    
    this.ui.onExportSVG(() => {
      this.canvas.exportToSVG();
      this.showNotification('SVG exported!', 'success');
    });

    // Room callbacks
    this.ui.onJoinRoom((roomId) => {
      this.ws.joinRoom(roomId);
      this.currentRoomId = roomId;
      this.ui.updateRoomId(roomId);
      this.updateUrl(roomId);
      this.showNotification(`Joining room: ${roomId}`, 'info');
    });

    this.ui.onCreateRoom(() => {
      const newRoomId = this.generateRoomId();
      this.ws.joinRoom(newRoomId);
      this.currentRoomId = newRoomId;
      this.ui.updateRoomId(newRoomId);
      this.updateUrl(newRoomId);
      this.showNotification(`Created room: ${newRoomId}`, 'success');
    });

    this.ui.onCopyRoomLink(() => {
      const url = `${window.location.origin}${window.location.pathname}?room=${this.currentRoomId}`;
      navigator.clipboard.writeText(url).then(() => {
        this.showNotification('Room link copied!', 'success');
      }).catch(() => {
        this.showNotification('Failed to copy link', 'error');
      });
    });
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private updateUrl(roomId: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url.toString());
  }

  private setupCanvasCallbacks(): void {
    this.canvas.onStrokeStart((data) => this.ws.emitStrokeStart(data));
    this.canvas.onStrokeMove((data) => this.ws.emitStrokeMove(data));
    this.canvas.onStrokeEnd((data) => this.ws.emitStrokeEnd(data));
    this.canvas.onCursorMove((data) => this.ws.emitCursorMove(data));
    
    // Shape and text callbacks
    this.canvas.onShapeAdd((shape) => this.ws.emitShape(shape));
    this.canvas.onTextAdd((text) => this.ws.emitText(text));
  }

  private setupWebSocketCallbacks(): void {
    this.ws.onConnect((userId, userColor) => {
      console.log('Connected as:', userId, 'with color:', userColor);
      this.updateConnectionUI('connected');
      this.hideConnectionOverlay();
    });

    this.ws.onDisconnect((reason) => {
      console.log('Disconnected:', reason);
      this.updateConnectionUI('disconnected');
      if (reason !== 'io client disconnect') {
        this.showConnectionOverlay('Connection lost. Reconnecting...');
      }
    });

    this.ws.onReconnecting((attempt) => {
      this.updateConnectionUI('reconnecting');
      this.showConnectionOverlay(`Reconnecting... (attempt ${attempt})`);
    });

    this.ws.onReconnected(() => {
      this.updateConnectionUI('connected');
      this.hideConnectionOverlay();
      this.showNotification('Reconnected!', 'success');
      this.ws.requestFullState();
    });

    this.ws.onError((error) => {
      this.updateConnectionUI('error');
      this.showConnectionOverlay(error, true);
    });

    this.ws.onUsersList((users, currentUser) => {
      console.log('Users list received:', users.length, 'users');
      this.currentUsers = users;
      this.currentUser = currentUser;
      this.updateUsersList();
    });

    this.ws.onUserJoined((user) => {
      console.log('User joined:', user.name);
      this.currentUsers.push(user);
      this.updateUsersList();
      this.showNotification(`${user.name} joined`, 'info');
    });

    this.ws.onUserLeft((userId) => {
      console.log('User left:', userId);
      this.currentUsers = this.currentUsers.filter(u => u.id !== userId);
      this.updateUsersList();
      this.removeGhostCursor(userId);
    });

    this.ws.onStrokeStart((stroke) => {
      console.log('Remote stroke start:', stroke.id);
      this.canvas.handleRemoteStrokeStart(stroke);
    });

    this.ws.onStrokeMove((strokeId, point) => {
      this.canvas.handleRemoteStrokeMove(strokeId, point);
    });

    this.ws.onStrokeEnd((strokeId) => {
      console.log('Remote stroke end:', strokeId);
      this.canvas.handleRemoteStrokeEnd(strokeId);
    });

    this.ws.onCursorUpdate((userId, point, color, name) => {
      this.updateGhostCursor(userId, point, color, name);
    });

    this.ws.onFullState((data) => {
      console.log('Full state received:', data.strokes?.length || 0, 'strokes,', data.shapes?.length || 0, 'shapes');
      this.canvas.setFullState(data);
    });

    this.ws.onUndoRedo((data, action) => {
      console.log('Undo/redo received:', action);
      this.canvas.setFullState(data);
      this.showNotification(`${action.charAt(0).toUpperCase() + action.slice(1)} performed`, 'info');
    });

    // Shape and text sync
    this.ws.onShapeBroadcast((shape) => {
      console.log('Remote shape received:', shape.type);
      this.canvas.addRemoteShape(shape);
    });

    this.ws.onTextBroadcast((text) => {
      console.log('Remote text received');
      this.canvas.addRemoteText(text);
    });

    // Room events
    this.ws.onRoomJoined((roomId) => {
      console.log('Joined room:', roomId);
      this.currentRoomId = roomId;
      this.ui.updateRoomId(roomId);
      this.canvas.clearCanvas();
      this.ws.requestFullState();
      this.showNotification(`Joined room: ${roomId}`, 'success');
    });

    this.ws.onRoomError((error) => {
      console.error('Room error:', error);
      this.showNotification(error, 'error');
    });
  }

  // ========================================
  // Connection UI
  // ========================================

  private updateConnectionUI(state: ConnectionState | 'connected' | 'disconnected' | 'reconnecting' | 'error'): void {
    const dot = document.getElementById('status-dot');
    const title = document.getElementById('users-title');

    if (!dot || !title) return;

    switch (state) {
      case 'connected':
        dot.style.background = '#4CAF50';
        title.textContent = `Users Online (${this.currentUsers.length})`;
        break;
      case 'disconnected':
        dot.style.background = '#f44336';
        title.textContent = 'Disconnected';
        break;
      case 'reconnecting':
        dot.style.background = '#FF9800';
        title.textContent = 'Reconnecting...';
        break;
      case 'error':
        dot.style.background = '#f44336';
        title.textContent = 'Connection Error';
        break;
    }
  }

  private showConnectionOverlay(message: string, showRetry: boolean = false): void {
    this.connectionIndicator.innerHTML = `
      <div style="margin-bottom: 10px;">${message}</div>
      ${showRetry ? `
        <button onclick="location.reload()" style="
          background: #4CAF50;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">Refresh Page</button>
      ` : `
        <div style="width: 30px; height: 30px; border: 3px solid #555; border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 10px auto;"></div>
      `}
    `;
    this.connectionIndicator.style.display = 'block';
  }

  private hideConnectionOverlay(): void {
    this.connectionIndicator.style.display = 'none';
  }

  // ========================================
  // Ghost Cursors
  // ========================================

  private updateGhostCursor(userId: string, point: Point, color: string, name: string): void {
    let cursor = this.ghostCursors.get(userId);

    if (!cursor) {
      const element = document.createElement('div');
      element.className = 'ghost-cursor';
      element.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 1000;
        transition: transform 0.05s linear;
        will-change: transform;
      `;
      element.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${color}" style="filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.3));">
          <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35z"/>
        </svg>
        <span style="
          position: absolute;
          left: 18px;
          top: 16px;
          background: ${color};
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          white-space: nowrap;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        ">${name}</span>
      `;

      this.cursorContainer.appendChild(element);
      cursor = { element, lastUpdate: Date.now() };
      this.ghostCursors.set(userId, cursor);
    }

    cursor.element.style.transform = `translate(${point.x}px, ${point.y}px)`;
    cursor.lastUpdate = Date.now();
  }

  private removeGhostCursor(userId: string): void {
    const cursor = this.ghostCursors.get(userId);
    if (cursor) {
      cursor.element.remove();
      this.ghostCursors.delete(userId);
    }
  }

  private cleanupOldCursors(): void {
    const now = Date.now();
    const timeout = 10000;

    for (const [userId, cursor] of this.ghostCursors) {
      if (now - cursor.lastUpdate > timeout) {
        this.removeGhostCursor(userId);
      }
    }
  }

  // ========================================
  // Users List
  // ========================================

  private updateUsersList(): void {
    const contentEl = document.getElementById('users-content');
    const title = document.getElementById('users-title');

    if (!contentEl) return;

    if (title && this.ws.isConnected()) {
      title.textContent = `Users Online (${this.currentUsers.length})`;
    }

    const html = this.currentUsers.map(user => {
      const isMe = this.currentUser && user.id === this.currentUser.id;
      return `
        <div style="display:flex;align-items:center;margin:6px 0;padding:4px;border-radius:4px;${isMe ? 'background:#f0f0f0;' : ''}">
          <div style="width:12px;height:12px;border-radius:50%;background:${user.color};margin-right:8px;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,0.2);"></div>
          <span style="font-size:12px;${isMe ? 'font-weight:600;' : ''}">${user.name}${isMe ? ' (you)' : ''}</span>
        </div>
      `;
    }).join('');

    contentEl.innerHTML = html || '<div style="color:#888;font-size:12px;">No users</div>';
  }

  // ========================================
  // Notifications
  // ========================================

  private showNotification(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons: Record<string, string> = {
      info: '💬',
      success: '✓',
      error: '✕',
      warning: '⚠️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span>${message}</span>
    `;
    
    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize app
let appInstance: App | null = null;

function initApp() {
  if (appInstance) {
    console.log('App already initialized');
    return;
  }
  
  // Wait for modal elements to be ready
  const modal = document.getElementById('username-modal');
  if (modal) {
    appInstance = new App();
  } else {
    console.error('Modal element not found');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}