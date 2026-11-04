/**
 * Passeio lento pelas bordas, com valores Motion em vez de renders a cada quadro.
 * Consumido pelo mascote; mantém limites da viewport e cancela animações/timers nas pausas.
 */
import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue } from "motion/react";
import { useMotion } from "../../motion/use-motion";

const WIDTH = 116;
const HEIGHT = 88;
const MARGIN = 16;

function visibleViewport() {
  return {
    width: Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth),
    height: Math.min(window.innerHeight, document.documentElement.clientHeight || window.innerHeight),
  };
}

export function assistantBounds(width: number, height: number) {
  return {
    right: Math.max(0, width - WIDTH - MARGIN),
    bottom: Math.max(0, height - HEIGHT - MARGIN),
    top: Math.min(128, Math.max(0, height - HEIGHT - MARGIN)),
    middle: Math.max(MARGIN, Math.floor(width * 0.55) - WIDTH),
  };
}

export function useAssistantMotion(pauseReasons: string[]) {
  const { reduzido } = useMotion();
  const [viewport, setViewport] = useState(visibleViewport);
  const [hidden, setHidden] = useState(document.hidden);
  const [moving, setMoving] = useState(false);
  const bounds = assistantBounds(viewport.width, viewport.height);
  const x = useMotionValue(bounds.right);
  const y = useMotionValue(bounds.bottom);
  const nextPoint = useRef(0);
  const compact = viewport.width < 640;
  const reasons = [...pauseReasons, ...(reduzido ? ["reduced"] : []), ...(compact ? ["compact"] : []), ...(hidden ? ["hidden"] : [])];
  const paused = reasons.length > 0;

  useEffect(() => {
    const resize = () => {
      const { width, height } = visibleViewport();
      const limits = assistantBounds(width, height);
      // Um resize não deixa a sentinela temporariamente fora da tela enquanto anima de volta.
      x.set(limits.right);
      y.set(limits.bottom);
      nextPoint.current = 0;
      setViewport({ width, height });
    };
    const visibility = () => setHidden(document.hidden);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [x, y]);

  useEffect(() => {
    if (reduzido || compact) {
      x.set(bounds.right);
      y.set(bounds.bottom);
    }
    if (paused) { setMoving(false); return; }
    let timer: ReturnType<typeof setTimeout>;
    let controls: Array<{ stop: () => void }> = [];
    let stopped = false;
    const points = [
      { x: bounds.right, y: bounds.top }, { x: bounds.right, y: bounds.bottom },
      { x: Math.min(bounds.middle, bounds.right), y: bounds.bottom }, { x: bounds.right, y: bounds.bottom },
    ];
    const step = () => {
      if (stopped) return;
      const target = points[nextPoint.current % points.length];
      nextPoint.current += 1;
      // Ao retomar, completa a borda atual antes de escolher outra; nunca corta o centro.
      const needsCorner = (x.get() < bounds.right - 1 && target.y !== bounds.bottom)
        || (y.get() < bounds.bottom - 1 && target.x !== bounds.right);
      const destination = needsCorner
        ? { x: bounds.right, y: bounds.bottom } : target;
      const distance = Math.hypot(destination.x - x.get(), destination.y - y.get());
      const duration = Math.max(8, distance / 22); // Aproximadamente 22px/s: passeio ambiental, não transição de UI.
      setMoving(true);
      controls = [animate(x, destination.x, { duration, ease: "linear" }), animate(y, destination.y, { duration, ease: "linear" })];
      timer = setTimeout(() => {
        setMoving(false);
        timer = setTimeout(step, 2_800);
      }, duration * 1_000);
    };
    timer = setTimeout(step, 2_800);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controls.forEach((control) => control.stop());
    };
  }, [paused, reduzido, compact, bounds.right, bounds.bottom, bounds.top, bounds.middle, x, y]);

  return { x, y, reasons, state: reduzido || compact ? "static" : paused ? "paused" : moving ? "moving" : "resting" };
}
