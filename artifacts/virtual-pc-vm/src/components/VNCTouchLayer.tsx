import { useRef, useCallback } from "react";

interface VNCTouchLayerProps {
  onMouseMove: (x: number, y: number) => void;
  onMouseClick: (x: number, y: number, button: "left" | "right") => void;
  children: React.ReactNode;
  className?: string;
}

const LONG_PRESS_DELAY = 600;

export function VNCTouchLayer({ onMouseMove, onMouseClick, children, className }: VNCTouchLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const wasMoved = useRef(false);
  const lastTouchCount = useRef(0);

  const getRelativePos = useCallback((touch: Touch) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: ((touch.clientX - rect.left) / rect.width) * 100,
      y: ((touch.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    lastTouchCount.current = e.touches.length;
    wasMoved.current = false;

    if (e.touches.length === 1) {
      const pos = getRelativePos(e.touches[0]);
      touchStartPos.current = pos;

      longPressTimer.current = setTimeout(() => {
        if (!wasMoved.current) {
          onMouseClick(pos.x, pos.y, "right");
        }
      }, LONG_PRESS_DELAY);
    }

    if (e.touches.length >= 2) {
      clearLongPress();
    }
  }, [getRelativePos, onMouseClick]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const pos = getRelativePos(e.touches[0]);
      const start = touchStartPos.current;
      if (start) {
        const dist = Math.hypot(pos.x - start.x, pos.y - start.y);
        if (dist > 1.5) {
          wasMoved.current = true;
          clearLongPress();
        }
      }
      onMouseMove(pos.x, pos.y);
    }
  }, [getRelativePos, onMouseMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearLongPress();

    if (e.changedTouches.length === 1 && !wasMoved.current && lastTouchCount.current === 1) {
      const pos = getRelativePos(e.changedTouches[0]);
      onMouseClick(pos.x, pos.y, "left");
    }

    touchStartPos.current = null;
  }, [getRelativePos, onMouseClick]);

  return (
    <div
      ref={containerRef}
      className={`touch-none select-none ${className ?? ""}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
}
