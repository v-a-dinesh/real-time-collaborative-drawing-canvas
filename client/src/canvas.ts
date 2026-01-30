/**
 * Canvas Manager - Core drawing with shapes, text and optimizations
 */

import { Point, Stroke, Shape, TextElement, ToolType, DEFAULTS } from '../../shared/types';

interface DrawingState {
  isDrawing: boolean;
  currentStrokeId: string | null;
  lastPoint: Point | null;
  startPoint: Point | null;
  tool: ToolType;
  color: string;
  strokeWidth: number;
  filled: boolean;
  fontSize: number;
}

interface CanvasCallbacks {
  onStrokeStart: (data: { strokeId: string; x: number; y: number; color: string; width: number; tool: 'brush' | 'eraser' }) => void;
  onStrokeMove: (data: { strokeId: string; x: number; y: number }) => void;
  onStrokeEnd: (data: { strokeId: string }) => void;
  onCursorMove: (data: { x: number; y: number }) => void;
  onShapeAdd: (shape: Shape) => void;
  onTextAdd: (text: TextElement) => void;
}

export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number = 1;

  // Preview canvas for shape drawing
  private previewCanvas: HTMLCanvasElement;
  private previewCtx: CanvasRenderingContext2D;

  private drawingState: DrawingState = {
    isDrawing: false,
    currentStrokeId: null,
    lastPoint: null,
    startPoint: null,
    tool: 'brush',
    color: DEFAULTS.COLOR,
    strokeWidth: DEFAULTS.STROKE_WIDTH,
    filled: false,
    fontSize: DEFAULTS.FONT_SIZE
  };

  private strokes: Stroke[] = [];
  private shapes: Shape[] = [];
  private textElements: TextElement[] = [];
  private localUndoStack: Stroke[] = [];
  private activeRemoteStrokes: Map<string, Stroke> = new Map();
  private callbacks: Partial<CanvasCallbacks> = {};

  private cursorThrottleTimer: number | null = null;
  private readonly CURSOR_THROTTLE_MS = 16;

  // Smoothing for better line quality
  private pointBuffer: Point[] = [];
  private readonly SMOOTHING_FACTOR = 0.3;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas not found: ${canvasId}`);

    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true 
    });
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;

    // Create preview canvas for shapes
    this.previewCanvas = document.createElement('canvas');
    this.previewCanvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 10;
    `;
    const previewCtx = this.previewCanvas.getContext('2d');
    if (!previewCtx) throw new Error('Cannot get preview context');
    this.previewCtx = previewCtx;
    
    // Insert preview canvas after main canvas
    this.canvas.parentElement?.appendChild(this.previewCanvas);

    this.setupCanvas();
    this.setupEventListeners();
    console.log('CanvasManager initialized with shapes and text support');
  }

  private setupCanvas(): void {
    this.dpr = window.devicePixelRatio || 1;
    this.resizeCanvas();
    
    // Debounced resize
    let resizeTimeout: number;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => this.resizeCanvas(), 100);
    });
  }

  private resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    
    // Main canvas
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Preview canvas
    this.previewCanvas.width = rect.width * this.dpr;
    this.previewCanvas.height = rect.height * this.dpr;
    this.previewCanvas.style.width = rect.width + 'px';
    this.previewCanvas.style.height = rect.height + 'px';
    this.previewCtx.scale(this.dpr, this.dpr);
    this.previewCtx.lineCap = 'round';
    this.previewCtx.lineJoin = 'round';

    this.redrawAll();
  }

  private setupEventListeners(): void {
    // Track last mouse position for shape finalization
    let lastMousePoint: Point = { x: 0, y: 0 };

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('mousemove', (e) => {
      lastMousePoint = this.getCanvasPoint(e);
      this.handlePointerMove(e);
    });
    this.canvas.addEventListener('mouseup', () => this.handlePointerUp(lastMousePoint));
    this.canvas.addEventListener('mouseleave', () => this.handlePointerUp(lastMousePoint));

    // Touch events with passive: false for preventDefault
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handlePointerDown(touch);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      lastMousePoint = this.getCanvasPoint(touch);
      this.handlePointerMove(touch);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handlePointerUp(lastMousePoint);
    }, { passive: false });

    // Prevent context menu on canvas
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private getCanvasPoint(e: MouseEvent | Touch): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  private generateStrokeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  // Smooth point using exponential moving average
  private smoothPoint(point: Point): Point {
    if (this.pointBuffer.length === 0) {
      this.pointBuffer.push(point);
      return point;
    }

    const last = this.pointBuffer[this.pointBuffer.length - 1];
    const smoothed = {
      x: last.x + (point.x - last.x) * this.SMOOTHING_FACTOR,
      y: last.y + (point.y - last.y) * this.SMOOTHING_FACTOR
    };

    this.pointBuffer.push(smoothed);
    if (this.pointBuffer.length > 5) {
      this.pointBuffer.shift();
    }

    return smoothed;
  }

  // ========================================
  // Drawing Handlers
  // ========================================

  private handlePointerDown(e: MouseEvent | Touch): void {
    const point = this.getCanvasPoint(e);
    this.pointBuffer = [];
    
    const tool = this.drawingState.tool;
    
    if (tool === 'brush' || tool === 'eraser') {
      this.startStroke(point);
    } else if (tool === 'rectangle' || tool === 'circle' || tool === 'line') {
      this.startShape(point);
    } else if (tool === 'text') {
      this.addTextAtPoint(point);
    }
  }

  private handlePointerMove(e: MouseEvent | Touch): void {
    const rawPoint = this.getCanvasPoint(e);

    // Throttled cursor emit
    if (this.cursorThrottleTimer === null) {
      this.cursorThrottleTimer = window.setTimeout(() => {
        this.callbacks.onCursorMove?.({ x: rawPoint.x, y: rawPoint.y });
        this.cursorThrottleTimer = null;
      }, this.CURSOR_THROTTLE_MS);
    }

    if (this.drawingState.isDrawing) {
      const tool = this.drawingState.tool;
      
      if (tool === 'brush' || tool === 'eraser') {
        const smoothedPoint = this.smoothPoint(rawPoint);
        this.continueStroke(smoothedPoint);
      } else if (tool === 'rectangle' || tool === 'circle' || tool === 'line') {
        this.previewShape(rawPoint);
      }
    }
  }

  private handlePointerUp(endPoint?: Point): void {
    const tool = this.drawingState.tool;
    
    if (tool === 'brush' || tool === 'eraser') {
      this.pointBuffer = [];
      this.endStroke();
    } else if (tool === 'rectangle' || tool === 'circle' || tool === 'line') {
      if (endPoint && this.drawingState.startPoint) {
        this.finalizeShape(endPoint);
      } else {
        this.endShape();
      }
    }
  }

  // ========================================
  // Shape Operations
  // ========================================

  private startShape(point: Point): void {
    this.drawingState.isDrawing = true;
    this.drawingState.startPoint = point;
  }

  private previewShape(endPoint: Point): void {
    if (!this.drawingState.startPoint) return;

    // Clear preview canvas
    this.previewCtx.clearRect(0, 0, this.previewCanvas.width / this.dpr, this.previewCanvas.height / this.dpr);

    const start = this.drawingState.startPoint;
    const tool = this.drawingState.tool;
    const color = this.drawingState.color;
    const width = this.drawingState.strokeWidth;
    const filled = this.drawingState.filled;

    this.previewCtx.strokeStyle = color;
    this.previewCtx.fillStyle = color;
    this.previewCtx.lineWidth = width;
    this.previewCtx.lineCap = 'round';
    this.previewCtx.lineJoin = 'round';

    if (tool === 'rectangle') {
      const w = endPoint.x - start.x;
      const h = endPoint.y - start.y;
      this.previewCtx.beginPath();
      this.previewCtx.rect(start.x, start.y, w, h);
      if (filled) {
        this.previewCtx.fill();
      }
      this.previewCtx.stroke();
    } else if (tool === 'circle') {
      const radiusX = Math.abs(endPoint.x - start.x) / 2;
      const radiusY = Math.abs(endPoint.y - start.y) / 2;
      const centerX = start.x + (endPoint.x - start.x) / 2;
      const centerY = start.y + (endPoint.y - start.y) / 2;
      this.previewCtx.beginPath();
      this.previewCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      if (filled) {
        this.previewCtx.fill();
      }
      this.previewCtx.stroke();
    } else if (tool === 'line') {
      this.previewCtx.beginPath();
      this.previewCtx.moveTo(start.x, start.y);
      this.previewCtx.lineTo(endPoint.x, endPoint.y);
      this.previewCtx.stroke();
    }
  }

  private endShape(): void {
    if (!this.drawingState.isDrawing || !this.drawingState.startPoint) return;

    // Get the last mouse position from preview
    const rect = this.previewCanvas.getBoundingClientRect();
    // We need to capture the end point - use the current pointer position
    // Since we're in mouseup, we'll use the preview canvas state
    
    this.drawingState.isDrawing = false;
    
    // Clear preview
    this.previewCtx.clearRect(0, 0, this.previewCanvas.width / this.dpr, this.previewCanvas.height / this.dpr);
    
    this.drawingState.startPoint = null;
  }

  public finalizeShape(endPoint: Point): void {
    if (!this.drawingState.startPoint) return;

    const shapeId = this.generateStrokeId();
    const tool = this.drawingState.tool as 'rectangle' | 'circle' | 'line';

    const shape: Shape = {
      id: shapeId,
      type: tool,
      startPoint: { ...this.drawingState.startPoint },
      endPoint: { ...endPoint },
      color: this.drawingState.color,
      width: this.drawingState.strokeWidth,
      filled: this.drawingState.filled,
      userId: 'local',
      timestamp: Date.now()
    };

    this.shapes.push(shape);
    this.drawShape(shape);
    
    // Clear preview
    this.previewCtx.clearRect(0, 0, this.previewCanvas.width / this.dpr, this.previewCanvas.height / this.dpr);
    
    this.callbacks.onShapeAdd?.(shape);
    
    this.drawingState.isDrawing = false;
    this.drawingState.startPoint = null;
  }

  private drawShape(shape: Shape): void {
    this.ctx.strokeStyle = shape.color;
    this.ctx.fillStyle = shape.color;
    this.ctx.lineWidth = shape.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    const start = shape.startPoint;
    const end = shape.endPoint;

    if (shape.type === 'rectangle') {
      const w = end.x - start.x;
      const h = end.y - start.y;
      this.ctx.beginPath();
      this.ctx.rect(start.x, start.y, w, h);
      if (shape.filled) {
        this.ctx.fill();
      }
      this.ctx.stroke();
    } else if (shape.type === 'circle') {
      const radiusX = Math.abs(end.x - start.x) / 2;
      const radiusY = Math.abs(end.y - start.y) / 2;
      const centerX = start.x + (end.x - start.x) / 2;
      const centerY = start.y + (end.y - start.y) / 2;
      this.ctx.beginPath();
      this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      if (shape.filled) {
        this.ctx.fill();
      }
      this.ctx.stroke();
    } else if (shape.type === 'line') {
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
    }
  }

  // ========================================
  // Text Operations
  // ========================================

  private addTextAtPoint(point: Point): void {
    const text = prompt('Enter text:');
    if (!text || text.trim() === '') return;

    const textElement: TextElement = {
      id: this.generateStrokeId(),
      position: point,
      text: text.trim(),
      color: this.drawingState.color,
      fontSize: this.drawingState.fontSize,
      userId: 'local',
      timestamp: Date.now()
    };

    this.textElements.push(textElement);
    this.drawText(textElement);
    this.callbacks.onTextAdd?.(textElement);
  }

  private drawText(textElement: TextElement): void {
    this.ctx.font = `${textElement.fontSize}px Arial, sans-serif`;
    this.ctx.fillStyle = textElement.color;
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(textElement.text, textElement.position.x, textElement.position.y);
  }

  public addRemoteText(textElement: TextElement): void {
    this.textElements.push(textElement);
    this.drawText(textElement);
  }

  public addRemoteShape(shape: Shape): void {
    this.shapes.push(shape);
    this.drawShape(shape);
  }

  // ========================================
  // Stroke Operations
  // ========================================

  private startStroke(point: Point): void {
    const strokeId = this.generateStrokeId();
    const color = this.drawingState.tool === 'eraser' ? '#FFFFFF' : this.drawingState.color;

    this.drawingState.isDrawing = true;
    this.drawingState.currentStrokeId = strokeId;
    this.drawingState.lastPoint = point;

    const tool = this.drawingState.tool as 'brush' | 'eraser';
    const stroke: Stroke = {
      id: strokeId,
      points: [point],
      color: color,
      width: this.drawingState.strokeWidth,
      tool: tool,
      userId: 'local',
      timestamp: Date.now()
    };

    this.strokes.push(stroke);

    // Draw initial dot
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, this.drawingState.strokeWidth / 2, 0, Math.PI * 2);
    this.ctx.fill();

    this.callbacks.onStrokeStart?.({
      strokeId,
      x: point.x,
      y: point.y,
      color: color,
      width: this.drawingState.strokeWidth,
      tool: tool
    });
  }

  private continueStroke(point: Point): void {
    if (!this.drawingState.isDrawing || !this.drawingState.currentStrokeId) return;

    const lastPoint = this.drawingState.lastPoint;
    if (!lastPoint) return;

    // Skip if points are too close
    const dist = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    if (dist < 1) return;

    const stroke = this.strokes.find(s => s.id === this.drawingState.currentStrokeId);
    if (stroke) {
      stroke.points.push(point);
    }

    const color = this.drawingState.tool === 'eraser' ? '#FFFFFF' : this.drawingState.color;
    
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = this.drawingState.strokeWidth;
    this.ctx.moveTo(lastPoint.x, lastPoint.y);
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();

    this.drawingState.lastPoint = point;

    this.callbacks.onStrokeMove?.({
      strokeId: this.drawingState.currentStrokeId,
      x: point.x,
      y: point.y
    });
  }

  private endStroke(): void {
    if (!this.drawingState.isDrawing) return;

    const strokeId = this.drawingState.currentStrokeId;

    this.drawingState.isDrawing = false;
    this.drawingState.currentStrokeId = null;
    this.drawingState.lastPoint = null;
    this.localUndoStack = [];

    if (strokeId) {
      this.callbacks.onStrokeEnd?.({ strokeId });
    }
  }

  // ========================================
  // Remote Stroke Handling
  // ========================================

  public handleRemoteStrokeStart(stroke: Stroke): void {
    this.activeRemoteStrokes.set(stroke.id, { ...stroke, points: [...stroke.points] });

    const point = stroke.points[0];
    if (point) {
      this.ctx.fillStyle = stroke.color;
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  public handleRemoteStrokeMove(strokeId: string, point: Point): void {
    const stroke = this.activeRemoteStrokes.get(strokeId);
    if (!stroke || stroke.points.length === 0) return;

    const lastPoint = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);

    this.ctx.beginPath();
    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.moveTo(lastPoint.x, lastPoint.y);
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();
  }

  public handleRemoteStrokeEnd(strokeId: string): void {
    const stroke = this.activeRemoteStrokes.get(strokeId);
    if (stroke) {
      this.strokes.push(stroke);
      this.activeRemoteStrokes.delete(strokeId);
    }
  }

  // ========================================
  // State Management
  // ========================================

  public setFullState(data: { strokes: Stroke[]; shapes?: Shape[]; textElements?: TextElement[] }): void {
    this.strokes = data.strokes.map(s => ({ ...s, points: [...s.points] }));
    this.shapes = (data.shapes || []).map(s => ({ ...s }));
    this.textElements = (data.textElements || []).map(t => ({ ...t }));
    this.redrawAll();
  }

  public redrawAll(): void {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

    // Draw strokes
    for (const stroke of this.strokes) {
      this.drawStroke(stroke);
    }

    for (const stroke of this.activeRemoteStrokes.values()) {
      this.drawStroke(stroke);
    }

    // Draw shapes
    for (const shape of this.shapes) {
      this.drawShape(shape);
    }

    // Draw text elements
    for (const text of this.textElements) {
      this.drawText(text);
    }
  }

  private drawStroke(stroke: Stroke): void {
    if (stroke.points.length === 0) return;

    this.ctx.strokeStyle = stroke.color;
    this.ctx.fillStyle = stroke.color;
    this.ctx.lineWidth = stroke.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.ctx.beginPath();
      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      this.ctx.stroke();
    }
  }

  // ========================================
  // Tool Settings
  // ========================================

  public setTool(tool: ToolType): void {
    this.drawingState.tool = tool;
    
    const cursorMap: Record<ToolType, string> = {
      brush: 'crosshair',
      eraser: 'cell',
      rectangle: 'crosshair',
      circle: 'crosshair',
      line: 'crosshair',
      text: 'text'
    };
    
    this.canvas.style.cursor = cursorMap[tool] || 'crosshair';
  }

  public setColor(color: string): void {
    this.drawingState.color = color;
  }

  public setStrokeWidth(width: number): void {
    this.drawingState.strokeWidth = Math.max(1, Math.min(50, width));
  }

  public setFilled(filled: boolean): void {
    this.drawingState.filled = filled;
  }

  public setFontSize(size: number): void {
    this.drawingState.fontSize = Math.max(8, Math.min(72, size));
  }

  public getStrokeWidth(): number { return this.drawingState.strokeWidth; }
  public getTool(): ToolType { return this.drawingState.tool; }
  public getColor(): string { return this.drawingState.color; }
  public isFilled(): boolean { return this.drawingState.filled; }
  public getFontSize(): number { return this.drawingState.fontSize; }

  // ========================================
  // Callbacks
  // ========================================

  public onStrokeStart(cb: CanvasCallbacks['onStrokeStart']): void { this.callbacks.onStrokeStart = cb; }
  public onStrokeMove(cb: CanvasCallbacks['onStrokeMove']): void { this.callbacks.onStrokeMove = cb; }
  public onStrokeEnd(cb: CanvasCallbacks['onStrokeEnd']): void { this.callbacks.onStrokeEnd = cb; }
  public onCursorMove(cb: CanvasCallbacks['onCursorMove']): void { this.callbacks.onCursorMove = cb; }
  public onShapeAdd(cb: CanvasCallbacks['onShapeAdd']): void { this.callbacks.onShapeAdd = cb; }
  public onTextAdd(cb: CanvasCallbacks['onTextAdd']): void { this.callbacks.onTextAdd = cb; }

  public clearCanvas(): void {
    this.strokes = [];
    this.shapes = [];
    this.textElements = [];
    this.localUndoStack = [];
    this.activeRemoteStrokes.clear();
    this.redrawAll();
  }

  public getStrokesCount(): number {
    return this.strokes.length;
  }

  public getShapesCount(): number {
    return this.shapes.length;
  }

  // ========================================
  // Export Functionality
  // ========================================

  public exportToPNG(): void {
    const link = document.createElement('a');
    link.download = `canvas-${Date.now()}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  public exportToSVG(): void {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
    svg += `<rect width="100%" height="100%" fill="white"/>`;

    // Export strokes
    for (const stroke of this.strokes) {
      if (stroke.points.length === 0) continue;
      
      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        svg += `<circle cx="${p.x}" cy="${p.y}" r="${stroke.width / 2}" fill="${stroke.color}"/>`;
      } else {
        const path = stroke.points.map((p, i) => 
          (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)
        ).join(' ');
        svg += `<path d="${path}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }

    // Export shapes
    for (const shape of this.shapes) {
      const { startPoint: s, endPoint: e, color, width, filled } = shape;
      const fillAttr = filled ? `fill="${color}"` : 'fill="none"';
      
      if (shape.type === 'rectangle') {
        const x = Math.min(s.x, e.x);
        const y = Math.min(s.y, e.y);
        const w = Math.abs(e.x - s.x);
        const h = Math.abs(e.y - s.y);
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${color}" stroke-width="${width}" ${fillAttr}/>`;
      } else if (shape.type === 'circle') {
        const cx = (s.x + e.x) / 2;
        const cy = (s.y + e.y) / 2;
        const rx = Math.abs(e.x - s.x) / 2;
        const ry = Math.abs(e.y - s.y) / 2;
        svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${color}" stroke-width="${width}" ${fillAttr}/>`;
      } else if (shape.type === 'line') {
        svg += `<line x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
      }
    }

    // Export text
    for (const text of this.textElements) {
      svg += `<text x="${text.position.x}" y="${text.position.y}" fill="${text.color}" font-size="${text.fontSize}" font-family="Arial, sans-serif">${this.escapeXml(text.text)}</text>`;
    }

    svg += '</svg>';

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `canvas-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}