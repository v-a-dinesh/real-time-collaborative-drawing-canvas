# Architecture Documentation

## Real-Time Collaborative Drawing Canvas

This document describes the technical architecture, design decisions, and implementation details of the collaborative drawing application.

---

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENT BROWSER                                │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ │
│  │    main.ts     │──│     ui.ts      │──│       canvas.ts            │ │
│  │ (Orchestrator) │  │   (Toolbar)    │  │  (Drawing Engine)          │ │
│  └───────┬────────┘  └────────────────┘  └─────────────┬──────────────┘ │
│          │                                              │                │
│          └──────────────────┬───────────────────────────┘                │
│                             │                                            │
│                    ┌────────▼────────┐                                   │
│                    │  websocket.ts   │                                   │
│                    │ (Socket.io)     │                                   │
│                    └────────┬────────┘                                   │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │ WebSocket Connection (Socket.io)
                              │ Events: stroke:*, cursor:*, room:*, undo/redo
                              │
┌─────────────────────────────▼───────────────────────────────────────────┐
│                            SERVER (Node.js)                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        server.ts                                 │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │    │
│  │  │   Room Manager  │  │  State Manager  │  │  Event Handler  │  │    │
│  │  │ (rooms Map)     │  │ (strokes/shapes)│  │ (Socket.io)     │  │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Data Flow Diagram

### Drawing Flow (User A draws → User B sees)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User A    │     │   Client A  │     │   Server    │     │   Client B  │
│ (Drawing)   │     │ (Canvas)    │     │ (Node.js)   │     │ (Canvas)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ mousedown         │                   │                   │
       │──────────────────>│                   │                   │
       │                   │ stroke:start      │                   │
       │                   │ {strokeId, x, y,  │                   │
       │                   │  color, width}    │                   │
       │                   │──────────────────>│                   │
       │                   │                   │ stroke:broadcast  │
       │                   │                   │──────────────────>│
       │                   │                   │                   │ Draw on canvas
       │ mousemove (x10)   │                   │                   │
       │──────────────────>│                   │                   │
       │                   │ stroke:move       │                   │
       │                   │ {strokeId, x, y}  │                   │
       │                   │──────────────────>│                   │
       │                   │                   │ stroke:move:broadcast
       │                   │                   │──────────────────>│
       │                   │                   │                   │ Continue line
       │ mouseup           │                   │                   │
       │──────────────────>│                   │                   │
       │                   │ stroke:end        │                   │
       │                   │ {strokeId}        │                   │
       │                   │──────────────────>│                   │
       │                   │                   │ Finalize stroke   │
       │                   │                   │ (add to history)  │
       │                   │                   │ stroke:end:broadcast
       │                   │                   │──────────────────>│
       │                   │                   │                   │ Finalize stroke
       ▼                   ▼                   ▼                   ▼
```

### State Synchronization Flow (New User Joins)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  New User   │     │   Server    │     │Existing User│
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ connect           │                   │
       │──────────────────>│                   │
       │                   │                   │
       │ users:list        │                   │
       │<──────────────────│                   │
       │ (all users +      │                   │
       │  current user)    │                   │
       │                   │                   │
       │ state:full        │                   │
       │<──────────────────│                   │
       │ (strokes, shapes, │                   │
       │  textElements)    │                   │
       │                   │                   │
       │                   │ user:joined       │
       │                   │──────────────────>│
       │                   │                   │ (update users list)
       ▼                   ▼                   ▼
```

---

## 📨 WebSocket Protocol

### Event Types

