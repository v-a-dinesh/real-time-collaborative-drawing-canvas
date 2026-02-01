/**
 * UI Manager - Excalidraw-inspired toolbar and controls
 */

import { DEFAULTS, ToolType } from '../../shared/types';

interface UICallbacks {
  onToolChange: (tool: ToolType) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFillChange: (filled: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onJoinRoom: (roomId: string) => void;
  onCreateRoom: () => void;
  onCopyRoomLink: () => void;
}

export class UIManager {
  private callbacks: Partial<UICallbacks> = {};
  private currentTool: ToolType = 'brush';
  private currentColor: string = DEFAULTS.COLOR;
  private currentWidth: number = DEFAULTS.STROKE_WIDTH;
  private isFilled: boolean = false;

  constructor() {
    this.setupFloatingToolbar();
    this.setupPropertiesPanel();
    this.setupMenuDropdown();
    this.setupZoomControls();
    this.setupHelpPanel();
    this.setupRoomControls();
    this.setupKeyboardShortcuts();
    this.hideWatermarkOnDraw();
    console.log('UIManager initialized - Excalidraw-style UI');
  }

  private setupFloatingToolbar(): void {
    // Tool buttons in floating toolbar
    const toolButtons: { id: string; tool: ToolType }[] = [
      { id: 'brush-btn', tool: 'brush' },
      { id: 'eraser-btn', tool: 'eraser' },
      { id: 'rect-btn', tool: 'rectangle' },
      { id: 'circle-btn', tool: 'circle' },
      { id: 'line-btn', tool: 'line' },
      { id: 'text-btn', tool: 'text' }
    ];

    toolButtons.forEach(({ id, tool }) => {
      const btn = document.getElementById(id);
      btn?.addEventListener('click', () => this.selectTool(tool));
    });

    // Arrow button also maps to line
    const arrowBtn = document.getElementById('arrow-btn');
    arrowBtn?.addEventListener('click', () => this.selectTool('line'));

    // Set initial active state
    this.updateToolButtons('brush');
  }

