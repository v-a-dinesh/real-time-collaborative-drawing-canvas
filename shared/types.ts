/**
 * Shared TypeScript types for client and server
 */

// Basic point structure
export interface Point {
  x: number;
  y: number;
}

// Tool types including shapes
export type ToolType = 'brush' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text';

// Shape representation
export interface Shape {
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

// Text element representation
export interface TextElement {
  id: string;
  position: Point;
  text: string;
  color: string;
  fontSize: number;
  userId: string;
  timestamp: number;
}

// Stroke/Line representation
export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: 'brush' | 'eraser';
  userId: string;
  timestamp: number;
}

// User representation
export interface User {
  id: string;
  name: string;
  color: string;
  cursor: Point;
  roomId?: string;
}

// Room representation
export interface Room {
  id: string;
  name: string;
  users: User[];
  createdAt: number;
}

// Drawing state for the canvas
export interface DrawingState {
  strokes: Stroke[];
  shapes: Shape[];
  textElements: TextElement[];
  users: User[];
  undoStack: (Stroke | Shape | TextElement)[][];
  redoStack: (Stroke | Shape | TextElement)[][];
}

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

  // Shape events
  SHAPE_ADD: 'shape:add',
  SHAPE_BROADCAST: 'shape:broadcast',

  // Text events
  TEXT_ADD: 'text:add',
  TEXT_BROADCAST: 'text:broadcast',

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
  CLEAR_CANVAS: 'canvas:clear',

  // Room events
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_CREATED: 'room:created',
  ROOM_JOINED: 'room:joined',
  ROOM_LEFT: 'room:left',
  ROOM_LIST: 'room:list',
  ROOM_ERROR: 'room:error'
} as const;

// Default values
export const DEFAULTS = {
  COLOR: '#000000',
  STROKE_WIDTH: 5,
  TOOL: 'brush' as const,
  FONT_SIZE: 24,
  ROOM_ID: 'default'
};