import { useCallback, useRef, useState } from 'react';

type Point = { x: number; y: number };

type PointerSnapshot = {
  point: Point;
  pointerType: string;
};

export function useCanvasViewport() {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [inputMode, setInputMode] = useState<'touch' | 'pencil' | 'mouse'>('touch');
  const pointers = useRef(new Map<number, PointerSnapshot>());
  const lastPinchDistance = useRef<number | null>(null);
  const lastCenter = useRef<Point | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const pointerType = event.pointerType === 'pen' ? 'pencil' : event.pointerType === 'mouse' ? 'mouse' : 'touch';
    setInputMode(pointerType);
    pointers.current.set(event.pointerId, {
      point: { x: event.clientX, y: event.clientY },
      pointerType: event.pointerType,
    });
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const existing = pointers.current.get(event.pointerId);
    if (!existing) return;

    const previousPoint = existing.point;
    const nextPoint = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, { ...existing, point: nextPoint });

    const active = [...pointers.current.values()];
    if (active.length >= 2) {
      const [a, b] = active;
      const distance = Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y);
      const center = {
        x: (a.point.x + b.point.x) / 2,
        y: (a.point.y + b.point.y) / 2,
      };

      if (lastPinchDistance.current !== null) {
        const ratio = distance / lastPinchDistance.current;
        setZoom((current) => Math.min(4, Math.max(0.35, current * ratio)));
      }

      if (lastCenter.current) {
        setOffset((current) => ({
          x: current.x + center.x - lastCenter.current!.x,
          y: current.y + center.y - lastCenter.current!.y,
        }));
      }

      lastPinchDistance.current = distance;
      lastCenter.current = center;
      return;
    }

    lastPinchDistance.current = null;
    lastCenter.current = null;

    if (event.pointerType === 'touch' || event.pointerType === 'mouse') {
      setOffset((current) => ({
        x: current.x + nextPoint.x - previousPoint.x,
        y: current.y + nextPoint.y - previousPoint.y,
      }));
    }
  }, []);

  const releasePointer = useCallback((event: React.PointerEvent<HTMLElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      lastPinchDistance.current = null;
      lastCenter.current = null;
    }
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  return {
    zoom,
    offset,
    inputMode,
    resetView,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: releasePointer,
      onPointerCancel: releasePointer,
    },
  };
}