| Event Name | Direction | Payload | Description |
|------------|-----------|---------|-------------|
| `stroke:start` | Client→Server | `{strokeId, x, y, color, width, tool}` | Begin new stroke |
| `stroke:move` | Client→Server | `{strokeId, x, y}` | Add point to stroke |
| `stroke:end` | Client→Server | `{strokeId}` | Finalize stroke |
| `stroke:broadcast` | Server→Clients | `{stroke: Stroke}` | Broadcast stroke start |
| `stroke:move:broadcast` | Server→Clients | `{strokeId, userId, x, y}` | Broadcast stroke point |
| `stroke:end:broadcast` | Server→Clients | `{strokeId, userId}` | Broadcast stroke end |
| `cursor:move` | Client→Server | `{x, y}` | User cursor position |
| `cursor:update` | Server→Clients | `{userId, x, y, color, name}` | Broadcast cursor |
| `shape:add` | Client→Server | `{shape: Shape}` | Add shape |
| `shape:broadcast` | Server→Clients | `{shape: Shape}` | Broadcast shape |
| `text:add` | Client→Server | `{text: TextElement}` | Add text |
| `text:broadcast` | Server→Clients | `{text: TextElement}` | Broadcast text |
| `undo` | Client→Server | - | Request undo |
| `redo` | Client→Server | - | Request redo |
| `undo:redo:broadcast` | Server→Clients | `{strokes, shapes, textElements, action}` | Full state after undo/redo |
| `room:join` | Client→Server | `{roomId}` | Join room |
| `room:joined` | Server→Client | `{roomId}` | Room join confirmation |
| `state:request` | Client→Server | - | Request full state |
| `state:full` | Server→Client | `{strokes, shapes, textElements}` | Full canvas state |
| `user:joined` | Server→Clients | `{user: User}` | User joined notification |
| `user:left` | Server→Clients | `{userId}` | User left notification |
| `users:list` | Server→Client | `{users, currentUser}` | All users in room |

### Message Formats

```typescript
// Stroke Start
{
  strokeId: "lxyz123abc456",  // Unique ID (timestamp + random)
  x: 150.5,                   // Canvas X coordinate
  y: 200.3,                   // Canvas Y coordinate
  color: "#FF0000",           // Hex color
  width: 5,                   // Stroke width (1-50)
  tool: "brush" | "eraser"    // Tool type
}

// Stroke Object (Server Storage)
{
  id: "lxyz123abc456",
  points: [{x: 150.5, y: 200.3}, ...],
  color: "#FF0000",
  width: 5,
  tool: "brush",
  userId: "socket-id-abc",
  timestamp: 1706640000000
}

// Shape Object
{
  id: "shape123",
  type: "rectangle" | "circle" | "line",
  startPoint: {x: 100, y: 100},
  endPoint: {x: 200, y: 200},
  color: "#0000FF",
  width: 3,
  filled: true,
  userId: "socket-id-abc",
  timestamp: 1706640000000
}
```

---

## 🔄 Undo/Redo Strategy

### The Challenge

Global undo/redo is the hardest part of this application because:
1. Multiple users can draw simultaneously
2. User A should be able to undo User B's action
3. All clients must stay in sync after undo/redo

### Our Solution: Timestamp-Based Global Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    SERVER STATE (Per Room)                   │
│                                                              │
│  strokes: [                                                  │
│    {id: "s1", timestamp: 1000, userId: "A", points: [...]}, │
│    {id: "s2", timestamp: 1500, userId: "B", points: [...]}, │
│    {id: "s3", timestamp: 2000, userId: "A", points: [...]}, │
│  ]                                                           │
│                                                              │
│  shapes: [                                                   │
│    {id: "sh1", timestamp: 1200, type: "rectangle", ...},    │
│  ]                                                           │
│                                                              │
│  textElements: [                                             │
│    {id: "t1", timestamp: 1800, text: "Hello", ...},         │
│  ]                                                           │
│                                                              │
│  redoStack: [                                                │
│    [removed items from last undo],                          │
│  ]                                                           │
└─────────────────────────────────────────────────────────────┘
```

### Undo Algorithm

```javascript
function handleUndo() {
  // 1. Find the most recent item across all types
  const lastStroke = strokes[strokes.length - 1];
  const lastShape = shapes[shapes.length - 1];
  const lastText = textElements[textElements.length - 1];
  
  // 2. Compare timestamps to find truly last action
  const times = [
    lastStroke?.timestamp || 0,
    lastShape?.timestamp || 0,
    lastText?.timestamp || 0
  ];
  const maxTime = Math.max(...times);
  
  // 3. Remove the most recent item
  if (lastStroke?.timestamp === maxTime) {
    removed = strokes.pop();
  } else if (lastShape?.timestamp === maxTime) {
    removed = shapes.pop();
  } else if (lastText?.timestamp === maxTime) {
    removed = textElements.pop();
  }
  
  // 4. Push to redo stack for potential redo
  redoStack.push([removed]);
  
  // 5. Broadcast full state to ALL clients
  io.to(roomId).emit('undo:redo:broadcast', {
    strokes, shapes, textElements, action: 'undo'
  });
}
```

### Why This Works

1. **Single Source of Truth**: Server maintains authoritative state
2. **Timestamp Ordering**: Actions are ordered by when they occurred, not by user
3. **Full State Broadcast**: After undo/redo, all clients receive complete state
4. **Cross-User Undo**: Any user can undo the last action, regardless of who made it

### Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| **Full State Broadcast** (our approach) | Simple, always consistent | More bandwidth on undo |
| Operation Transformation | Less bandwidth | Complex to implement |
| CRDT | Eventually consistent | Very complex |

---

## ⚡ Performance Optimizations

### 1. Event Throttling

```typescript
// Cursor updates throttled to 60fps (16ms)
private cursorThrottleTimer: number | null = null;
private readonly CURSOR_THROTTLE_MS = 16;

