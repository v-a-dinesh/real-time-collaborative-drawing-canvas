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
  
  return stroke;
}

/**
 * Perform undo operation - removes most recent item across all types by timestamp
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
  
  return {
    strokes: roomState.strokes,
    shapes: roomState.shapes,
    textElements: roomState.textElements
  };
}

/**
 * Perform redo operation - restores items in correct timestamp order
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
      // Validate item has a timestamp
      if (typeof item.timestamp !== 'number' || item.timestamp <= 0) {
        console.warn('Skipping redo item with invalid timestamp');
        continue;
      }
      
      // Type detection and insert in correct position based on timestamp
      if ('points' in item && Array.isArray((item as Stroke).points)) {
        const stroke = item as Stroke;
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
  roomState.redoStack = [];
  roomState.activeStrokes.clear();
}
