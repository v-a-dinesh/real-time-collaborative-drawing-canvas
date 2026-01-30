/**
 * Shared TypeScript types for client and server
 */
// Socket event names
export const SOCKET_EVENTS = {
    // Connection
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    // User events
    USER_JOINED: 'user:joined',
    USER_LEFT: 'user:left',
    USERS_LIST: 'users:list',
    // Drawing events (client to server)
    STROKE_START: 'stroke:start',
    STROKE_MOVE: 'stroke:move',
    STROKE_UPDATE: 'stroke:update',
    STROKE_END: 'stroke:end',
    // Drawing events (server to clients)
    STROKE_BROADCAST: 'stroke:broadcast',
    STROKE_MOVE_BROADCAST: 'stroke:move:broadcast',
    STROKE_END_BROADCAST: 'stroke:end:broadcast',
    // Cursor events
    CURSOR_MOVE: 'cursor:move',
    CURSOR_UPDATE: 'cursor:update',
    // State sync
    REQUEST_STATE: 'state:request',
    FULL_STATE: 'state:full',
    // Undo/Redo
    UNDO: 'undo',
    REDO: 'redo',
    UNDO_REDO_BROADCAST: 'undo:redo:broadcast',
    // Canvas clear
    CLEAR_CANVAS: 'canvas:clear'
};
// Default values
export const DEFAULTS = {
    COLOR: '#000000',
    STROKE_WIDTH: 5,
    TOOL: 'brush'
};
