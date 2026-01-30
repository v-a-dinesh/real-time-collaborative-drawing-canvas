/**
 * Collaborative Canvas Server - Enhanced with validation and error handling
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { SOCKET_EVENTS } from '../shared/types';
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
// Health check with detailed status
app.get('/health', (_, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connections: io.engine.clientsCount,
        strokes: state.strokes.length,
        uptime: process.uptime()
    });
});
const state = {
    strokes: [],
    undoStack: [],
    redoStack: [],
    users: new Map(),
    activeStrokes: new Map()
};
const MAX_STROKES = 5000;
const MAX_POINTS_PER_STROKE = 10000;
const MAX_UNDO_STACK = 50;
const userColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
    '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6'
];
let colorIndex = 0;
function getNextColor() {
    const color = userColors[colorIndex % userColors.length];
    colorIndex++;
    return color;
}
function generateUserName() {
    const adjectives = ['Happy', 'Swift', 'Clever', 'Bright', 'Cool', 'Wild', 'Calm', 'Bold', 'Keen', 'Quick'];
    const nouns = ['Artist', 'Painter', 'Creator', 'Drawer', 'Sketcher', 'Designer', 'Doodler', 'Illustrator'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return adj + noun + Math.floor(Math.random() * 100);
}
// Validate point data
function isValidPoint(data) {
    return typeof data === 'object' &&
        typeof data.x === 'number' &&
        typeof data.y === 'number' &&
        isFinite(data.x) && isFinite(data.y) &&
        data.x >= -10000 && data.x <= 10000 &&
        data.y >= -10000 && data.y <= 10000;
}
// Validate stroke start data
function isValidStrokeStart(data) {
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
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    const user = {
        id: socket.id,
        name: generateUserName(),
        color: getNextColor(),
        cursor: { x: 0, y: 0 }
    };
    state.users.set(socket.id, user);
    // Send user list
    socket.emit('users:list', {
        users: Array.from(state.users.values()),
        currentUser: user
    });
    // Send current state
    socket.emit(SOCKET_EVENTS.FULL_STATE, {
        strokes: state.strokes
    });
    // Notify others
    socket.broadcast.emit(SOCKET_EVENTS.USER_JOINED, { user });
    console.log('User joined:', user.name, 'Total users:', state.users.size);
    // ========================================
    // Drawing Events with Validation
    // ========================================
    socket.on(SOCKET_EVENTS.STROKE_START, (data) => {
        try {
            if (!isValidStrokeStart(data)) {
                console.warn('Invalid stroke start data from', socket.id);
                return;
            }
            const typedData = data;
            // Check for duplicate stroke ID
            if (state.activeStrokes.has(typedData.strokeId)) {
                return;
            }
            const stroke = {
                id: typedData.strokeId,
                points: [{ x: typedData.x, y: typedData.y }],
                color: typedData.color,
                width: typedData.width,
                tool: typedData.tool,
                userId: socket.id,
                timestamp: Date.now()
            };
            state.activeStrokes.set(typedData.strokeId, stroke);
            socket.broadcast.emit(SOCKET_EVENTS.STROKE_BROADCAST, { stroke });
        }
        catch (err) {
            console.error('Error in stroke start:', err);
        }
    });
    socket.on(SOCKET_EVENTS.STROKE_MOVE, (data) => {
        try {
            if (typeof data !== 'object' || data === null)
                return;
            const typedData = data;
            if (typeof typedData.strokeId !== 'string' || !isValidPoint(typedData)) {
                return;
            }
            const stroke = state.activeStrokes.get(typedData.strokeId);
            if (!stroke || stroke.userId !== socket.id)
                return;
            // Limit points per stroke
            if (stroke.points.length >= MAX_POINTS_PER_STROKE)
                return;
            stroke.points.push({ x: typedData.x, y: typedData.y });
            socket.broadcast.emit(SOCKET_EVENTS.STROKE_MOVE_BROADCAST, {
                strokeId: typedData.strokeId,
                userId: socket.id,
                x: typedData.x,
                y: typedData.y
            });
        }
        catch (err) {
            console.error('Error in stroke move:', err);
        }
    });
    socket.on(SOCKET_EVENTS.STROKE_END, (data) => {
        try {
            if (typeof data !== 'object' || data === null)
                return;
            const typedData = data;
            if (typeof typedData.strokeId !== 'string')
                return;
            const stroke = state.activeStrokes.get(typedData.strokeId);
            if (!stroke || stroke.userId !== socket.id)
                return;
            // Move to completed strokes
            if (state.strokes.length >= MAX_STROKES) {
                state.strokes.shift(); // Remove oldest
            }
            state.strokes.push(stroke);
            state.activeStrokes.delete(typedData.strokeId);
            state.redoStack = [];
            // Trim undo stack
            if (state.undoStack.length > MAX_UNDO_STACK) {
                state.undoStack.shift();
            }
            socket.broadcast.emit(SOCKET_EVENTS.STROKE_END_BROADCAST, {
                strokeId: typedData.strokeId,
                userId: socket.id
            });
        }
        catch (err) {
            console.error('Error in stroke end:', err);
        }
    });
    // ========================================
    // Cursor Events
    // ========================================
    socket.on(SOCKET_EVENTS.CURSOR_MOVE, (data) => {
        try {
            if (!isValidPoint(data))
                return;
            const user = state.users.get(socket.id);
            if (!user)
                return;
            user.cursor = { x: data.x, y: data.y };
            socket.broadcast.emit(SOCKET_EVENTS.CURSOR_UPDATE, {
                userId: socket.id,
                x: user.cursor.x,
                y: user.cursor.y,
                color: user.color,
                name: user.name
            });
        }
        catch (err) {
            console.error('Error in cursor move:', err);
        }
    });
    // ========================================
    // Undo/Redo (Global)
    // ========================================
    socket.on(SOCKET_EVENTS.UNDO, () => {
        try {
            if (state.strokes.length === 0)
                return;
            const removedStroke = state.strokes.pop();
            if (removedStroke) {
                state.redoStack.push([removedStroke]);
                // Limit redo stack
                if (state.redoStack.length > MAX_UNDO_STACK) {
                    state.redoStack.shift();
                }
            }
            io.emit(SOCKET_EVENTS.UNDO_REDO_BROADCAST, {
                strokes: state.strokes,
                action: 'undo'
            });
            console.log('Undo performed by', user.name, 'strokes:', state.strokes.length);
        }
        catch (err) {
            console.error('Error in undo:', err);
        }
    });
    socket.on(SOCKET_EVENTS.REDO, () => {
        try {
            if (state.redoStack.length === 0)
                return;
            const redoStrokes = state.redoStack.pop();
            if (redoStrokes) {
                state.strokes.push(...redoStrokes);
            }
            io.emit(SOCKET_EVENTS.UNDO_REDO_BROADCAST, {
                strokes: state.strokes,
                action: 'redo'
            });
            console.log('Redo performed by', user.name, 'strokes:', state.strokes.length);
        }
        catch (err) {
            console.error('Error in redo:', err);
        }
    });
    // ========================================
    // State Request
    // ========================================
    socket.on(SOCKET_EVENTS.REQUEST_STATE, () => {
        socket.emit(SOCKET_EVENTS.FULL_STATE, {
            strokes: state.strokes
        });
    });
    // ========================================
    // Disconnect
    // ========================================
    socket.on('disconnect', (reason) => {
        const user = state.users.get(socket.id);
        if (user) {
            console.log('User left:', user.name, 'Reason:', reason);
            state.users.delete(socket.id);
            // Clean up active strokes
            for (const [strokeId, stroke] of state.activeStrokes) {
                if (stroke.userId === socket.id) {
                    // Complete the stroke before removing
                    state.strokes.push(stroke);
                    state.activeStrokes.delete(strokeId);
                }
            }
            socket.broadcast.emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id });
            console.log('Remaining users:', state.users.size);
        }
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
