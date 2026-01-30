/**
 * Room Manager - Handles room creation, joining, and isolation
 * Separated for cleaner architecture as per assignment requirements
 */

import { User, SOCKET_EVENTS } from '../shared/types';
import { RoomState, createEmptyRoomState } from './drawing-state';

const DEFAULT_ROOM = 'default';

// Room storage
const rooms: Map<string, RoomState> = new Map();
const userRooms: Map<string, string> = new Map(); // socketId -> roomId

/**
 * Get or create a room by ID
 */
export function getOrCreateRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createEmptyRoomState());
    console.log('Room created:', roomId);
  }
  return rooms.get(roomId)!;
}

/**
 * Get room state for a user's current room
 */
export function getUserRoom(socketId: string): RoomState {
  const roomId = userRooms.get(socketId) || DEFAULT_ROOM;
  return getOrCreateRoom(roomId);
}

/**
 * Get the room ID for a user
 */
export function getUserRoomId(socketId: string): string {
  return userRooms.get(socketId) || DEFAULT_ROOM;
}

/**
 * Add user to a room
 */
export function addUserToRoom(socketId: string, roomId: string, user: User): void {
  const roomState = getOrCreateRoom(roomId);
  roomState.users.set(socketId, user);
  userRooms.set(socketId, roomId);
}

/**
 * Remove user from their current room
 */
export function removeUserFromRoom(socketId: string): { roomId: string; roomState: RoomState | undefined; user: User | undefined } {
  const roomId = userRooms.get(socketId) || DEFAULT_ROOM;
  const roomState = rooms.get(roomId);
  
  let user: User | undefined;
  
  if (roomState) {
    user = roomState.users.get(socketId);
    roomState.users.delete(socketId);
    
    // Clean up any active strokes from this user
    for (const [strokeId, stroke] of roomState.activeStrokes) {
      if (stroke.userId === socketId) {
        // Complete the stroke before removing
        roomState.strokes.push(stroke);
        roomState.activeStrokes.delete(strokeId);
      }
    }
    
    // Clean up empty rooms (except default)
    if (roomState.users.size === 0 && roomId !== DEFAULT_ROOM) {
      rooms.delete(roomId);
      console.log('Room deleted (empty):', roomId);
    }
  }
  
  userRooms.delete(socketId);
  
  return { roomId, roomState, user };
}

/**
 * Move user from one room to another
 */
export function moveUserToRoom(socketId: string, newRoomId: string, user: User): {
  oldRoomId: string;
  newRoomState: RoomState;
} {
  const oldRoomId = userRooms.get(socketId) || DEFAULT_ROOM;
  
  // Leave old room
  const oldRoom = rooms.get(oldRoomId);
  if (oldRoom) {
    oldRoom.users.delete(socketId);
    
    // Clean up empty rooms (except default)
    if (oldRoom.users.size === 0 && oldRoomId !== DEFAULT_ROOM) {
      rooms.delete(oldRoomId);
      console.log('Room deleted (empty):', oldRoomId);
    }
  }
  
  // Join new room
  const newRoomState = getOrCreateRoom(newRoomId);
  user.roomId = newRoomId;
  newRoomState.users.set(socketId, user);
  userRooms.set(socketId, newRoomId);
  
  return { oldRoomId, newRoomState };
}

/**
 * Get statistics about rooms
 */
export function getRoomStats(): { totalRooms: number; totalUsers: number } {
  let totalUsers = 0;
  for (const room of rooms.values()) {
    totalUsers += room.users.size;
  }
  return {
    totalRooms: rooms.size,
    totalUsers
  };
}

/**
 * Get all rooms (for debugging/admin)
 */
export function getAllRooms(): Map<string, RoomState> {
  return rooms;
}

/**
 * Check if room exists
 */
export function roomExists(roomId: string): boolean {
  return rooms.has(roomId);
}

/**
 * Get default room ID
 */
export function getDefaultRoom(): string {
  return DEFAULT_ROOM;
}

export { DEFAULT_ROOM };
