/**
 * WebSocket Manager - With shapes, text, and room support
 */

import { io, Socket } from 'socket.io-client';
import { Point, Stroke, Shape, TextElement, User, SOCKET_EVENTS } from '../../shared/types';

interface FullStateData {
  strokes: Stroke[];
  shapes?: Shape[];
  textElements?: TextElement[];
}

interface WebSocketCallbacks {
  onConnect: (userId: string, userColor: string) => void;
  onDisconnect: (reason: string) => void;
  onReconnecting: (attempt: number) => void;
  onReconnected: () => void;
  onError: (error: string) => void;
  onUserJoined: (user: User) => void;
  onUserLeft: (userId: string) => void;
  onUsersList: (users: User[], currentUser: User) => void;
  onStrokeStart: (stroke: Stroke) => void;
  onStrokeMove: (strokeId: string, point: Point) => void;
  onStrokeEnd: (strokeId: string) => void;
  onCursorUpdate: (userId: string, point: Point, color: string, name: string) => void;
  onFullState: (data: FullStateData) => void;
  onUndoRedo: (data: FullStateData, action: string) => void;
  onShapeBroadcast: (shape: Shape) => void;
  onTextBroadcast: (text: TextElement) => void;
  onRoomJoined: (roomId: string) => void;
  onRoomError: (error: string) => void;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export class WebSocketManager {
  private socket: Socket | null = null;
  private callbacks: Partial<WebSocketCallbacks> = {};
  private userId: string = '';
  private userColor: string = '';
  private userName: string = '';
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private pendingStrokes: Array<{ type: string; data: any }> = [];
  
  // Latency tracking
  private latency: number = 0;
  private pingInterval: number | null = null;
  private pingStartTime: number = 0;
  private latencyHistory: number[] = [];
  private readonly LATENCY_HISTORY_SIZE = 10;

  constructor() {
    console.log('WebSocketManager created');
  }

  public connect(): void {
    if (this.socket?.connected) {
      console.log('Already connected');
      return;
    }

    this.connectionState = 'connecting';

    // Connect directly to the Socket.io server on port 3000
    const serverUrl = 'http://localhost:3000';
    console.log('Connecting to:', serverUrl);

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      autoConnect: true
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection successful
    this.socket.on('connect', () => {
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      console.log('Connected to server, socket id:', this.socket?.id);
      this.flushPendingStrokes();
      this.startPingInterval();
    });

    // Pong response for latency measurement
    this.socket.on('pong', () => {
      this.latency = Date.now() - this.pingStartTime;
      this.latencyHistory.push(this.latency);
      if (this.latencyHistory.length > this.LATENCY_HISTORY_SIZE) {
        this.latencyHistory.shift();
      }
    });

    // Disconnection
    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.stopPingInterval();
      
      if (reason === 'io server disconnect') {
        this.connectionState = 'disconnected';
      } else {
        this.connectionState = 'reconnecting';
      }
      this.callbacks.onDisconnect?.(reason);
    });