if (this.cursorThrottleTimer === null) {
  this.cursorThrottleTimer = window.setTimeout(() => {
    this.callbacks.onCursorMove?.({ x, y });
    this.cursorThrottleTimer = null;
  }, this.CURSOR_THROTTLE_MS);
}
```

### 2. Point Smoothing

```typescript
// Exponential moving average for smoother lines
private smoothPoint(point: Point): Point {
  const last = this.pointBuffer[this.pointBuffer.length - 1];
  return {
    x: last.x + (point.x - last.x) * 0.3,
    y: last.y + (point.y - last.y) * 0.3
  };
}
```

### 3. Efficient Canvas Rendering

- **DPR Scaling**: Canvas scaled by `devicePixelRatio` for crisp lines
- **Line Properties**: `lineCap='round'`, `lineJoin='round'` for smooth corners
- **Incremental Drawing**: Only draw new points, not full redraw
- **Batch Redraw**: `redrawAll()` only on undo/redo/state sync

### 4. WebSocket Optimization

- **Binary Transport**: Socket.io uses WebSocket transport when available
- **Reconnection**: Exponential backoff (1s → 5s max)
- **Offline Queue**: Strokes queued when disconnected, flushed on reconnect

### 5. FPS & Latency Monitoring

Real-time performance metrics displayed in a panel (bottom-right):

```typescript
// FPS tracking using requestAnimationFrame
private startPerformanceMonitoring(): void {
  const updatePerformance = () => {
    this.perfStats.frameCount++;
    const elapsed = performance.now() - this.perfStats.lastFpsUpdate;
    
    if (elapsed >= 500) {
      this.perfStats.fps = Math.round((this.perfStats.frameCount * 1000) / elapsed);
      this.perfStats.frameCount = 0;
      this.perfStats.lastFpsUpdate = performance.now();
    }
    
    requestAnimationFrame(updatePerformance);
  };
  requestAnimationFrame(updatePerformance);
}

// Latency measurement via ping/pong
socket.on('ping', () => {
  this.pingStartTime = Date.now();
  socket.emit('ping');
});
socket.on('pong', () => {
  this.latency = Date.now() - this.pingStartTime;
});
```

**Metrics Displayed:**
| Metric | Color Coding |
|--------|-------------|
| FPS | Green (≥55), Orange (30-54), Red (<30) |
| Latency | Green (<50ms), Orange (50-150ms), Red (>150ms) |
| Strokes | Total count of strokes + shapes |

---

## 🔀 Conflict Resolution

### Concurrent Drawing

When multiple users draw simultaneously on overlapping areas:

```
User A draws:  ████████████
User B draws:      ████████████
Result:        ████████████████  (Both visible, layered by timestamp)
```

**Strategy**: Last-write-wins with timestamp ordering
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

**Strategy**: Server serializes all undo operations
- Only one undo processed at a time
- Each undo triggers full state broadcast
- All clients converge to same state

---

## 🏗️ Room Architecture

### Room Isolation

```typescript
interface RoomState {
  strokes: Stroke[];
  shapes: Shape[];
  textElements: TextElement[];
  undoStack: (Stroke | Shape | TextElement)[][];
  redoStack: (Stroke | Shape | TextElement)[][];
  users: Map<string, User>;
  activeStrokes: Map<string, Stroke>;
}

