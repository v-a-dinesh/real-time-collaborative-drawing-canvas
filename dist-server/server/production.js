/**
 * Production Server Entry Point
 * Serves both the static client files and WebSocket connections
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { SOCKET_EVENTS } from '../shared/types';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Environment configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_STROKES = parseInt(process.env.MAX_STROKES || '5000', 10);
const MAX_UNDO_HISTORY = parseInt(process.env.MAX_UNDO_HISTORY || '50', 10);
const MAX_USERS = parseInt(process.env.MAX_USERS || '100', 10);
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: CORS_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10)
});
// Serve static files from the built client
// In production: dist-server/server/production.js -> dist/client
const clientPath = path.join(__dirname, '..', '..', 'dist', 'client');
app.use(express.static(clientPath));
// Health check endpoint
app.get('/health', (_, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connections: io.engine.clientsCount,
        strokes: state.strokes.length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
    });
});
// API info endpoint
app.get('/api/info', (_, res) => {
    res.json({
        name: 'Collaborative Canvas',
        version: '1.0.0',
        maxStrokes: MAX_STROKES,
        maxUndoHistory: MAX_UNDO_HISTORY,
        maxUsers: MAX_USERS,
        currentUsers: state.users.size
    });
});
// SPA fallback - serve index.html for all other routes
app.get('*', (_, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});
const state = {
    strokes: [],
    undoStack: [],
    redoStack: [],
    users: new Map(),
    activeStrokes: new Map()
};
// ========================================
// Validation Helpers
// ========================================
function isValidPoint(point) {
    if (!point || typeof point !== 'object')
        return false;
    const p = point;
    return typeof p.x === 'number' && typeof p.y === 'number' &&
        isFinite(p.x) && isFinite(p.y);
}
function isValidStroke(stroke) {
    if (!stroke || typeof stroke !== 'object')
        return false;
    const s = stroke;
    return typeof s.id === 'string' &&
        typeof s.color === 'string' &&
        typeof s.width === 'number' &&
        typeof s.tool === 'string' &&
        Array.isArray(s.points) &&
        s.points.every(isValidPoint);
}
function sanitizeString(str, maxLength = 50) {
    return String(str).slice(0, maxLength).replace(/[<>]/g, '');
}
// ========================================
// User Management
// ========================================
const adjectives = ['Quick', 'Creative', 'Artistic', 'Clever', 'Bold', 'Swift', 'Bright', 'Wild'];
const nouns = ['Painter', 'Artist', 'Sketcher', 'Drawer', 'Creator', 'Designer', 'Doodler', 'Illustrator'];
function generateUsername() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}${noun}${num}`;
}
function generateColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    return colors[Math.floor(Math.random() * colors.length)];
}
// ========================================
// Socket Event Handlers
// ========================================
io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] New connection: ${socket.id}`);
    // Check user limit
    if (state.users.size >= MAX_USERS) {
        socket.emit('error', { message: 'Server is full. Please try again later.' });
        socket.disconnect();
        return;
    }
    // Create new user
    const user = {
        id: socket.id,
        name: generateUsername(),
        color: generateColor(),
        cursor: { x: 0, y: 0 }
    };
    state.users.set(socket.id, user);
    console.log(`[${new Date().toISOString()}] User joined: ${user.name} (Total: ${state.users.size})`);
    // Send initial state to new user
    socket.emit(SOCKET_EVENTS.USER_JOINED, user);
    socket.emit(SOCKET_EVENTS.FULL_STATE, {
        strokes: state.strokes,
        users: Array.from(state.users.values())
    });
    // Broadcast new user to others
    socket.broadcast.emit(SOCKET_EVENTS.USER_JOINED, user);
    // Handle cursor movement
    socket.on(SOCKET_EVENTS.CURSOR_MOVE, (position) => {
        if (!isValidPoint(position))
            return;
        const currentUser = state.users.get(socket.id);
        if (currentUser) {
            currentUser.cursor = position;
            socket.broadcast.emit(SOCKET_EVENTS.CURSOR_MOVE, {
                userId: socket.id,
                position: currentUser.cursor
            });
        }
    });
    // Handle stroke start
    socket.on(SOCKET_EVENTS.STROKE_START, (data) => {
        if (!data || typeof data !== 'object')
            return;
        const strokeData = data;
        const stroke = {
            id: String(strokeData.id || `${socket.id}-${Date.now()}`),
            userId: socket.id,
            points: [],
            color: sanitizeString(String(strokeData.color || '#000000'), 20),
            width: Math.max(1, Math.min(50, Number(strokeData.width) || 5)),
            tool: strokeData.tool === 'eraser' ? 'eraser' : 'brush',
            timestamp: Date.now()
        };
        state.activeStrokes.set(socket.id, stroke);
        socket.broadcast.emit(SOCKET_EVENTS.STROKE_START, stroke);
    });
    // Handle stroke update
    socket.on(SOCKET_EVENTS.STROKE_UPDATE, (data) => {
        if (!data || typeof data !== 'object')
            return;
        const updateData = data;
        const activeStroke = state.activeStrokes.get(socket.id);
        if (activeStroke && isValidPoint(updateData.point)) {
            activeStroke.points.push(updateData.point);
            socket.broadcast.emit(SOCKET_EVENTS.STROKE_UPDATE, {
                userId: socket.id,
                point: updateData.point
            });
        }
    });
    // Handle stroke end
    socket.on(SOCKET_EVENTS.STROKE_END, () => {
        const activeStroke = state.activeStrokes.get(socket.id);
        if (activeStroke && activeStroke.points.length > 0) {
            // Check stroke limit
            if (state.strokes.length >= MAX_STROKES) {
                state.strokes = state.strokes.slice(-Math.floor(MAX_STROKES * 0.8));
            }
            state.strokes.push(activeStroke);
            state.undoStack.push([activeStroke]);
            if (state.undoStack.length > MAX_UNDO_HISTORY) {
                state.undoStack.shift();
            }
            state.redoStack = [];
            socket.broadcast.emit(SOCKET_EVENTS.STROKE_END, { userId: socket.id });
        }
        state.activeStrokes.delete(socket.id);
    });
    // Handle global undo
    socket.on(SOCKET_EVENTS.UNDO, () => {
        if (state.undoStack.length > 0) {
            const undoneStrokes = state.undoStack.pop();
            state.redoStack.push(undoneStrokes);
            for (const stroke of undoneStrokes) {
                const index = state.strokes.findIndex(s => s.id === stroke.id);
                if (index !== -1) {
                    state.strokes.splice(index, 1);
                }
            }
            io.emit(SOCKET_EVENTS.FULL_STATE, {
                strokes: state.strokes,
                users: Array.from(state.users.values())
            });
        }
    });
    // Handle global redo
    socket.on(SOCKET_EVENTS.REDO, () => {
        if (state.redoStack.length > 0) {
            const redoneStrokes = state.redoStack.pop();
            state.undoStack.push(redoneStrokes);
            state.strokes.push(...redoneStrokes);
            io.emit(SOCKET_EVENTS.FULL_STATE, {
                strokes: state.strokes,
                users: Array.from(state.users.values())
            });
        }
    });
    // Handle clear canvas
    socket.on(SOCKET_EVENTS.CLEAR_CANVAS, () => {
        if (state.strokes.length > 0) {
            state.undoStack.push([...state.strokes]);
            if (state.undoStack.length > MAX_UNDO_HISTORY) {
                state.undoStack.shift();
            }
        }
        state.strokes = [];
        state.redoStack = [];
        io.emit(SOCKET_EVENTS.CLEAR_CANVAS);
    });
    // Handle disconnect
    socket.on('disconnect', (reason) => {
        const user = state.users.get(socket.id);
        if (user) {
            console.log(`[${new Date().toISOString()}] User left: ${user.name} (Reason: ${reason})`);
        }
        state.users.delete(socket.id);
        state.activeStrokes.delete(socket.id);
        io.emit(SOCKET_EVENTS.USER_LEFT, socket.id);
        console.log(`[${new Date().toISOString()}] Remaining users: ${state.users.size}`);
    });
});
// ========================================
// Start Server
// ========================================
httpServer.listen(PORT, () => {
    console.log(`
  ========================================
   Collaborative Canvas Server
  ========================================
   Running on port ${PORT}
   Mode: ${process.env.NODE_ENV || 'development'}
   Health: http://localhost:${PORT}/health
   Max Strokes: ${MAX_STROKES}
   Max Undo: ${MAX_UNDO_HISTORY}
   Max Users: ${MAX_USERS}
  ========================================
  `);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    httpServer.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    httpServer.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
