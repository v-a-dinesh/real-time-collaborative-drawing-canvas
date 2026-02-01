// server/production.ts
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// shared/types.ts
var SOCKET_EVENTS = {
  // Connection
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  // User events
  USER_JOINED: "user:joined",
  USER_LEFT: "user:left",
  USERS_LIST: "users:list",
  // Drawing events (client to server)
  STROKE_START: "stroke:start",
  STROKE_MOVE: "stroke:move",
  STROKE_UPDATE: "stroke:update",
  STROKE_END: "stroke:end",
  // Drawing events (server to clients)
  STROKE_BROADCAST: "stroke:broadcast",
  STROKE_MOVE_BROADCAST: "stroke:move:broadcast",
  STROKE_END_BROADCAST: "stroke:end:broadcast",
  // Shape events
  SHAPE_ADD: "shape:add",
  SHAPE_BROADCAST: "shape:broadcast",
  // Text events
  TEXT_ADD: "text:add",
  TEXT_BROADCAST: "text:broadcast",
  // Cursor events
  CURSOR_MOVE: "cursor:move",
  CURSOR_UPDATE: "cursor:update",
  // State sync
  REQUEST_STATE: "state:request",
  FULL_STATE: "state:full",
  // Undo/Redo
  UNDO: "undo",
  REDO: "redo",
  UNDO_REDO_BROADCAST: "undo:redo:broadcast",
  // Canvas clear
  CLEAR_CANVAS: "canvas:clear",
  // Room events
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_CREATED: "room:created",
  ROOM_JOINED: "room:joined",
  ROOM_LEFT: "room:left",
  ROOM_LIST: "room:list",
  ROOM_ERROR: "room:error"
};

