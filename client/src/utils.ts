/**
 * Utility functions for canvas coordinate mapping and helpers
 */

import { Point } from '../../shared/types';

export function getCanvasCoordinates(
  event: MouseEvent | TouchEvent,
  canvas: HTMLCanvasElement
): Point {
  const rect = canvas.getBoundingClientRect();
  let clientX: number;
  let clientY: number;
  
  if (event instanceof TouchEvent) {
    const touch = event.touches[0] || event.changedTouches[0];
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }
  
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function throttle<T extends (...args: unknown[]) => void>(
  func: T, limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  
  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

export function midPoint(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function formatCoordinates(point: Point): string {
  return `X: ${Math.round(point.x)}, Y: ${Math.round(point.y)}`;
}
