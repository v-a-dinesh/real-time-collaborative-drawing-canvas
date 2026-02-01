# 🏗️ Architecture Documentation

## Flamdraw - Real-Time Collaborative Drawing Canvas

<div align="center">

**Technical Architecture, Design Decisions, and Implementation Details**

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-Flamdraw-4CAF50)](https://real-time-collaborative-drawing-canvas-rqd8.onrender.com/)
[![README](https://img.shields.io/badge/📖%20README-Documentation-blue)](README.md)

</div>

---

## 📋 Table of Contents

1. [System Overview](#-system-overview)
2. [Data Flow Diagrams](#-data-flow-diagrams)
3. [WebSocket Protocol](#-websocket-protocol)
4. [Core Modules](#-core-modules)
5. [Undo/Redo Strategy](#-undoredo-strategy)
6. [Room Architecture](#-room-architecture)
7. [Performance Optimizations](#-performance-optimizations)
8. [Input Validation & Security](#-input-validation--security)
9. [Conflict Resolution](#-conflict-resolution)
10. [Scalability Considerations](#-scalability-considerations)
11. [File Structure](#-file-structure)
12. [Testing Guide](#-testing-guide)

---

## 📊 System Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                                      │
│                                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────────┐ │
│  │      main.ts       │  │       ui.ts        │  │        canvas.ts           │ │
│  │   (Orchestrator)   │  │    (Toolbar UI)    │  │    (Drawing Engine)        │ │
│  │                    │  │                    │  │                            │ │
│  │ • Initialization   │  │ • Tool selection   │  │ • Raw Canvas API           │ │
│  │ • Event binding    │  │ • Color/stroke     │  │ • DPR scaling              │ │
│  │ • State management │  │ • Menu dropdown    │  │ • Point smoothing          │ │
│  │ • Export functions │  │ • Help panel       │  │ • Shape rendering          │ │
│  └─────────┬──────────┘  └─────────┬──────────┘  └─────────────┬──────────────┘ │
│            │                       │                           │                 │
│            └───────────────────────┴───────────────────────────┘                 │
│                                    │                                             │
│                           ┌────────▼────────┐                                    │
│                           │  websocket.ts   │                                    │
│                           │  (Socket.io)    │                                    │
│                           │                 │                                    │
│                           │ • Connection    │                                    │
│                           │ • Reconnection  │                                    │
│                           │ • Event emit    │                                    │
│                           │ • State sync    │                                    │
│                           └────────┬────────┘                                    │
└────────────────────────────────────┼────────────────────────────────────────────┘
                                     │
                                     │ WebSocket (Socket.io)
                                     │ Bidirectional Real-Time Communication
                                     │
┌────────────────────────────────────▼────────────────────────────────────────────┐
│                              SERVER (Node.js)                                    │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         production.ts / server.ts                         │   │
│  │                                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────────────┐ │   │
│  │  │  Room Manager   │  │  State Manager  │  │    Socket.io Handler      │ │   │
│  │  │                 │  │                 │  │                           │ │   │
│  │  │ • Room creation │  │ • Strokes[]     │  │ • Event routing           │ │   │
│  │  │ • User tracking │  │ • Shapes[]      │  │ • Broadcasting            │ │   │
│  │  │ • Room cleanup  │  │ • TextElements[]│  │ • Validation              │ │   │
│  │  │ • Isolation     │  │ • Undo/Redo     │  │ • Error handling          │ │   │
│  │  └─────────────────┘  └─────────────────┘  └───────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────┐                                                           │
│  │  Express Server  │  GET /         → Landing page                             │
│  │                  │  GET /canvas   → Canvas app                               │
│  │                  │  GET /health   → Health check                             │
│  └──────────────────┘                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| **Presentation** | HTML5 Canvas, CSS3 | Rendering, UI |
| **Client Logic** | TypeScript | Drawing, events, state |
| **Communication** | Socket.io | Real-time sync |
| **Server** | Node.js + Express | HTTP + WebSocket |
| **Deployment** | Docker + Render | Containerization |

---

## 📡 Data Flow Diagrams

### 1. Drawing Flow (User A draws → User B sees)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User A    │     │   Client A  │     │   Server    │     │   Client B  │
│ (Drawing)   │     │ (Canvas)    │     │ (Node.js)   │     │ (Canvas)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ mousedown         │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ stroke:start      │                   │
       │                   │ {strokeId, point, │                   │
       │                   │  color, width}    │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │ Validate input    │
       │                   │                   │ Create stroke     │
       │                   │                   │ Store in room     │
       │                   │                   │                   │
       │                   │                   │ stroke:broadcast  │
       │                   │                   │──────────────────>│
       │                   │                   │                   │
       │                   │                   │                   │ Render stroke
       │                   │                   │                   │ on canvas
       │                   │                   │                   │
       │ mousemove (x N)   │                   │                   │
       │──────────────────>│ stroke:move       │                   │
       │                   │ {strokeId, point} │                   │
       │                   │──────────────────>│ stroke:move:      │
       │                   │                   │ broadcast         │
       │                   │                   │──────────────────>│
       │                   │                   │                   │ Add point
       │                   │                   │                   │
       │ mouseup           │                   │                   │
       │──────────────────>│ stroke:end        │                   │
       │                   │ {strokeId}        │                   │
       │                   │──────────────────>│                   │
       │                   │                   │ Finalize stroke   │
       │                   │                   │ Add to history    │
       │                   │                   │                   │
       │                   │                   │ stroke:end:       │
       │                   │                   │ broadcast         │
       │                   │                   │──────────────────>│
       │                   │                   │                   │ Finalize
       ▼                   ▼                   ▼                   ▼
```

### 2. State Synchronization (New User Joins)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  New User   │     │   Server    │     │Existing User│
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ connect()         │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ Assign user ID    │
       │                   │ Add to room       │
       │                   │                   │
       │ users:list        │                   │
       │<──────────────────│                   │
       │ {users[],         │                   │
       │  currentUser}     │                   │
       │                   │                   │
       │ state:full        │                   │
       │<──────────────────│                   │
       │ {strokes[],       │                   │
       │  shapes[],        │                   │
       │  textElements[]}  │                   │
       │                   │                   │
       │ Render all        │                   │
       │ elements          │                   │
       │                   │                   │
       │                   │ user:joined       │
       │                   │──────────────────>│
       │                   │ {user: User}      │
       │                   │                   │ Update users
       │                   │                   │ list
       ▼                   ▼                   ▼
```

### 3. Global Undo Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User A    │     │   User B    │     │   Server    │     │  All Users  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ Draw stroke       │                   │                   │
       │───────────────────────────────────────>                   │
       │                   │                   │ Store stroke      │
       │                   │                   │ (timestamp: T1)   │
       │                   │                   │                   │
       │                   │ Draw shape        │                   │
       │                   │──────────────────>│                   │
       │                   │                   │ Store shape       │
       │                   │                   │ (timestamp: T2)   │
       │                   │                   │                   │
       │ Press Ctrl+Z      │                   │                   │
       │───────────────────────────────────────>                   │
       │                   │                   │                   │
       │                   │                   │ Find latest by    │
       │                   │                   │ timestamp (T2)    │
       │                   │                   │                   │
       │                   │                   │ Remove shape      │
       │                   │                   │ Push to redoStack │
       │                   │                   │                   │
       │                   │                   │ undo:redo:        │
       │                   │                   │ broadcast         │
       │                   │                   │──────────────────>│
       │                   │                   │                   │
       │                   │                   │                   │ Redraw all
       │                   │                   │                   │ (shape gone)
       ▼                   ▼                   ▼                   ▼
```

---

## 📨 WebSocket Protocol

### Event Reference

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `stroke:start` | `StrokeStartPayload` | Begin a new freehand stroke |
| `stroke:move` | `StrokeMovePayload` | Add point to current stroke |
| `stroke:end` | `StrokeEndPayload` | Finalize the stroke |
| `shape:add` | `ShapePayload` | Add a completed shape |
| `text:add` | `TextPayload` | Add a text element |
| `cursor:move` | `CursorPayload` | Update cursor position |
| `undo` | - | Request global undo |
| `redo` | - | Request global redo |
| `room:join` | `RoomJoinPayload` | Join a specific room |
| `room:create` | - | Create a new room |
| `state:request` | - | Request full canvas state |

#### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `stroke:broadcast` | `Stroke` | Broadcast new stroke to room |
| `stroke:move:broadcast` | `StrokeMoveData` | Broadcast stroke point |
| `stroke:end:broadcast` | `StrokeEndData` | Broadcast stroke completion |
| `shape:broadcast` | `Shape` | Broadcast new shape |
| `text:broadcast` | `TextElement` | Broadcast new text |
| `cursor:update` | `CursorData` | Broadcast cursor position |
| `state:full` | `CanvasState` | Send full canvas state |
| `users:list` | `UsersListData` | Send all users in room |
| `user:joined` | `User` | Notify user joined |
| `user:left` | `{userId}` | Notify user left |
| `undo:redo:broadcast` | `CanvasState` | Broadcast state after undo/redo |
| `room:joined` | `{roomId}` | Confirm room join |

### Payload Schemas

```typescript
// Stroke Start
interface StrokeStartPayload {
  strokeId: string;      // Unique ID (timestamp + random)
  x: number;             // Canvas X coordinate
  y: number;             // Canvas Y coordinate
  color: string;         // Hex color (#RRGGBB)
  width: number;         // Stroke width (1-50)
  tool: 'brush' | 'eraser';
}

// Stroke Object (Server Storage)
interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: 'brush' | 'eraser';
  userId: string;
  timestamp: number;
}

// Shape Object
interface Shape {
  id: string;
  type: 'rectangle' | 'circle' | 'line';
  startPoint: Point;
  endPoint: Point;
  color: string;
  width: number;
  filled: boolean;
  userId: string;
  timestamp: number;
}

// Text Element
interface TextElement {
  id: string;
  text: string;
  position: Point;
  fontSize: number;
  color: string;
  userId: string;
  timestamp: number;
}

// Full Canvas State
interface CanvasState {
  strokes: Stroke[];
  shapes: Shape[];
  textElements: TextElement[];
}
```

---

## 🧩 Core Modules

### 1. main.ts - Application Orchestrator

**Responsibility:** Initialize the application, bind events, coordinate modules.

```typescript
// Key Functions
export class App {
  constructor() {
    this.canvas = new CanvasManager();
    this.websocket = new WebSocketClient();
    this.ui = new UIManager();
  }

  async initialize() {
    // 1. Setup canvas with DPR scaling
    // 2. Connect to WebSocket server
    // 3. Bind tool callbacks
    // 4. Setup keyboard shortcuts
    // 5. Handle window resize
  }

  // Export functions
  exportToPNG(): void;
  exportToSVG(): void;
  clearCanvas(): void;
}
```

### 2. canvas.ts - Drawing Engine

**Responsibility:** All canvas rendering using raw HTML5 Canvas API.

```typescript
export class CanvasManager {
  private ctx: CanvasRenderingContext2D;
  private dpr: number;  // Device Pixel Ratio

  // Core rendering
  drawStroke(stroke: Stroke): void;
  drawShape(shape: Shape): void;
  drawText(text: TextElement): void;
  drawGhostCursor(cursor: CursorData): void;

  // State management
  redrawAll(state: CanvasState): void;
  clear(): void;

  // Event handling
  handlePointerDown(e: PointerEvent): void;
  handlePointerMove(e: PointerEvent): void;
  handlePointerUp(e: PointerEvent): void;
}
```

**Key Implementation Details:**
- Uses `devicePixelRatio` for crisp rendering on retina displays
- `lineCap: 'round'` and `lineJoin: 'round'` for smooth strokes
- Point smoothing with exponential moving average
- Incremental drawing (only new points, not full redraw)

### 3. websocket.ts - Socket.io Client

**Responsibility:** Handle all WebSocket communication.

```typescript
export class WebSocketClient {
  private socket: Socket;
  private connectionState: ConnectionState;
  private offlineQueue: QueuedAction[];

  connect(): Promise<void>;
  disconnect(): void;

  // Emit events
  emitStrokeStart(data: StrokeStartPayload): void;
  emitStrokeMove(data: StrokeMovePayload): void;
  emitUndo(): void;
  emitRedo(): void;

  // Connection management
  private handleReconnection(): void;
  private flushOfflineQueue(): void;
}
```

**Connection States:**
```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}
```

### 4. ui.ts - User Interface Manager

**Responsibility:** Handle toolbar, menu, and UI interactions.

```typescript
export class UIManager {
  setupFloatingToolbar(): void;
  setupPropertiesPanel(): void;
  setupMenuDropdown(): void;
  setupHelpPanel(): void;
  setupKeyboardShortcuts(): void;

  // State updates
  setActiveTool(tool: Tool): void;
  setActiveColor(color: string): void;
  setStrokeWidth(width: number): void;
  updateUsersList(users: User[]): void;
}
```

---

## 🔄 Undo/Redo Strategy

### The Challenge

Implementing global undo/redo in a real-time collaborative environment is complex because:

1. **Multiple users drawing simultaneously** - Who "owns" the undo?
2. **Cross-user undo** - User A should be able to undo User B's last action
3. **Consistency** - All clients must converge to the same state

### Our Solution: Timestamp-Based Global Stack

We use a **single source of truth** on the server with **timestamp ordering**.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER STATE (Per Room)                       │
│                                                                  │
│  strokes: [                                                      │
│    {id: "s1", timestamp: 1000, userId: "A", points: [...]},     │
│    {id: "s2", timestamp: 1500, userId: "B", points: [...]},     │
│    {id: "s3", timestamp: 2000, userId: "A", points: [...]},     │
│  ]                                                               │
│                                                                  │
│  shapes: [                                                       │
│    {id: "sh1", timestamp: 1200, type: "rectangle", ...},        │
│  ]                                                               │
│                                                                  │
│  textElements: [                                                 │
│    {id: "t1", timestamp: 1800, text: "Hello", ...},             │
│  ]                                                               │
│                                                                  │
│  redoStack: [                                                    │
│    [items removed from last undo],                               │
│  ]                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Undo Algorithm

```typescript
function handleUndo(roomId: string): void {
  const room = rooms.get(roomId);

  // 1. Find the most recent item across ALL types
  const lastStroke = room.strokes[room.strokes.length - 1];
  const lastShape = room.shapes[room.shapes.length - 1];
  const lastText = room.textElements[room.textElements.length - 1];

  // 2. Compare timestamps to find the truly last action
  const timestamps = [
    lastStroke?.timestamp || 0,
    lastShape?.timestamp || 0,
    lastText?.timestamp || 0
  ];
  const maxTimestamp = Math.max(...timestamps);

  // 3. Remove the most recent item from appropriate array
  let removed;
  if (lastStroke?.timestamp === maxTimestamp) {
    removed = room.strokes.pop();
  } else if (lastShape?.timestamp === maxTimestamp) {
    removed = room.shapes.pop();
  } else if (lastText?.timestamp === maxTimestamp) {
    removed = room.textElements.pop();
  }

  // 4. Push to redo stack for potential redo
  if (removed) {
    room.redoStack.push([removed]);
  }

  // 5. Broadcast FULL state to ALL clients in room
  io.to(roomId).emit('undo:redo:broadcast', {
    strokes: room.strokes,
    shapes: room.shapes,
    textElements: room.textElements,
    action: 'undo'
  });
}
```

### Redo Algorithm

```typescript
function handleRedo(roomId: string): void {
  const room = rooms.get(roomId);

  // 1. Pop from redo stack
  const toRestore = room.redoStack.pop();
  if (!toRestore) return;

  // 2. Re-add items to appropriate arrays
  for (const item of toRestore) {
    if ('points' in item) {
      room.strokes.push(item);
    } else if ('type' in item && ['rectangle', 'circle', 'line'].includes(item.type)) {
      room.shapes.push(item);
    } else if ('text' in item) {
      room.textElements.push(item);
    }
  }

  // 3. Broadcast full state
  io.to(roomId).emit('undo:redo:broadcast', {
    strokes: room.strokes,
    shapes: room.shapes,
    textElements: room.textElements,
    action: 'redo'
  });
}
```

### Why This Works

| Principle | Implementation |
|-----------|----------------|
| **Single Source of Truth** | Server maintains authoritative state |
| **Timestamp Ordering** | Actions ordered by when they occurred, not by user |
| **Full State Broadcast** | All clients receive complete state after undo/redo |
| **Cross-User Undo** | Any user can undo any action (most recent by timestamp) |

### Trade-offs Analysis

| Approach | Pros | Cons | Our Choice |
|----------|------|------|------------|
| **Full State Broadcast** | Simple, always consistent | More bandwidth | ✅ Selected |
| **Operational Transform** | Less bandwidth | Very complex | ❌ |
| **CRDT** | Eventually consistent | Extremely complex | ❌ |

For a real-time collaborative canvas with < 100 users per room, full state broadcast is the pragmatic choice.

---

## 🏠 Room Architecture

### Data Structure

```typescript
interface RoomState {
  strokes: Stroke[];
  shapes: Shape[];
  textElements: TextElement[];
  redoStack: (Stroke | Shape | TextElement)[][];
  users: Map<string, User>;
  activeStrokes: Map<string, Stroke>;  // In-progress strokes
}

// Server state
const rooms: Map<string, RoomState> = new Map();
const userRooms: Map<string, string> = new Map();  // socketId → roomId
```

### Room Lifecycle

```
┌──────────────┐
│   Creation   │
│              │
│ First user   │
│ joins room   │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│   Active     │────>│  User Joins  │
│              │     │              │
│ Users drawing│     │ Send state   │
│ & collaborat.│<────│ Broadcast    │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│  User Leaves │
│              │
│ Remove user  │
│ Broadcast    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Cleanup    │
│              │
│ If room empty│
│ (not default)│
│ Delete room  │
└──────────────┘
```

### Room Isolation

Each room maintains completely independent state:

```typescript
socket.on('stroke:start', (data) => {
  const roomId = userRooms.get(socket.id);
  const room = rooms.get(roomId);

  // All operations scoped to room
  room.strokes.push(newStroke);

  // Broadcast only to users in same room
  socket.to(roomId).emit('stroke:broadcast', { stroke: newStroke });
});
```

---

## ⚡ Performance Optimizations

### 1. Cursor Throttling (60 FPS)

```typescript
private cursorThrottleTimer: number | null = null;
private readonly CURSOR_THROTTLE_MS = 16;  // ~60 FPS

handleCursorMove(x: number, y: number): void {
  if (this.cursorThrottleTimer === null) {
    this.cursorThrottleTimer = window.setTimeout(() => {
      this.socket.emit('cursor:move', { x, y });
      this.cursorThrottleTimer = null;
    }, this.CURSOR_THROTTLE_MS);
  }
}
```

### 2. Point Smoothing (Exponential Moving Average)

```typescript
private smoothPoint(point: Point, lastPoint: Point): Point {
  const smoothingFactor = 0.3;
  return {
    x: lastPoint.x + (point.x - lastPoint.x) * smoothingFactor,
    y: lastPoint.y + (point.y - lastPoint.y) * smoothingFactor
  };
}
```

### 3. Device Pixel Ratio Scaling

```typescript
setupCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = this.canvas.getBoundingClientRect();

  this.canvas.width = rect.width * dpr;
  this.canvas.height = rect.height * dpr;

  this.ctx.scale(dpr, dpr);
  this.canvas.style.width = `${rect.width}px`;
  this.canvas.style.height = `${rect.height}px`;
}
```

### 4. Incremental Drawing

```typescript
// GOOD: Only draw new points
drawStrokePoint(strokeId: string, point: Point): void {
  const stroke = this.activeStrokes.get(strokeId);
  const lastPoint = stroke.points[stroke.points.length - 1];

  this.ctx.beginPath();
  this.ctx.moveTo(lastPoint.x, lastPoint.y);
  this.ctx.lineTo(point.x, point.y);
  this.ctx.stroke();

  stroke.points.push(point);
}

// BAD: Full redraw on every point (avoided)
// redrawAll() on every mousemove - too expensive!
```

### 5. WebSocket Transport Optimization

```typescript
const io = new Server(httpServer, {
  transports: ['websocket', 'polling'],  // Prefer WebSocket
  pingTimeout: 60000,
  pingInterval: 25000,
  // Binary data for efficiency
  parser: require('socket.io-msgpack-parser')
});
```

---

## 🔒 Input Validation & Security

### Server-Side Validation

All incoming data is validated before processing:

```typescript
function isValidPoint(data: unknown): data is Point {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any).x === 'number' &&
    typeof (data as any).y === 'number' &&
    isFinite((data as any).x) &&
    isFinite((data as any).y) &&
    (data as any).x >= -10000 &&
    (data as any).x <= 10000 &&
    (data as any).y >= -10000 &&
    (data as any).y <= 10000
  );
}

function isValidStrokeStart(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as any;
  return (
    typeof d.strokeId === 'string' &&
    d.strokeId.length > 0 &&
    d.strokeId.length < 50 &&
    /^#[0-9A-Fa-f]{6}$/.test(d.color) &&
    typeof d.width === 'number' &&
    d.width >= 1 &&
    d.width <= 50 &&
    (d.tool === 'brush' || d.tool === 'eraser')
  );
}

function isValidUsername(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length >= 1 &&
    name.length <= 30 &&
    /^[a-zA-Z0-9\s\-_]+$/.test(name)
  );
}
```

### Validation Error Handling

```typescript
socket.on('stroke:start', (data) => {
  if (!isValidStrokeStart(data)) {
    socket.emit('error', { message: 'Invalid stroke data' });
    return;
  }
  // Process valid data...
});
```

### Resource Limits

| Resource | Limit | Enforcement |
|----------|-------|-------------|
| Strokes per Room | 5,000 | Reject new strokes when full |
| Shapes per Room | 1,000 | Reject new shapes when full |
| Text Elements | 500 | Reject new text when full |
| Points per Stroke | 10,000 | Truncate stroke |
| Undo Stack | 50 | FIFO (oldest removed) |
| Coordinate Range | ±10,000 | Validate on receive |
| Stroke Width | 1-50 | Clamp to range |

---

## 🔀 Conflict Resolution

### Concurrent Drawing

When multiple users draw simultaneously on overlapping areas:

```
User A draws:  ████████████
User B draws:      ████████████

Result:        ████████████████  (Both visible, layered by timestamp)
```

**Strategy:** Last-write-wins with timestamp ordering
- All strokes are preserved
- Rendering order determined by `timestamp`
- No conflicts because strokes don't modify each other

### Concurrent Undo

```
Time T1: User A presses Undo
Time T2: User B presses Undo (before T1 completes)

Server handles sequentially:
1. Process User A's undo → broadcast state
2. Process User B's undo → broadcast state
```

**Strategy:** Server serializes all undo operations
- Only one undo processed at a time
- Each undo triggers full state broadcast
- All clients converge to same state

---

## 📈 Scalability Considerations

### Current Architecture (Single Server)

```
┌─────────────────┐
│   Load Balancer │  (Optional)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Node.js Server │  ← Single instance
│                 │
│  • All rooms    │
│  • All users    │
│  • All state    │
└─────────────────┘
```

**Limits:**
- ~1,000 concurrent connections per server
- ~50 rooms with active drawing
- Memory bound (all state in RAM)

### Scaling to 10,000+ Users

For production at scale, consider:

```
┌─────────────────┐
│   Load Balancer │
│  (Sticky Sessions)
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│Server1│ │Server2│  ← Multiple instances
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│  Redis Pub/Sub  │  ← Shared state
│  + Redis Cache  │
└─────────────────┘
```

**Requirements:**
1. **Redis Pub/Sub** - Share events across server instances
2. **Room Sharding** - Distribute rooms across servers
3. **Sticky Sessions** - Route same user to same server
4. **Redis Cache** - Share room state

### Future Optimizations

| Optimization | Benefit |
|--------------|---------|
| Event Batching | Reduce network calls |
| Delta Sync | Send only changes |
| Canvas Snapshots | Reduce stroke history |
| Worker Threads | Offload processing |

---

## 📁 File Structure

```
collaborative-canvas/
│
├── 📂 client/                     # Frontend Application
│   ├── index.html                 # Main canvas page
│   ├── landing.html               # Marketing landing page
│   ├── style.css                  # Canvas styles (1300+ lines)
│   ├── landing.css                # Landing page styles (900+ lines)
│   │
│   └── 📂 src/
│       ├── main.ts                # App orchestrator (600+ lines)
│       │                          # - Initialization
│       │                          # - Event binding
│       │                          # - Export functions
│       │
│       ├── canvas.ts              # Drawing engine (800+ lines)
│       │                          # - Raw Canvas API
│       │                          # - DPR scaling
│       │                          # - Point smoothing
│       │                          # - Shape rendering
│       │
│       ├── ui.ts                  # UI management (400+ lines)
│       │                          # - Toolbar setup
│       │                          # - Menu dropdown
│       │                          # - Help panel
│       │                          # - Keyboard shortcuts
│       │
│       ├── websocket.ts           # Socket.io client (400+ lines)
│       │                          # - Connection management
│       │                          # - Event handlers
│       │                          # - Reconnection logic
│       │
│       └── utils.ts               # Utilities
│                                  # - Color generation
│                                  # - ID generation
│
├── 📂 server/                     # Backend Application
│   ├── server.ts                  # Development server (600+ lines)
│   │                              # - Express setup
│   │                              # - Socket.io handlers
│   │                              # - Room management
│   │
│   ├── production.ts              # Production server (650+ lines)
│   │                              # - Optimized for deployment
│   │                              # - Static file serving
│   │
│   ├── rooms.ts                   # Room management
│   └── drawing-state.ts           # State management
│
├── 📂 shared/                     # Shared Code
│   └── types.ts                   # TypeScript interfaces (150+ lines)
│                                  # - Stroke, Shape, TextElement
│                                  # - User, Room
│                                  # - Socket events
│
├── 📂 dist/                       # Built client (production)
├── 📂 dist-server/                # Built server (production)
│
├── 📄 package.json                # Dependencies & scripts
├── 📄 tsconfig.json               # TypeScript config (client)
├── 📄 tsconfig.server.json        # TypeScript config (server)
├── 📄 vite.config.ts              # Vite configuration
├── 📄 Dockerfile                  # Multi-stage Docker build
├── 📄 docker-compose.yml          # Docker Compose
├── 📄 README.md                   # User documentation
└── 📄 ARCHITECTURE.md             # This file
```

---

## 🧪 Testing Guide

### Manual Testing Checklist

#### 1. Basic Drawing
- [ ] Open app in browser
- [ ] Draw with brush tool
- [ ] Change colors (8 presets + custom)
- [ ] Change stroke width (8 sizes)
- [ ] Use eraser tool
- [ ] Undo/Redo works

#### 2. Real-Time Sync (2 Windows)
- [ ] Open app in 2 browser windows
- [ ] Draw in Window A → appears in Window B
- [ ] Ghost cursor visible in other window
- [ ] User list shows both users
- [ ] Press Ctrl+Z in B → undoes A's last stroke

#### 3. Shapes & Text
- [ ] Draw rectangle with R key
- [ ] Draw circle with C key
- [ ] Draw line with L key
- [ ] Toggle fill with F key
- [ ] Add text with T key

#### 4. Room Collaboration
- [ ] Create new room (menu button)
- [ ] Copy room URL
- [ ] Open URL in incognito window
- [ ] Both users in same isolated room
- [ ] Default room unaffected

#### 5. Export
- [ ] Export as PNG (downloads correctly)
- [ ] Export as SVG (downloads correctly)
- [ ] Clear canvas works

#### 6. Mobile Responsiveness
- [ ] Open in mobile view (DevTools)
- [ ] Toolbar at bottom of screen
- [ ] Touch drawing works
- [ ] Menu opens correctly
- [ ] All tools accessible

### Automated Testing (Future)

```bash
# Unit tests (not yet implemented)
npm run test

# E2E tests with Playwright (not yet implemented)
npm run test:e2e
```

---

## 📊 Development Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1** | 2-3 hours | Basic canvas, brush, eraser, colors, local undo |
| **Phase 2** | 3-4 hours | WebSocket sync, ghost cursors, user presence |
| **Phase 3** | 2-3 hours | Error handling, reconnection, offline queue |
| **Phase 4** | 2 hours | Docker, production build, deployment |
| **Phase 5** | 3-4 hours | Shapes, text, rooms, export, FPS display |
| **Phase 6** | 2-3 hours | Excalidraw UI, mobile responsive |
| **Docs** | 1-2 hours | README, Architecture documentation |
| **Total** | **~18 hours** | Full-featured collaborative canvas |

---

## 🔮 Future Improvements

| Feature | Priority | Complexity |
|---------|----------|------------|
| Database Persistence | High | Medium |
| User Authentication | Medium | Medium |
| Selection Tool | High | High |
| Layers | Medium | High |
| Image Upload | Medium | Medium |
| Pressure Sensitivity | Low | Medium |
| Mobile App | Low | High |
| Real-time Voice Chat | Low | High |

---

<div align="center">

**Built with ❤️ for Flam Assignment**

[📖 Back to README](README.md) • [🚀 Live Demo](https://real-time-collaborative-drawing-canvas-rqd8.onrender.com/)

</div>
