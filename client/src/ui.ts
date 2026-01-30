/**
 * UI Manager - Toolbar and controls management with shapes and export
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
    this.setupToolbar();
    this.setupKeyboardShortcuts();
    this.setupRoomControls();
    console.log('UIManager initialized with shapes and rooms');
  }

  private setupToolbar(): void {
    // Tool buttons
    const brushBtn = document.getElementById('brush-btn');
    const eraserBtn = document.getElementById('eraser-btn');
    const rectBtn = document.getElementById('rect-btn');
    const circleBtn = document.getElementById('circle-btn');
    const lineBtn = document.getElementById('line-btn');
    const textBtn = document.getElementById('text-btn');

    brushBtn?.addEventListener('click', () => this.selectTool('brush'));
    eraserBtn?.addEventListener('click', () => this.selectTool('eraser'));
    rectBtn?.addEventListener('click', () => this.selectTool('rectangle'));
    circleBtn?.addEventListener('click', () => this.selectTool('circle'));
    lineBtn?.addEventListener('click', () => this.selectTool('line'));
    textBtn?.addEventListener('click', () => this.selectTool('text'));

    // Fill toggle
    const fillToggle = document.getElementById('fill-toggle') as HTMLInputElement;
    fillToggle?.addEventListener('change', () => {
      this.isFilled = fillToggle.checked;
      this.callbacks.onFillChange?.(this.isFilled);
    });

    // Color picker
    const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
    colorPicker?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.currentColor = target.value;
      this.callbacks.onColorChange?.(target.value);
      this.updateColorPresets(target.value);
    });

    // Color presets
    const presets = document.querySelectorAll('.color-preset');
    presets.forEach((preset) => {
      preset.addEventListener('click', () => {
        const color = (preset as HTMLElement).dataset.color || '#000000';
        this.currentColor = color;
        if (colorPicker) colorPicker.value = color;
        this.callbacks.onColorChange?.(color);
        this.updateColorPresets(color);
      });
    });

    // Stroke width
    const strokeSlider = document.getElementById('stroke-width') as HTMLInputElement;
    const strokeValue = document.getElementById('stroke-value');

    strokeSlider?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const width = parseInt(target.value, 10);
      this.currentWidth = width;
      if (strokeValue) strokeValue.textContent = `${width}px`;
      this.callbacks.onStrokeWidthChange?.(width);
    });

    // Undo/Redo buttons
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    undoBtn?.addEventListener('click', () => this.callbacks.onUndo?.());
    redoBtn?.addEventListener('click', () => this.callbacks.onRedo?.());

    // Clear button
    const clearBtn = document.getElementById('clear-btn');
    clearBtn?.addEventListener('click', () => {
      if (confirm('Clear the entire canvas?')) {
        this.callbacks.onClear?.();
      }
    });

    // Export buttons
    const exportPngBtn = document.getElementById('export-png-btn');
    const exportSvgBtn = document.getElementById('export-svg-btn');

    exportPngBtn?.addEventListener('click', () => this.callbacks.onExportPNG?.());
    exportSvgBtn?.addEventListener('click', () => this.callbacks.onExportSVG?.());

    // Set initial active state
    this.updateToolButtons('brush');
    this.updateColorPresets(DEFAULTS.COLOR);
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

      // B - Brush tool
      if (key === 'b') {
        this.selectTool('brush');
        return;
      }

      // E - Eraser tool
      if (key === 'e') {
        this.selectTool('eraser');
        return;
      }

      // R - Rectangle tool
      if (key === 'r') {
        this.selectTool('rectangle');
        return;
      }

      // C - Circle tool
      if (key === 'c') {
        this.selectTool('circle');
        return;
      }

      // L - Line tool
      if (key === 'l') {
        this.selectTool('line');
        return;
      }

      // T - Text tool
      if (key === 't') {
        this.selectTool('text');
        return;
      }

      // F - Toggle fill
      if (key === 'f') {
        const fillToggle = document.getElementById('fill-toggle') as HTMLInputElement;
        if (fillToggle) {
          fillToggle.checked = !fillToggle.checked;
          this.isFilled = fillToggle.checked;
          this.callbacks.onFillChange?.(this.isFilled);
        }
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
    });
  }

  private selectTool(tool: ToolType): void {
    this.currentTool = tool;
    this.updateToolButtons(tool);
    this.callbacks.onToolChange?.(tool);
    console.log('Tool selected:', tool);
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

    // Remove active from all
    Object.values(toolButtons).forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });

    // Add active to current
    const activeId = toolButtons[activeTool];
    if (activeId) {
      document.getElementById(activeId)?.classList.add('active');
    }
  }

  private updateColorPresets(activeColor: string): void {
    const presets = document.querySelectorAll('.color-preset');
    presets.forEach((preset) => {
      const presetColor = (preset as HTMLElement).dataset.color;
      preset.classList.toggle('active', presetColor === activeColor);
    });
  }

  private updateStrokeWidth(width: number): void {
    this.currentWidth = width;
    const slider = document.getElementById('stroke-width') as HTMLInputElement;
    const valueDisplay = document.getElementById('stroke-value');

    if (slider) slider.value = width.toString();
    if (valueDisplay) valueDisplay.textContent = `${width}px`;

    this.callbacks.onStrokeWidthChange?.(width);
  }

  public updateRoomId(roomId: string): void {
    const roomIdEl = document.getElementById('room-id');
    if (roomIdEl) {
      roomIdEl.textContent = roomId;
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