const rooms: Map<string, RoomState> = new Map();
const userRooms: Map<string, string> = new Map(); // socketId → roomId
```

### Room Lifecycle

1. **Creation**: Room created when first user joins (or on demand)
2. **Joining**: User added to room, receives full state
3. **Broadcasting**: Events only sent to users in same room
4. **Cleanup**: Empty rooms (except 'default') are deleted

---

## 📈 Scalability Considerations

### Current Limits

| Resource | Limit | Reason |
|----------|-------|--------|
| Max Strokes per Room | 5,000 | Memory management |
| Max Shapes per Room | 1,000 | Memory management |
| Max Text Elements | 500 | Memory management |
| Max Points per Stroke | 10,000 | Prevent abuse |
| Max Undo Stack | 50 | Memory management |

### Scaling to 1000+ Users

For production at scale, consider:

1. **Redis Pub/Sub**: Share state across multiple server instances
2. **Room Sharding**: Distribute rooms across servers
3. **Event Batching**: Aggregate stroke moves (every 50ms instead of every move)
4. **Delta Sync**: Send only changes, not full state
5. **Canvas Snapshots**: Periodically save canvas as image, reduce stroke history

---

## 🔒 Input Validation

### Server-Side Validation

```typescript
function isValidPoint(data: any): boolean {
  return typeof data === 'object' &&
         typeof data.x === 'number' &&
         typeof data.y === 'number' &&
         isFinite(data.x) && isFinite(data.y) &&
         data.x >= -10000 && data.x <= 10000 &&
         data.y >= -10000 && data.y <= 10000;
}

function isValidStrokeStart(data: any): boolean {
  return typeof data === 'object' &&
         typeof data.strokeId === 'string' &&
         data.strokeId.length > 0 &&
         data.strokeId.length < 50 &&
         /^#[0-9A-Fa-f]{6}$/.test(data.color) &&
         data.width >= 1 && data.width <= 50 &&
         (data.tool === 'brush' || data.tool === 'eraser');
}
```

---

## 📁 File Structure

```
collaborative-canvas/
├── client/
│   ├── index.html          # Main HTML structure
│   ├── style.css           # Styling
│   └── src/
│       ├── main.ts         # App orchestrator (531 lines)
│       ├── canvas.ts       # Drawing engine (778 lines)
│       ├── ui.ts           # Toolbar & shortcuts (359 lines)
│       ├── websocket.ts    # Socket.io client (374 lines)
│       └── utils.ts        # Utilities
├── server/
│   ├── server.ts           # Express + Socket.io (587 lines)
│   └── production.ts       # Production bundle
├── shared/
│   └── types.ts            # TypeScript interfaces (134 lines)
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── README.md
└── ARCHITECTURE.md         # This file
```

---

## 🧪 Testing Instructions

### Manual Testing (Two Browser Windows)

1. Start the server:
   ```bash
   npm install
   npm run dev
   ```

2. Open two browser windows at `http://localhost:5173`

3. Test real-time drawing:
   - Draw in Window A → appears in Window B immediately
   - Move cursor in Window A → ghost cursor appears in Window B

4. Test global undo:
   - Draw stroke in Window A
   - Draw stroke in Window B
   - Press Ctrl+Z in Window A → removes Window B's last stroke

5. Test rooms:
   - Click "New Room" in Window A
   - Copy URL and paste in Window B
   - Both users now in isolated room

---

## 📊 Time Spent

| Phase | Time |
|-------|------|
| Phase 1: Basic Canvas | 2-3 hours |
| Phase 2: WebSocket Sync | 3-4 hours |
| Phase 3: Error Handling | 2-3 hours |
| Phase 4: Docker/Production | 2 hours |
| Phase 5: Advanced Features | 3-4 hours |
| Documentation | 1-2 hours |
| **Total** | **13-18 hours** |

---

## 🔮 Future Improvements

1. **Persistence**: Save drawings to database
2. **Layers**: Separate layers for each user
3. **Selection Tool**: Select and move drawn elements
4. **Pressure Sensitivity**: For stylus support
5. **Performance Dashboard**: FPS counter, latency display
