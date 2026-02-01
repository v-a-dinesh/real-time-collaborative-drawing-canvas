/**
 * Collaborative Canvas Server - With shapes, text, and room support
 */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { Point, Stroke, Shape, TextElement, User, SOCKET_EVENTS } from '../shared/types';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());

// ========================================
// Room State Management
// ========================================

interface RoomState {
  strokes: Stroke[];
  shapes: Shape[];
  textElements: TextElement[];
  redoStack: (Stroke | Shape | TextElement)[][];
  users: Map<string, User>;
  activeStrokes: Map<string, Stroke>;
}

// Room-based state (default room + custom rooms)
const rooms: Map<string, RoomState> = new Map();
const userRooms: Map<string, string> = new Map(); // socketId -> roomId

const MAX_STROKES = 5000;
const MAX_SHAPES = 1000;
const MAX_TEXT = 500;
const MAX_POINTS_PER_STROKE = 10000;
const MAX_UNDO_STACK = 50;
const DEFAULT_ROOM = 'default';

function getOrCreateRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      strokes: [],
      shapes: [],
      textElements: [],
      redoStack: [],
      users: new Map(),
      activeStrokes: new Map()
    });
  }
  return rooms.get(roomId)!;
}

function getUserRoom(socketId: string): RoomState {
  const roomId = userRooms.get(socketId) || DEFAULT_ROOM;
  return getOrCreateRoom(roomId);
}

// Health check with detailed status
app.get('/health', (_, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
    rooms: rooms.size,
    uptime: process.uptime()
  });
});

const userColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
  '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6'
];

let colorIndex = 0;

function getNextColor(): string {
  const color = userColors[colorIndex % userColors.length];
  colorIndex++;
  return color;
}