  private setupPropertiesPanel(): void {
    // Color buttons
    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = (btn as HTMLElement).dataset.color;
        if (color) {
          this.currentColor = color;
          this.callbacks.onColorChange?.(color);
          this.updateColorButtons(color);
          
          // Sync with color picker
          const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
          if (colorPicker) colorPicker.value = color;
        }
      });
    });

    // Color picker input
    const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
    colorPicker?.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.currentColor = color;
      this.callbacks.onColorChange?.(color);
      this.updateColorButtons(color);
    });

    // Fill toggle buttons
    const fillBtns = document.querySelectorAll('.fill-btn');
    fillBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const fillType = (btn as HTMLElement).dataset.fill;
        this.isFilled = fillType === 'solid';
        this.callbacks.onFillChange?.(this.isFilled);
        this.updateFillButtons(fillType || 'transparent');
        
        // Sync hidden checkbox
        const fillToggle = document.getElementById('fill-toggle') as HTMLInputElement;
        if (fillToggle) fillToggle.checked = this.isFilled;
      });
    });

    // Stroke width buttons
    const strokeBtns = document.querySelectorAll('.stroke-btn');
    strokeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const width = parseInt((btn as HTMLElement).dataset.width || '5', 10);
        this.currentWidth = width;
        this.callbacks.onStrokeWidthChange?.(width);
        this.updateStrokeButtons(width);
        
        // Sync hidden slider
        const strokeSlider = document.getElementById('stroke-width') as HTMLInputElement;
        if (strokeSlider) strokeSlider.value = width.toString();
      });
    });

    // Set initial states
    this.updateColorButtons(DEFAULTS.COLOR);
    this.updateFillButtons('transparent');
    this.updateStrokeButtons(DEFAULTS.STROKE_WIDTH);
  }

  private setupMenuDropdown(): void {
    const menuToggle = document.getElementById('menu-toggle');
    const menuDropdown = document.getElementById('menu-dropdown');

    // Toggle menu
    menuToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown?.classList.toggle('hidden');
    });

    // Close menu when clicking outside
    document.addEventListener('click', () => {
      menuDropdown?.classList.add('hidden');
    });

    // Prevent closing when clicking inside menu
    menuDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Menu actions
    const exportPngBtn = document.getElementById('menu-export-png');
    const exportSvgBtn = document.getElementById('menu-export-svg');
    const clearBtn = document.getElementById('menu-clear');

    exportPngBtn?.addEventListener('click', () => {
      this.callbacks.onExportPNG?.();
      menuDropdown?.classList.add('hidden');
    });

    exportSvgBtn?.addEventListener('click', () => {
      this.callbacks.onExportSVG?.();
      menuDropdown?.classList.add('hidden');
    });

    clearBtn?.addEventListener('click', () => {
      if (confirm('Reset the entire canvas? This cannot be undone.')) {
        this.callbacks.onClear?.();
      }
      menuDropdown?.classList.add('hidden');
    });
  }

  private setupZoomControls(): void {
    // Undo/Redo buttons
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    undoBtn?.addEventListener('click', () => this.callbacks.onUndo?.());
    redoBtn?.addEventListener('click', () => this.callbacks.onRedo?.());

    // Zoom controls (placeholder for future implementation)
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');

    zoomInBtn?.addEventListener('click', () => {
      console.log('Zoom in (future feature)');
    });

    zoomOutBtn?.addEventListener('click', () => {
      console.log('Zoom out (future feature)');
    });
  }

  private setupHelpPanel(): void {
    const helpBtn = document.getElementById('help-btn');
    const shortcutsPopup = document.getElementById('shortcuts-popup');
    const closeBtn = document.getElementById('close-shortcuts');

    helpBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      shortcutsPopup?.classList.toggle('hidden');
    });

    closeBtn?.addEventListener('click', () => {
      shortcutsPopup?.classList.add('hidden');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!shortcutsPopup?.contains(e.target as Node) && e.target !== helpBtn) {
        shortcutsPopup?.classList.add('hidden');
      }
    });
  }

  private setupRoomControls(): void {
    const joinBtn = document.getElementById('join-room-btn');
    const createBtn = document.getElementById('create-room-btn');
    const copyBtn = document.getElementById('copy-room-btn');
    const roomInput = document.getElementById('room-input') as HTMLInputElement;

    joinBtn?.addEventListener('click', () => {
      const roomId = roomInput?.value.trim();
      if (roomId) {
        this.callbacks.onJoinRoom?.(roomId);
      }
    });

    roomInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const roomId = roomInput.value.trim();
        if (roomId) {
          this.callbacks.onJoinRoom?.(roomId);
        }
      }
    });

    createBtn?.addEventListener('click', () => {
      this.callbacks.onCreateRoom?.();
    });

    copyBtn?.addEventListener('click', () => {
      this.callbacks.onCopyRoomLink?.();
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      const code = e.code;

      // Number keys for tools (1-6)
      if (key === '1') { this.selectTool('brush'); return; }
      if (key === '2') { this.selectTool('rectangle'); return; }
      if (key === '3') { this.selectTool('circle'); return; }
      if (key === '4') { this.selectTool('line'); return; }
      if (key === '5') { this.selectTool('text'); return; }
      if (key === '6' || key === '0') { this.selectTool('eraser'); return; }

      // Letter shortcuts
      if (key === 'b') { this.selectTool('brush'); return; }
      if (key === 'e') { this.selectTool('eraser'); return; }
      if (key === 'r') { this.selectTool('rectangle'); return; }
      if (key === 'c') { this.selectTool('circle'); return; }
      if (key === 'l') { this.selectTool('line'); return; }
      if (key === 't') { this.selectTool('text'); return; }

      // F - Toggle fill
      if (key === 'f') {
        this.isFilled = !this.isFilled;
        this.callbacks.onFillChange?.(this.isFilled);
        this.updateFillButtons(this.isFilled ? 'solid' : 'transparent');
        const fillToggle = document.getElementById('fill-toggle') as HTMLInputElement;
        if (fillToggle) fillToggle.checked = this.isFilled;
        return;
      }

      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.callbacks.onUndo?.();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y - Redo
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.callbacks.onRedo?.();
        return;
      }

      // [ - Decrease stroke width
      if (code === 'BracketLeft' || key === '[') {
        e.preventDefault();
        const newWidth = Math.max(1, this.currentWidth - 2);
        this.updateStrokeWidth(newWidth);
        return;
      }

      // ] - Increase stroke width
      if (code === 'BracketRight' || key === ']') {
        e.preventDefault();
        const newWidth = Math.min(50, this.currentWidth + 2);
        this.updateStrokeWidth(newWidth);
        return;
      }

      // Escape - Close menus
      if (key === 'escape') {
        document.getElementById('menu-dropdown')?.classList.add('hidden');
        document.getElementById('shortcuts-popup')?.classList.add('hidden');
        return;
      }
    });
  }

  private hideWatermarkOnDraw(): void {
    // Hide watermark after first stroke
    const canvas = document.getElementById('canvas');
    let hasDrawn = false;

    canvas?.addEventListener('pointerdown', () => {
      if (!hasDrawn) {
        hasDrawn = true;
        document.querySelector('.canvas-watermark')?.classList.add('hidden');
      }
    });
  }

  private selectTool(tool: ToolType): void {
    this.currentTool = tool;
    this.updateToolButtons(tool);
    this.callbacks.onToolChange?.(tool);

    // Show/hide fill options based on tool
    const fillGroup = document.getElementById('fill-group');
    if (fillGroup) {
      const showFill = ['rectangle', 'circle'].includes(tool);
      fillGroup.style.display = showFill ? 'flex' : 'none';
    }
  }

  private updateToolButtons(activeTool: ToolType): void {
    const toolButtons: Record<ToolType, string> = {
      brush: 'brush-btn',
      eraser: 'eraser-btn',
      rectangle: 'rect-btn',
      circle: 'circle-btn',
      line: 'line-btn',
      text: 'text-btn'
    };

    // Remove active from all toolbar buttons
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Add active to current
    const activeId = toolButtons[activeTool];
    if (activeId) {
      document.getElementById(activeId)?.classList.add('active');
    }

    // Also handle arrow button for line tool
    if (activeTool === 'line') {
      document.getElementById('arrow-btn')?.classList.remove('active');
    }
  }

  private updateColorButtons(activeColor: string): void {
    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach((btn) => {
      const btnColor = (btn as HTMLElement).dataset.color;
      btn.classList.toggle('active', btnColor?.toLowerCase() === activeColor.toLowerCase());
    });
  }

  private updateFillButtons(activeFill: string): void {
    const fillBtns = document.querySelectorAll('.fill-btn');
    fillBtns.forEach((btn) => {
      const btnFill = (btn as HTMLElement).dataset.fill;
      btn.classList.toggle('active', btnFill === activeFill);
    });
  }

  private updateStrokeButtons(activeWidth: number): void {
    const strokeBtns = document.querySelectorAll('.stroke-btn');
    strokeBtns.forEach((btn) => {
      const btnWidth = parseInt((btn as HTMLElement).dataset.width || '0', 10);
      btn.classList.toggle('active', btnWidth === activeWidth);
    });
  }

  private updateStrokeWidth(width: number): void {
    this.currentWidth = width;
    const slider = document.getElementById('stroke-width') as HTMLInputElement;
    if (slider) slider.value = width.toString();
    this.callbacks.onStrokeWidthChange?.(width);
    
    // Find closest button and update (8 options)
    const widths = [1, 2, 4, 8, 12, 20, 32, 50];
    const closest = widths.reduce((a, b) => 
      Math.abs(b - width) < Math.abs(a - width) ? b : a
    );
    this.updateStrokeButtons(closest);
  }

  public updateRoomId(roomId: string): void {
    const roomIdEl = document.getElementById('room-id');
    if (roomIdEl) {
      roomIdEl.textContent = roomId;
    }
  }

  public updateUserCount(count: number): void {
    const countEl = document.getElementById('user-count');
    if (countEl) {
      countEl.textContent = count.toString();
    }
  }

  // Callback setters
  public onToolChange(cb: UICallbacks['onToolChange']): void {
    this.callbacks.onToolChange = cb;
  }

  public onColorChange(cb: UICallbacks['onColorChange']): void {
    this.callbacks.onColorChange = cb;
  }

  public onStrokeWidthChange(cb: UICallbacks['onStrokeWidthChange']): void {
    this.callbacks.onStrokeWidthChange = cb;
  }

  public onFillChange(cb: UICallbacks['onFillChange']): void {
    this.callbacks.onFillChange = cb;
  }

  public onUndo(cb: UICallbacks['onUndo']): void {
    this.callbacks.onUndo = cb;
  }

  public onRedo(cb: UICallbacks['onRedo']): void {
    this.callbacks.onRedo = cb;
  }

  public onClear(cb: UICallbacks['onClear']): void {
    this.callbacks.onClear = cb;
  }

  public onExportPNG(cb: UICallbacks['onExportPNG']): void {
    this.callbacks.onExportPNG = cb;
  }

  public onExportSVG(cb: UICallbacks['onExportSVG']): void {
    this.callbacks.onExportSVG = cb;
  }

  public onJoinRoom(cb: UICallbacks['onJoinRoom']): void {
    this.callbacks.onJoinRoom = cb;
  }

  public onCreateRoom(cb: UICallbacks['onCreateRoom']): void {
    this.callbacks.onCreateRoom = cb;
  }

  public onCopyRoomLink(cb: UICallbacks['onCopyRoomLink']): void {
    this.callbacks.onCopyRoomLink = cb;
  }

  // Getters
  public getCurrentTool(): ToolType {
    return this.currentTool;
  }

  public getCurrentColor(): string {
    return this.currentColor;
  }

  public getCurrentWidth(): number {
    return this.currentWidth;
  }

  public isFillEnabled(): boolean {
    return this.isFilled;
  }
}