// server/production.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var httpServer = createServer(app);
var PORT = parseInt(process.env.PORT || "3000", 10);
var MAX_STROKES = parseInt(process.env.MAX_STROKES || "5000", 10);
var MAX_SHAPES = 1e3;
var MAX_TEXT = 500;
var MAX_POINTS_PER_STROKE = 1e4;
var MAX_UNDO_STACK = parseInt(process.env.MAX_UNDO_HISTORY || "50", 10);
var DEFAULT_ROOM = "default";
var io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"],
  pingTimeout: 6e4,
  pingInterval: 25e3
});
var clientPath = path.join(__dirname, "..", "dist", "client");
app.use(express.static(clientPath));
app.get("/health", (_, res) => {
  res.json({
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    connections: io.engine.clientsCount,
    rooms: rooms.size,
    uptime: process.uptime()
  });
});
app.get("/", (_, res) => {
  res.sendFile(path.join(clientPath, "landing.html"));
});
app.get("/canvas", (_, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});
app.get("*", (_, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});
var rooms = /* @__PURE__ */ new Map();
var userRooms = /* @__PURE__ */ new Map();
function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      strokes: [],
      shapes: [],
      textElements: [],
      redoStack: [],
      users: /* @__PURE__ */ new Map(),
      activeStrokes: /* @__PURE__ */ new Map()
    });
  }
  return rooms.get(roomId);
}
function getUserRoom(socketId) {
  const roomId = userRooms.get(socketId) || DEFAULT_ROOM;
  return getOrCreateRoom(roomId);
}
var userColors = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F8B500",
  "#00CED1",
  "#E74C3C",
  "#3498DB",
  "#2ECC71",
  "#9B59B6"
];
var colorIndex = 0;
function getNextColor() {
  const color = userColors[colorIndex % userColors.length];
  colorIndex++;
  return color;
}
function generateUserName() {
  const adjectives = ["Happy", "Swift", "Clever", "Bright", "Cool", "Wild", "Calm", "Bold", "Keen", "Quick"];
  const nouns = ["Artist", "Painter", "Creator", "Drawer", "Sketcher", "Designer", "Doodler", "Illustrator"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return adj + noun + Math.floor(Math.random() * 100);
}
function isValidPoint(data) {
  return typeof data === "object" && typeof data.x === "number" && typeof data.y === "number" && isFinite(data.x) && isFinite(data.y) && data.x >= -1e4 && data.x <= 1e4 && data.y >= -1e4 && data.y <= 1e4;
}
function isValidStrokeStart(data) {
  return typeof data === "object" && typeof data.strokeId === "string" && data.strokeId.length > 0 && data.strokeId.length < 50 && typeof data.x === "number" && typeof data.y === "number" && isFinite(data.x) && isFinite(data.y) && typeof data.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(data.color) && typeof data.width === "number" && data.width >= 1 && data.width <= 50 && (data.tool === "brush" || data.tool === "eraser");
}
io.on("connection", (socket) => {
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] New connection: ${socket.id}`);
  const authUsername = socket.handshake.auth?.username;
  const sanitizedUsername = authUsername?.trim().slice(0, 20) || null;
  const user = {
    id: socket.id,
    name: sanitizedUsername || generateUserName(),
    color: getNextColor(),
    cursor: { x: 0, y: 0 },
    roomId: DEFAULT_ROOM
  };
  const roomState = getOrCreateRoom(DEFAULT_ROOM);
  roomState.users.set(socket.id, user);
  userRooms.set(socket.id, DEFAULT_ROOM);
  socket.join(DEFAULT_ROOM);
  socket.emit("users:list", {
    users: Array.from(roomState.users.values()),
    currentUser: user
  });
  socket.emit(SOCKET_EVENTS.FULL_STATE, {
    strokes: roomState.strokes,
    shapes: roomState.shapes,
    textElements: roomState.textElements
  });
  socket.to(DEFAULT_ROOM).emit(SOCKET_EVENTS.USER_JOINED, { user });
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] User joined: ${user.name} (Total: ${roomState.users.size})`);
  socket.on("ping", () => {
    socket.emit("pong");
  });
  socket.on(SOCKET_EVENTS.ROOM_JOIN, (data) => {
    try {
      const newRoomId = data.roomId?.trim();
      if (!newRoomId || newRoomId.length > 20) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { error: "Invalid room ID" });
        return;
      }
      const currentRoomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      const currentRoom = rooms.get(currentRoomId);
      if (currentRoom) {
        currentRoom.users.delete(socket.id);
        socket.leave(currentRoomId);
        socket.to(currentRoomId).emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id });
      }
      const newRoom = getOrCreateRoom(newRoomId);
      user.roomId = newRoomId;
      newRoom.users.set(socket.id, user);
      userRooms.set(socket.id, newRoomId);
      socket.join(newRoomId);
      socket.emit("users:list", {
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
      console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] User ${user.name} joined room: ${newRoomId}`);
    } catch (err) {
      console.error("Error joining room:", err);
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, { error: "Failed to join room" });
    }
  });
  socket.on(SOCKET_EVENTS.STROKE_START, (data) => {
    try {
      if (!isValidStrokeStart(data)) return;
      const roomState2 = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      const typedData = data;
      if (roomState2.activeStrokes.has(typedData.strokeId)) return;
      const stroke = {
        id: typedData.strokeId,
        points: [{ x: typedData.x, y: typedData.y }],
        color: typedData.color,
        width: typedData.width,
        tool: typedData.tool,
        userId: socket.id,
        timestamp: Date.now()
      };
      roomState2.activeStrokes.set(typedData.strokeId, stroke);
      socket.to(roomId).emit(SOCKET_EVENTS.STROKE_BROADCAST, { stroke });
    } catch (err) {
      console.error("Error in stroke start:", err);
    }
  });
  socket.on(SOCKET_EVENTS.STROKE_MOVE, (data) => {
    try {
      if (typeof data !== "object" || data === null) return;
      const roomState2 = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      const typedData = data;
      if (typeof typedData.strokeId !== "string" || !isValidPoint(typedData)) return;
      const stroke = roomState2.activeStrokes.get(typedData.strokeId);
      if (!stroke || stroke.userId !== socket.id) return;
      if (stroke.points.length >= MAX_POINTS_PER_STROKE) return;
      stroke.points.push({ x: typedData.x, y: typedData.y });
      socket.to(roomId).emit(SOCKET_EVENTS.STROKE_MOVE_BROADCAST, {
        strokeId: typedData.strokeId,
        userId: socket.id,
        x: typedData.x,
        y: typedData.y
      });
    } catch (err) {
      console.error("Error in stroke move:", err);
    }
  });
  socket.on(SOCKET_EVENTS.STROKE_END, (data) => {
    try {
      if (typeof data !== "object" || data === null) return;
      const roomState2 = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      const typedData = data;
      if (typeof typedData.strokeId !== "string") return;
      const stroke = roomState2.activeStrokes.get(typedData.strokeId);
      if (!stroke || stroke.userId !== socket.id) return;
      if (roomState2.strokes.length >= MAX_STROKES) {
        roomState2.strokes.shift();
      }
      roomState2.strokes.push(stroke);
      roomState2.activeStrokes.delete(typedData.strokeId);
      roomState2.redoStack = [];
      socket.to(roomId).emit(SOCKET_EVENTS.STROKE_END_BROADCAST, {
        strokeId: typedData.strokeId,
        userId: socket.id
      });
    } catch (err) {
      console.error("Error in stroke end:", err);
    }
  });
  socket.on(SOCKET_EVENTS.CURSOR_MOVE, (data) => {
    try {
      if (!isValidPoint(data)) return;
      const roomState2 = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      const currentUser = roomState2.users.get(socket.id);
      if (!currentUser) return;
      currentUser.cursor = { x: data.x, y: data.y };
      socket.to(roomId).emit(SOCKET_EVENTS.CURSOR_UPDATE, {
        userId: socket.id,
        x: currentUser.cursor.x,
        y: currentUser.cursor.y,
        color: currentUser.color,
        name: currentUser.name
      });
    } catch (err) {
      console.error("Error in cursor move:", err);
    }
  });
  socket.on(SOCKET_EVENTS.SHAPE_ADD, (data) => {
    try {
      if (!data?.shape) return;
      const roomState2 = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      const shape = { ...data.shape, userId: socket.id, timestamp: Date.now() };
      if (roomState2.shapes.length >= MAX_SHAPES) {
        roomState2.shapes.shift();
      }
      roomState2.shapes.push(shape);
      roomState2.redoStack = [];
      socket.to(roomId).emit(SOCKET_EVENTS.SHAPE_BROADCAST, { shape });
    } catch (err) {
      console.error("Error adding shape:", err);
    }
  });
  socket.on(SOCKET_EVENTS.TEXT_ADD, (data) => {
    try {
      if (!data?.text) return;
      const roomState2 = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      const text = { ...data.text, userId: socket.id, timestamp: Date.now() };
      if (roomState2.textElements.length >= MAX_TEXT) {
        roomState2.textElements.shift();
      }
      roomState2.textElements.push(text);
      roomState2.redoStack = [];
      socket.to(roomId).emit(SOCKET_EVENTS.TEXT_BROADCAST, { text });
    } catch (err) {
      console.error("Error adding text:", err);
    }
  });
  socket.on(SOCKET_EVENTS.UNDO, () => {
    try {
      const roomState2 = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      if (roomState2.strokes.length === 0 && roomState2.shapes.length === 0 && roomState2.textElements.length === 0) return;
      let maxTime = 0;
      let maxType = null;
      let maxIndex = -1;
      roomState2.strokes.forEach((s, i) => {
        if (s.timestamp > maxTime) {
          maxTime = s.timestamp;
          maxType = "stroke";
          maxIndex = i;
        }
      });
      roomState2.shapes.forEach((s, i) => {
        if (s.timestamp > maxTime) {
          maxTime = s.timestamp;
          maxType = "shape";
          maxIndex = i;
        }
      });
      roomState2.textElements.forEach((t, i) => {
        if (t.timestamp > maxTime) {
          maxTime = t.timestamp;
          maxType = "text";
          maxIndex = i;
        }
      });
      let removed;
      if (maxType === "stroke" && maxIndex !== -1) {
        removed = roomState2.strokes.splice(maxIndex, 1)[0];
      } else if (maxType === "shape" && maxIndex !== -1) {
        removed = roomState2.shapes.splice(maxIndex, 1)[0];
      } else if (maxType === "text" && maxIndex !== -1) {
        removed = roomState2.textElements.splice(maxIndex, 1)[0];
      }
      if (removed) {
        roomState2.redoStack.push([removed]);
        if (roomState2.redoStack.length > MAX_UNDO_STACK) {
          roomState2.redoStack.shift();
        }
      }
      io.to(roomId).emit(SOCKET_EVENTS.UNDO_REDO_BROADCAST, {
        strokes: roomState2.strokes,
        shapes: roomState2.shapes,
        textElements: roomState2.textElements,
        action: "undo"
      });
    } catch (err) {
      console.error("Error in undo:", err);
    }
  });
  socket.on(SOCKET_EVENTS.REDO, () => {
    try {
      const roomState2 = getUserRoom(socket.id);
      const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
      if (roomState2.redoStack.length === 0) return;
      const redoItems = roomState2.redoStack.pop();
      if (redoItems) {
        for (const item of redoItems) {
          if (typeof item.timestamp !== "number" || item.timestamp <= 0) {
            console.warn("Skipping redo item with invalid timestamp");
            continue;
          }
          if ("points" in item && Array.isArray(item.points)) {
            const stroke = item;
            const insertIndex = roomState2.strokes.findIndex((s) => s.timestamp > stroke.timestamp);
            if (insertIndex === -1) {
              roomState2.strokes.push(stroke);
            } else {
              roomState2.strokes.splice(insertIndex, 0, stroke);
            }
          } else if ("startPoint" in item && "endPoint" in item) {
            const shape = item;
            const insertIndex = roomState2.shapes.findIndex((s) => s.timestamp > shape.timestamp);
            if (insertIndex === -1) {
              roomState2.shapes.push(shape);
            } else {
              roomState2.shapes.splice(insertIndex, 0, shape);
            }
          } else if ("text" in item && "position" in item) {
            const text = item;
            const insertIndex = roomState2.textElements.findIndex((t) => t.timestamp > text.timestamp);
            if (insertIndex === -1) {
              roomState2.textElements.push(text);
            } else {
              roomState2.textElements.splice(insertIndex, 0, text);
            }
          } else {
            console.warn("Redo item did not match any known type:", Object.keys(item));
          }
        }
      }
      io.to(roomId).emit(SOCKET_EVENTS.UNDO_REDO_BROADCAST, {
        strokes: roomState2.strokes,
        shapes: roomState2.shapes,
        textElements: roomState2.textElements,
        action: "redo"
      });
    } catch (err) {
      console.error("Error in redo:", err);
    }
  });
  socket.on(SOCKET_EVENTS.REQUEST_STATE, () => {
    const roomState2 = getUserRoom(socket.id);
    socket.emit(SOCKET_EVENTS.FULL_STATE, {
      strokes: roomState2.strokes,
      shapes: roomState2.shapes,
      textElements: roomState2.textElements
    });
  });
  socket.on("disconnect", (reason) => {
    const roomId = userRooms.get(socket.id) || DEFAULT_ROOM;
    const roomState2 = rooms.get(roomId);
    if (roomState2) {
      const currentUser = roomState2.users.get(socket.id);
      if (currentUser) {
        console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] User left: ${currentUser.name} (${reason})`);
        roomState2.users.delete(socket.id);
        for (const [strokeId, stroke] of roomState2.activeStrokes) {
          if (stroke.userId === socket.id) {
            roomState2.strokes.push(stroke);
            roomState2.activeStrokes.delete(strokeId);
          }
        }
        socket.to(roomId).emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id });
        if (roomState2.users.size === 0 && roomId !== DEFAULT_ROOM) {
          rooms.delete(roomId);
          console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] Room deleted: ${roomId}`);
        }
      }
    }
    userRooms.delete(socket.id);
  });
  socket.on("error", (err) => {
    console.error("Socket error:", err);
  });
});
httpServer.listen(PORT, () => {
  console.log(`
  ========================================
   Collaborative Canvas Server (Production)
  ========================================
   Running on port ${PORT}
   Mode: ${process.env.NODE_ENV || "production"}
   Health: http://localhost:${PORT}/health
   Client: http://localhost:${PORT}
   Max Strokes: ${MAX_STROKES}
   Max Undo: ${MAX_UNDO_STACK}
  ========================================
  `);
});
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down...");
  io.close(() => {
    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
});