function generateUserName(): string {
  const adjectives = ['Happy', 'Swift', 'Clever', 'Bright', 'Cool', 'Wild', 'Calm', 'Bold', 'Keen', 'Quick'];
  const nouns = ['Artist', 'Painter', 'Creator', 'Drawer', 'Sketcher', 'Designer', 'Doodler', 'Illustrator'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return adj + noun + Math.floor(Math.random() * 100);
}

// Validate point data
function isValidPoint(data: any): data is { x: number; y: number } {
  return typeof data === 'object' &&
         typeof data.x === 'number' &&
         typeof data.y === 'number' &&
         isFinite(data.x) && isFinite(data.y) &&
         data.x >= -10000 && data.x <= 10000 &&
         data.y >= -10000 && data.y <= 10000;
}

// Validate stroke start data
function isValidStrokeStart(data: any): boolean {
  return typeof data === 'object' &&
         typeof data.strokeId === 'string' &&
         data.strokeId.length > 0 &&
         data.strokeId.length < 50 &&
         typeof data.x === 'number' &&
         typeof data.y === 'number' &&
         isFinite(data.x) && isFinite(data.y) &&
         typeof data.color === 'string' &&
         /^#[0-9A-Fa-f]{6}$/.test(data.color) &&
         typeof data.width === 'number' &&
         data.width >= 1 && data.width <= 50 &&
         (data.tool === 'brush' || data.tool === 'eraser');
}

// ========================================
// Socket.io Event Handlers
// ========================================

io.on('connection', (socket: Socket) => {
  console.log('New connection:', socket.id);

  // Get username from auth or generate random one
  const authUsername = (socket.handshake.auth as { username?: string })?.username;
  const sanitizedUsername = authUsername?.trim().slice(0, 20) || null;

  const user: User = {
    id: socket.id,
    name: sanitizedUsername || generateUserName(),
    color: getNextColor(),
    cursor: { x: 0, y: 0 },
    roomId: DEFAULT_ROOM
  };

  // Join default room
  const roomState = getOrCreateRoom(DEFAULT_ROOM);
  roomState.users.set(socket.id, user);
  userRooms.set(socket.id, DEFAULT_ROOM);
  socket.join(DEFAULT_ROOM);

  // Send user list
  socket.emit('users:list', {
    users: Array.from(roomState.users.values()),
    currentUser: user
  });

  // Send current state
  socket.emit(SOCKET_EVENTS.FULL_STATE, {
    strokes: roomState.strokes,
    shapes: roomState.shapes,
    textElements: roomState.textElements
  });

  // Notify others in room
  socket.to(DEFAULT_ROOM).emit(SOCKET_EVENTS.USER_JOINED, { user });

  console.log('User joined:', user.name, 'Room:', DEFAULT_ROOM, 'Total users:', roomState.users.size);

  // ========================================
  // Ping/Pong for Latency Measurement
  // ========================================

  socket.on('ping', () => {
    socket.emit('pong');
  });

  // ========================================
  // Room Events
  // ========================================

  socket.on(SOCKET_EVENTS.ROOM_JOIN, (data: { roomId: string }) => {
    try {
      const newRoomId = data.roomId?.trim();
      if (!newRoomId || newRoomId.length > 20) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { error: 'Invalid room ID' });
        return;
      }

      const currentRoomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      
      // Leave current room
      const currentRoom = rooms.get(currentRoomId);
      if (currentRoom) {
        currentRoom.users.delete(socket.id);
        socket.leave(currentRoomId);
        socket.to(currentRoomId).emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id });
      }

      // Join new room
      const newRoom = getOrCreateRoom(newRoomId);
      user.roomId = newRoomId;
      newRoom.users.set(socket.id, user);
      userRooms.set(socket.id, newRoomId);
      socket.join(newRoomId);

      // Send new room state
      socket.emit('users:list', {
        users: Array.from(newRoom.users.values()),
        currentUser: user
      });

      socket.emit(SOCKET_EVENTS.FULL_STATE, {
        strokes: newRoom.strokes,
        shapes: newRoom.shapes,
        textElements: newRoom.textElements
      });

      socket.emit(SOCKET_EVENTS.ROOM_JOINED, { roomId: newRoomId });
      socket.to(newRoomId).emit(SOCKET_EVENTS.USER_JOINED, { user });

      console.log('User', user.name, 'joined room:', newRoomId);
    } catch (err) {
      console.error('Error joining room:', err);
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, { error: 'Failed to join room' });
    }
  });

  // ========================================
  // Drawing Events with Validation
  // ========================================

  socket.on(SOCKET_EVENTS.STROKE_START, (data: unknown) => {
    try {
      if (!isValidStrokeStart(data)) {
        console.warn('Invalid stroke start data from', socket.id);
        return;
      }

      const roomState = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      
      const typedData = data as {
        strokeId: string;
        x: number;
        y: number;
        color: string;
        width: number;
        tool: 'brush' | 'eraser';
      };

      // Check for duplicate stroke ID
      if (roomState.activeStrokes.has(typedData.strokeId)) {
        return;
      }

      const stroke: Stroke = {
        id: typedData.strokeId,
        points: [{ x: typedData.x, y: typedData.y }],
        color: typedData.color,
        width: typedData.width,
        tool: typedData.tool,
        userId: socket.id,
        timestamp: Date.now()
      };

      roomState.activeStrokes.set(typedData.strokeId, stroke);
      socket.to(roomId).emit(SOCKET_EVENTS.STROKE_BROADCAST, { stroke });
    } catch (err) {
      console.error('Error in stroke start:', err);
    }
  });

  socket.on(SOCKET_EVENTS.STROKE_MOVE, (data: unknown) => {
    try {
      if (typeof data !== 'object' || data === null) return;
      
      const roomState = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      
      const typedData = data as { strokeId: string; x: number; y: number };
      
      if (typeof typedData.strokeId !== 'string' || !isValidPoint(typedData)) {
        return;
      }

      const stroke = roomState.activeStrokes.get(typedData.strokeId);
      if (!stroke || stroke.userId !== socket.id) return;

      // Limit points per stroke
      if (stroke.points.length >= MAX_POINTS_PER_STROKE) return;

      stroke.points.push({ x: typedData.x, y: typedData.y });

      socket.to(roomId).emit(SOCKET_EVENTS.STROKE_MOVE_BROADCAST, {
        strokeId: typedData.strokeId,
        userId: socket.id,
        x: typedData.x,
        y: typedData.y
      });
    } catch (err) {
      console.error('Error in stroke move:', err);
    }
  });

  socket.on(SOCKET_EVENTS.STROKE_END, (data: unknown) => {
    try {
      if (typeof data !== 'object' || data === null) return;
      
      const roomState = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      
      const typedData = data as { strokeId: string };
      if (typeof typedData.strokeId !== 'string') return;

      const stroke = roomState.activeStrokes.get(typedData.strokeId);
      if (!stroke || stroke.userId !== socket.id) return;

      // Move to completed strokes
      if (roomState.strokes.length >= MAX_STROKES) {
        roomState.strokes.shift(); // Remove oldest
      }
      
      roomState.strokes.push(stroke);
      roomState.activeStrokes.delete(typedData.strokeId);
      roomState.redoStack = [];

      socket.to(roomId).emit(SOCKET_EVENTS.STROKE_END_BROADCAST, {
        strokeId: typedData.strokeId,
        userId: socket.id
      });
    } catch (err) {
      console.error('Error in stroke end:', err);
    }
  });

  // ========================================
  // Cursor Events
  // ========================================

  socket.on(SOCKET_EVENTS.CURSOR_MOVE, (data: unknown) => {
    try {
      if (!isValidPoint(data)) return;
      
      const roomState = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      const user = roomState.users.get(socket.id);
      if (!user) return;

      user.cursor = { x: (data as Point).x, y: (data as Point).y };

      socket.to(roomId).emit(SOCKET_EVENTS.CURSOR_UPDATE, {
        userId: socket.id,
        x: user.cursor.x,
        y: user.cursor.y,
        color: user.color,
        name: user.name
      });
    } catch (err) {
      console.error('Error in cursor move:', err);
    }
  });

  // ========================================
  // Shape Events
  // ========================================

  socket.on(SOCKET_EVENTS.SHAPE_ADD, (data: { shape: Shape }) => {
    try {
      if (!data?.shape) return;
      
      const roomState = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      
      // Server sets timestamp to prevent client manipulation
      const shape = { ...data.shape, userId: socket.id, timestamp: Date.now() };
      
      if (roomState.shapes.length >= MAX_SHAPES) {
        roomState.shapes.shift();
      }
      
      roomState.shapes.push(shape);
      roomState.redoStack = [];
      
      socket.to(roomId).emit(SOCKET_EVENTS.SHAPE_BROADCAST, { shape });
    } catch (err) {
      console.error('Error adding shape:', err);
    }
  });

  // ========================================
  // Text Events
  // ========================================

  socket.on(SOCKET_EVENTS.TEXT_ADD, (data: { text: TextElement }) => {
    try {
      if (!data?.text) return;
      
      const roomState = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      
      // Server sets timestamp to prevent client manipulation
      const text = { ...data.text, userId: socket.id, timestamp: Date.now() };
      
      if (roomState.textElements.length >= MAX_TEXT) {
        roomState.textElements.shift();
      }
      
      roomState.textElements.push(text);
      roomState.redoStack = [];
      
      socket.to(roomId).emit(SOCKET_EVENTS.TEXT_BROADCAST, { text });
    } catch (err) {
      console.error('Error adding text:', err);
    }
  });

  // ========================================
  // Undo/Redo (Global per room)
  // ========================================

  socket.on(SOCKET_EVENTS.UNDO, () => {
    try {
      const roomState = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      
      if (roomState.strokes.length === 0 && roomState.shapes.length === 0 && roomState.textElements.length === 0) return;

      // Find the most recent item across all types by timestamp
      let maxTime = 0;
      let maxType: 'stroke' | 'shape' | 'text' | null = null;
      let maxIndex = -1;

      roomState.strokes.forEach((s, i) => {
        if (s.timestamp > maxTime) {
          maxTime = s.timestamp;
          maxType = 'stroke';
          maxIndex = i;
        }
      });

      roomState.shapes.forEach((s, i) => {
        if (s.timestamp > maxTime) {
          maxTime = s.timestamp;
          maxType = 'shape';
          maxIndex = i;
        }
      });

      roomState.textElements.forEach((t, i) => {
        if (t.timestamp > maxTime) {
          maxTime = t.timestamp;
          maxType = 'text';
          maxIndex = i;
        }
      });

      let removed: Stroke | Shape | TextElement | undefined;

      if (maxType === 'stroke' && maxIndex !== -1) {
        removed = roomState.strokes.splice(maxIndex, 1)[0];
      } else if (maxType === 'shape' && maxIndex !== -1) {
        removed = roomState.shapes.splice(maxIndex, 1)[0];
      } else if (maxType === 'text' && maxIndex !== -1) {
        removed = roomState.textElements.splice(maxIndex, 1)[0];
      }
      
      if (removed) {
        roomState.redoStack.push([removed]);
        if (roomState.redoStack.length > MAX_UNDO_STACK) {
          roomState.redoStack.shift();
        }
      }

      io.to(roomId).emit(SOCKET_EVENTS.UNDO_REDO_BROADCAST, {
        strokes: roomState.strokes,
        shapes: roomState.shapes,
        textElements: roomState.textElements,
        action: 'undo'
      });

      console.log('Undo performed in room', roomId);
    } catch (err) {
      console.error('Error in undo:', err);
    }
  });

  socket.on(SOCKET_EVENTS.REDO, () => {
    try {
      const roomState = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      
      if (roomState.redoStack.length === 0) return;

      const redoItems = roomState.redoStack.pop();
      if (redoItems) {
        for (const item of redoItems) {
          // Validate item has a timestamp
          if (typeof item.timestamp !== 'number' || item.timestamp <= 0) {
            console.warn('Skipping redo item with invalid timestamp');
            continue;
          }
          
          // Type detection and insert in correct position based on timestamp
          if ('points' in item && Array.isArray((item as Stroke).points)) {
            const stroke = item as Stroke;
            // Insert in timestamp order
            const insertIndex = roomState.strokes.findIndex(s => s.timestamp > stroke.timestamp);
            if (insertIndex === -1) {
              roomState.strokes.push(stroke);
            } else {
              roomState.strokes.splice(insertIndex, 0, stroke);
            }
          } else if ('startPoint' in item && 'endPoint' in item) {
            const shape = item as Shape;
            const insertIndex = roomState.shapes.findIndex(s => s.timestamp > shape.timestamp);
            if (insertIndex === -1) {
              roomState.shapes.push(shape);
            } else {
              roomState.shapes.splice(insertIndex, 0, shape);
            }
          } else if ('text' in item && 'position' in item) {
            const text = item as TextElement;
            const insertIndex = roomState.textElements.findIndex(t => t.timestamp > text.timestamp);
            if (insertIndex === -1) {
              roomState.textElements.push(text);
            } else {
              roomState.textElements.splice(insertIndex, 0, text);
            }
          }
        }
      }

      io.to(roomId).emit(SOCKET_EVENTS.UNDO_REDO_BROADCAST, {
        strokes: roomState.strokes,
        shapes: roomState.shapes,
        textElements: roomState.textElements,
        action: 'redo'
      });

      console.log('Redo performed in room', roomId);
    } catch (err) {
      console.error('Error in redo:', err);
    }
  });

  // ========================================
  // State Request
  // ========================================

  socket.on(SOCKET_EVENTS.REQUEST_STATE, () => {
    const roomState = getUserRoom(socket.id);
    socket.emit(SOCKET_EVENTS.FULL_STATE, {
      strokes: roomState.strokes,
      shapes: roomState.shapes,
      textElements: roomState.textElements
    });
  });

  // ========================================
  // Disconnect
  // ========================================

  socket.on('disconnect', (reason) => {
    const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
    const roomState = rooms.get(roomId);
    
    if (roomState) {
      const user = roomState.users.get(socket.id);
      if (user) {
        console.log('User left:', user.name, 'Room:', roomId, 'Reason:', reason);
        roomState.users.delete(socket.id);

        // Clean up active strokes
        for (const [strokeId, stroke] of roomState.activeStrokes) {
          if (stroke.userId === socket.id) {
            // Complete the stroke before removing
            roomState.strokes.push(stroke);
            roomState.activeStrokes.delete(strokeId);
          }
        }

        socket.to(roomId).emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id });
        console.log('Remaining users in room', roomId, ':', roomState.users.size);
        
        // Clean up empty rooms (except default)
        if (roomState.users.size === 0 && roomId !== DEFAULT_ROOM) {
          rooms.delete(roomId);
          console.log('Room deleted:', roomId);
        }
      }
    }
    
    userRooms.delete(socket.id);
  });

  // Handle errors
  socket.on('error', (err) => {
    console.error('Socket error for', socket.id, ':', err);
  });
});

// ========================================
// Server Startup
// ========================================

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`
  ========================================
   Collaborative Canvas Server
   ========================================
    Running on port ${PORT}
    Mode: ${process.env.NODE_ENV || 'Development'}
    Health: http://localhost:${PORT}/health
    Max Strokes: ${MAX_STROKES}
    Max Undo: ${MAX_UNDO_STACK}
   ========================================
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  io.close(() => {
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});