    // Reconnection attempts
    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.reconnectAttempts = attempt;
      this.connectionState = 'reconnecting';
      console.log('Reconnection attempt:', attempt);
      this.callbacks.onReconnecting?.(attempt);
    });

    // Successful reconnection
    this.socket.io.on('reconnect', () => {
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      console.log('Reconnected successfully');
      this.callbacks.onReconnected?.();
    });

    // Reconnection failed
    this.socket.io.on('reconnect_failed', () => {
      this.connectionState = 'error';
      console.error('Reconnection failed after max attempts');
      this.callbacks.onError?.('Connection failed. Please refresh the page.');
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.connectionState = 'error';
        this.callbacks.onError?.('Unable to connect to server');
      }
    });

    // User management - This triggers onConnect callback
    this.socket.on('users:list', (data: { users: User[]; currentUser: User }) => {
      this.userId = data.currentUser.id;
      this.userColor = data.currentUser.color;
      this.userName = data.currentUser.name;
      console.log('Received users list, my id:', this.userId, 'color:', this.userColor);
      this.callbacks.onConnect?.(this.userId, this.userColor);
      this.callbacks.onUsersList?.(data.users, data.currentUser);
    });

    this.socket.on(SOCKET_EVENTS.USER_JOINED, (data: { user: User }) => {
      console.log('User joined:', data.user.name);
      this.callbacks.onUserJoined?.(data.user);
    });

    this.socket.on(SOCKET_EVENTS.USER_LEFT, (data: { userId: string }) => {
      console.log('User left:', data.userId);
      this.callbacks.onUserLeft?.(data.userId);
    });

    // Drawing events
    this.socket.on(SOCKET_EVENTS.STROKE_BROADCAST, (data: { stroke: Stroke }) => {
      if (data.stroke.userId !== this.userId) {
        this.callbacks.onStrokeStart?.(data.stroke);
      }
    });

    this.socket.on(SOCKET_EVENTS.STROKE_MOVE_BROADCAST, (data: {
      strokeId: string;
      userId: string;
      x: number;
      y: number;
    }) => {
      if (data.userId !== this.userId) {
        this.callbacks.onStrokeMove?.(data.strokeId, { x: data.x, y: data.y });
      }
    });

    this.socket.on(SOCKET_EVENTS.STROKE_END_BROADCAST, (data: {
      strokeId: string;
      userId: string;
    }) => {
      if (data.userId !== this.userId) {
        this.callbacks.onStrokeEnd?.(data.strokeId);
      }
    });

    // Cursor updates
    this.socket.on(SOCKET_EVENTS.CURSOR_UPDATE, (data: {
      userId: string;
      x: number;
      y: number;
      color: string;
      name: string;
    }) => {
      if (data.userId !== this.userId) {
        this.callbacks.onCursorUpdate?.(data.userId, { x: data.x, y: data.y }, data.color, data.name);
      }
    });

    // State sync
    this.socket.on(SOCKET_EVENTS.FULL_STATE, (data: FullStateData) => {
      console.log('Received full state:', data.strokes?.length || 0, 'strokes');
      this.callbacks.onFullState?.(data);
    });

    // Undo/Redo
    this.socket.on(SOCKET_EVENTS.UNDO_REDO_BROADCAST, (data: {
      strokes: Stroke[];
      shapes?: Shape[];
      textElements?: TextElement[];
      action: 'undo' | 'redo';
    }) => {
      console.log('Received undo/redo:', data.action);
      this.callbacks.onUndoRedo?.(data, data.action);
    });

    // Shape events
    this.socket.on(SOCKET_EVENTS.SHAPE_BROADCAST, (data: { shape: Shape }) => {
      if (data.shape.userId !== this.userId) {
        this.callbacks.onShapeBroadcast?.(data.shape);
      }
    });

    // Text events
    this.socket.on(SOCKET_EVENTS.TEXT_BROADCAST, (data: { text: TextElement }) => {
      if (data.text.userId !== this.userId) {
        this.callbacks.onTextBroadcast?.(data.text);
      }
    });

    // Room events
    this.socket.on(SOCKET_EVENTS.ROOM_JOINED, (data: { roomId: string }) => {
      console.log('Joined room:', data.roomId);
      this.callbacks.onRoomJoined?.(data.roomId);
    });

    this.socket.on(SOCKET_EVENTS.ROOM_ERROR, (data: { error: string }) => {
      console.error('Room error:', data.error);
      this.callbacks.onRoomError?.(data.error);
    });

    // Server error
    this.socket.on('error', (error: string) => {
      console.error('Server error:', error);
      this.callbacks.onError?.(error);
    });
  }

  // Queue strokes when disconnected
  private queueStroke(type: string, data: any): void {
    if (this.pendingStrokes.length < 100) {
      this.pendingStrokes.push({ type, data });
    }
  }

  private flushPendingStrokes(): void {
    if (this.pendingStrokes.length > 0) {
      console.log('Flushing', this.pendingStrokes.length, 'pending strokes');
      for (const stroke of this.pendingStrokes) {
        this.socket?.emit(stroke.type, stroke.data);
      }
      this.pendingStrokes = [];
    }
  }

  // Emit methods
  public emitStrokeStart(data: {
    strokeId: string;
    x: number;
    y: number;
    color: string;
    width: number;
    tool: 'brush' | 'eraser';
  }): void {
    if (this.connectionState === 'connected') {
      this.socket?.emit(SOCKET_EVENTS.STROKE_START, data);
    } else {
      this.queueStroke(SOCKET_EVENTS.STROKE_START, data);
    }
  }

  public emitStrokeMove(data: { strokeId: string; x: number; y: number }): void {
    if (this.connectionState === 'connected') {
      this.socket?.emit(SOCKET_EVENTS.STROKE_MOVE, data);
    }
  }

  public emitStrokeEnd(data: { strokeId: string }): void {
    if (this.connectionState === 'connected') {
      this.socket?.emit(SOCKET_EVENTS.STROKE_END, data);
    } else {
      this.queueStroke(SOCKET_EVENTS.STROKE_END, data);
    }
  }

  public emitCursorMove(data: { x: number; y: number }): void {
    if (this.connectionState === 'connected') {
      this.socket?.emit(SOCKET_EVENTS.CURSOR_MOVE, data);
    }
  }

  public emitUndo(): void {
    if (this.connectionState === 'connected') {
      this.socket?.emit(SOCKET_EVENTS.UNDO);
    }
  }

  public emitRedo(): void {
    if (this.connectionState === 'connected') {
      this.socket?.emit(SOCKET_EVENTS.REDO);
    }
  }

  public emitShape(shape: Shape): void {
    if (this.connectionState === 'connected') {
      this.socket?.emit(SOCKET_EVENTS.SHAPE_ADD, { shape });
    }
  }

  public emitText(text: TextElement): void {
    if (this.connectionState === 'connected') {
      this.socket?.emit(SOCKET_EVENTS.TEXT_ADD, { text });
    }
  }

  public joinRoom(roomId: string): void {
    if (this.connectionState === 'connected') {
      this.socket?.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId });
    }
  }

  public leaveRoom(): void {
    if (this.connectionState === 'connected') {
      this.socket?.emit(SOCKET_EVENTS.ROOM_LEAVE);
    }
  }

  public requestFullState(): void {
    this.socket?.emit(SOCKET_EVENTS.REQUEST_STATE);
  }

  // Callback registrations
  public onConnect(cb: WebSocketCallbacks['onConnect']): void { this.callbacks.onConnect = cb; }
  public onDisconnect(cb: WebSocketCallbacks['onDisconnect']): void { this.callbacks.onDisconnect = cb; }
  public onReconnecting(cb: WebSocketCallbacks['onReconnecting']): void { this.callbacks.onReconnecting = cb; }
  public onReconnected(cb: WebSocketCallbacks['onReconnected']): void { this.callbacks.onReconnected = cb; }
  public onError(cb: WebSocketCallbacks['onError']): void { this.callbacks.onError = cb; }
  public onUserJoined(cb: WebSocketCallbacks['onUserJoined']): void { this.callbacks.onUserJoined = cb; }
  public onUserLeft(cb: WebSocketCallbacks['onUserLeft']): void { this.callbacks.onUserLeft = cb; }
  public onUsersList(cb: WebSocketCallbacks['onUsersList']): void { this.callbacks.onUsersList = cb; }
  public onStrokeStart(cb: WebSocketCallbacks['onStrokeStart']): void { this.callbacks.onStrokeStart = cb; }
  public onStrokeMove(cb: WebSocketCallbacks['onStrokeMove']): void { this.callbacks.onStrokeMove = cb; }
  public onStrokeEnd(cb: WebSocketCallbacks['onStrokeEnd']): void { this.callbacks.onStrokeEnd = cb; }
  public onCursorUpdate(cb: WebSocketCallbacks['onCursorUpdate']): void { this.callbacks.onCursorUpdate = cb; }
  public onFullState(cb: WebSocketCallbacks['onFullState']): void { this.callbacks.onFullState = cb; }
  public onUndoRedo(cb: WebSocketCallbacks['onUndoRedo']): void { this.callbacks.onUndoRedo = cb; }
  public onShapeBroadcast(cb: WebSocketCallbacks['onShapeBroadcast']): void { this.callbacks.onShapeBroadcast = cb; }
  public onTextBroadcast(cb: WebSocketCallbacks['onTextBroadcast']): void { this.callbacks.onTextBroadcast = cb; }
  public onRoomJoined(cb: WebSocketCallbacks['onRoomJoined']): void { this.callbacks.onRoomJoined = cb; }
  public onRoomError(cb: WebSocketCallbacks['onRoomError']): void { this.callbacks.onRoomError = cb; }

  // Getters
  public getUserId(): string { return this.userId; }
  public getUserColor(): string { return this.userColor; }
  public getUserName(): string { return this.userName; }
  public getConnectionState(): ConnectionState { return this.connectionState; }
  public isConnected(): boolean { return this.connectionState === 'connected'; }
  
  // Latency methods
  public getLatency(): number { return this.latency; }
  
  public getAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0;
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencyHistory.length);
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = window.setInterval(() => {
      if (this.socket?.connected) {
        this.pingStartTime = Date.now();
        this.socket.emit('ping');
      }
    }, 2000); // Ping every 2 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect(): void {
    this.stopPingInterval();
    this.socket?.disconnect();
    this.socket = null;
    this.connectionState = 'disconnected';
  }

  public forceReconnect(): void {
    this.socket?.disconnect();
    setTimeout(() => {
      this.connect();
    }, 500);
  }
}