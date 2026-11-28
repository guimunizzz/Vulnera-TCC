/**
 * Posiciona a Vuvu somente por arraste ou teclado, sem passeio ou inércia.
 * Consumido pelo launcher; captura o ponteiro e mantém a personagem dentro da viewport.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useMotionValue } from "motion/react";
import { useMotion } from "../../motion/use-motion";

export const ASSISTANT_FOOTPRINT = { width: 112, height: 128 } as const;
const MARGIN = 16;
const DRAG_THRESHOLD = 6;

function visibleViewport() {
  return {
    width: Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth, window.visualViewport?.width ?? Infinity),
    height: Math.min(window.innerHeight, document.documentElement.clientHeight || window.innerHeight, window.visualViewport?.height ?? Infinity),
  };
}

export function assistantBounds(width: number, height: number) {
  const left = Math.min(MARGIN, Math.max(0, width - ASSISTANT_FOOTPRINT.width));
  const top = Math.min(MARGIN, Math.max(0, height - ASSISTANT_FOOTPRINT.height));
  return { left, top, right: Math.max(left, width - ASSISTANT_FOOTPRINT.width - MARGIN), bottom: Math.max(top, height - ASSISTANT_FOOTPRINT.height - MARGIN) };
}

interface Gesture {
  id: number; startX: number; startY: number; x: number; y: number;
  target: HTMLButtonElement; dragged: boolean; lastX: number;
}

export function useAssistantMotion(blocked: boolean) {
  const { reduzido } = useMotion();
  const viewport = visibleViewport();
  const initial = assistantBounds(viewport.width, viewport.height);
  const x = useMotionValue(initial.right);
  const y = useMotionValue(initial.bottom);
  const [hidden, setHidden] = useState(document.hidden);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const movingLeft = useRef(false);

  const finish = useCallback(() => {
    const current = gesture.current;
    gesture.current = null;
    if (current) {
      suppressClick.current = current.dragged;
      if (current.target.hasPointerCapture?.(current.id)) current.target.releasePointerCapture(current.id);
    }
    setDragging(false);
  }, []);

  const place = useCallback((nextX: number, nextY: number) => {
    const currentViewport = visibleViewport();
    const bounds = assistantBounds(currentViewport.width, currentViewport.height);
    x.set(Math.max(bounds.left, Math.min(bounds.right, nextX)));
    y.set(Math.max(bounds.top, Math.min(bounds.bottom, nextY)));
  }, [x, y]);

  useEffect(() => {
    const resize = () => { finish(); place(x.get(), y.get()); };
    const visibility = () => { if (document.hidden) finish(); setHidden(document.hidden); };
    window.addEventListener("resize", resize);
    window.addEventListener("blur", finish);
    window.visualViewport?.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", finish);
      window.visualViewport?.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      const current = gesture.current;
      gesture.current = null;
      if (current?.target.hasPointerCapture?.(current.id)) current.target.releasePointerCapture(current.id);
    };
  }, [finish, place, x, y]);

  useEffect(() => { if (blocked) finish(); }, [blocked, finish]);

  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId || blocked || document.hidden) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!current.dragged) { current.dragged = true; setDragging(true); }
    movingLeft.current = event.clientX < current.lastX;
    current.lastX = event.clientX;
    place(current.x + dx, current.y + dy);
  }

  return {
    x, y, dragging, movingLeft: () => movingLeft.current, suppressClick: () => suppressClick.current,
    reasons: [...(reduzido ? ["reduced"] : []), ...(hidden ? ["hidden"] : []), ...(blocked ? ["modal"] : [])],
    state: dragging ? "dragging" : "static",
    moveBy: (dx: number, dy: number) => { if (!blocked && !document.hidden) place(x.get() + dx, y.get() + dy); },
    reset: () => { if (!blocked) { const currentViewport = visibleViewport(); const bounds = assistantBounds(currentViewport.width, currentViewport.height); place(bounds.right, bounds.bottom); } },
    handlers: {
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (blocked || document.hidden || event.button !== 0 || event.isPrimary === false || gesture.current) return;
        suppressClick.current = false;
        gesture.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: x.get(), y: y.get(), target: event.currentTarget, dragged: false, lastX: event.clientX };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: pointerMove,
      onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (gesture.current?.id !== event.pointerId) return;
        pointerMove(event);
        if (gesture.current?.dragged) event.preventDefault();
        finish();
      },
      onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => { if (gesture.current?.id === event.pointerId) finish(); },
      onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => { if (gesture.current?.id === event.pointerId) finish(); },
    },
  };
}
