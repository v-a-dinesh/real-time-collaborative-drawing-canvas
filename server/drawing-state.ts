/**
 * Drawing State Manager - Manages canvas state per room
 * Handles strokes, shapes, text elements, and undo/redo stacks
 */

import { Stroke, Shape, TextElement, User } from '../shared/types';

// Limits for memory management
export const MAX_STROKES = 5000;
export const MAX_SHAPES = 1000;
export const MAX_TEXT = 500;
export const MAX_POINTS_PER_STROKE = 10000;
export const MAX_UNDO_STACK = 50;

/**
 * Room state interface containing all drawing data
 */
export interface RoomState {
  strokes: Stroke[];
  shapes: Shape[];
  textElements: TextElement[];
  undoStack: (Stroke | Shape | TextElement)[][];
  redoStack: (Stroke | Shape | TextElement)[][];
  users: Map<string, User>;
  activeStrokes: Map<string, Stroke>;
}

/**
 * Create an empty room state
 */
export function createEmptyRoomState(): RoomState {
  return {
    strokes: [],
    shapes: [],
    textElements: [],
    undoStack: [],
    redoStack: [],
    users: new Map(),
    activeStrokes: new Map()
  };
}

/**
 * Add a stroke to room state
 */
export function addStroke(roomState: RoomState, stroke: Stroke): void {
  if (roomState.strokes.length >= MAX_STROKES) {
    roomState.strokes.shift(); // Remove oldest
  }
  roomState.strokes.push(stroke);
  roomState.redoStack = []; // Clear redo stack on new action
}

/**
 * Add a shape to room state
 */
export function addShape(roomState: RoomState, shape: Shape): void {
  if (roomState.shapes.length >= MAX_SHAPES) {
    roomState.shapes.shift();
  }
  roomState.shapes.push(shape);
  roomState.redoStack = [];
}

/**
 * Add a text element to room state
 */
export function addText(roomState: RoomState, text: TextElement): void {
  if (roomState.textElements.length >= MAX_TEXT) {
    roomState.textElements.shift();
  }
  roomState.textElements.push(text);
  roomState.redoStack = [];
}

/**
 * Start a new active stroke
 */
export function startActiveStroke(roomState: RoomState, stroke: Stroke): boolean {
  if (roomState.activeStrokes.has(stroke.id)) {
    return false; // Duplicate
  }
  roomState.activeStrokes.set(stroke.id, stroke);
  return true;
}

/**
 * Add point to active stroke
 */
export function addPointToActiveStroke(
  roomState: RoomState,
  strokeId: string,
  point: { x: number; y: number },
  userId: string
): boolean {
  const stroke = roomState.activeStrokes.get(strokeId);
  if (!stroke || stroke.userId !== userId) {
    return false;
  }
  
  if (stroke.points.length >= MAX_POINTS_PER_STROKE) {
    return false;
  }
  
  stroke.points.push(point);
  return true;
}

/**
 * Finalize an active stroke
 */
export function endActiveStroke(
  roomState: RoomState,
  strokeId: string,
  userId: string
): Stroke | null {
  const stroke = roomState.activeStrokes.get(strokeId);
  if (!stroke || stroke.userId !== userId) {
    return null;
  }
  
  roomState.activeStrokes.delete(strokeId);
  addStroke(roomState, stroke);
  
  // Trim undo stack
  if (roomState.undoStack.length > MAX_UNDO_STACK) {
    roomState.undoStack.shift();
  }
  
  return stroke;
}

/**
 * Perform undo operation - removes most recent item across all types
 * Returns the updated state or null if nothing to undo
 */
export function performUndo(roomState: RoomState): {
  strokes: Stroke[];
  shapes: Shape[];
  textElements: TextElement[];
} | null {
  if (
    roomState.strokes.length === 0 &&
    roomState.shapes.length === 0 &&
    roomState.textElements.length === 0
  ) {
    return null;
  }
  
  // Find the most recent item by timestamp
  const lastStroke = roomState.strokes[roomState.strokes.length - 1];
  const lastShape = roomState.shapes[roomState.shapes.length - 1];
  const lastText = roomState.textElements[roomState.textElements.length - 1];
  
  const times = [
    lastStroke?.timestamp || 0,
    lastShape?.timestamp || 0,
    lastText?.timestamp || 0
  ];
  const maxTime = Math.max(...times);
  
  let removed: Stroke | Shape | TextElement | undefined;
  
  if (lastStroke?.timestamp === maxTime) {
    removed = roomState.strokes.pop();
  } else if (lastShape?.timestamp === maxTime) {
    removed = roomState.shapes.pop();
  } else if (lastText?.timestamp === maxTime) {
    removed = roomState.textElements.pop();
  }
  
  if (removed) {
    roomState.redoStack.push([removed]);
    if (roomState.redoStack.length > MAX_UNDO_STACK) {
      roomState.redoStack.shift();
    }
  }
  
  return {
    strokes: roomState.strokes,
    shapes: roomState.shapes,
    textElements: roomState.textElements
  };
}

/**
 * Perform redo operation
 */
export function performRedo(roomState: RoomState): {
  strokes: Stroke[];
  shapes: Shape[];
  textElements: TextElement[];
} | null {
  if (roomState.redoStack.length === 0) {
    return null;
  }
  
  const redoItems = roomState.redoStack.pop();
  if (redoItems) {
    for (const item of redoItems) {
      if ('points' in item) {
        roomState.strokes.push(item as Stroke);
      } else if ('type' in item) {
        roomState.shapes.push(item as Shape);
      } else if ('text' in item) {
        roomState.textElements.push(item as TextElement);
      }
    }
  }
  
  return {
    strokes: roomState.strokes,
    shapes: roomState.shapes,
    textElements: roomState.textElements
  };
}

/**
 * Get full state for a room (for sync)
 */
export function getFullState(roomState: RoomState): {
  strokes: Stroke[];
  shapes: Shape[];
  textElements: TextElement[];
} {
  return {
    strokes: roomState.strokes,
    shapes: roomState.shapes,
    textElements: roomState.textElements
  };
}

/**
 * Clear all drawing data in a room
 */
export function clearRoomState(roomState: RoomState): void {
  roomState.strokes = [];
  roomState.shapes = [];
  roomState.textElements = [];
  roomState.undoStack = [];
  roomState.redoStack = [];
  roomState.activeStrokes.clear();
}
