/**
 * custom-cursor.tsx — crosshair neon com física de spring e rastro.
 *
 * Portado de `vulnera-landing/src/components/CustomCursor.jsx`.
 * Só renderiza com ponteiro fino (mouse); o cursor nativo continua visível.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

const TRAIL_LIMIT = 8;

interface TrailPoint {
  x: number;
  y: number;
  id: number;
}

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);

  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const x = useSpring(mx, { stiffness: 900, damping: 50, mass: 0.3 });
  const y = useSpring(my, { stiffness: 900, damping: 50, mass: 0.3 });

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!finePointer) return undefined;
    setEnabled(true);

    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      trailRef.current = [{ x: e.clientX, y: e.clientY, id: Math.random() }, ...trailRef.current].slice(
        0,
        TRAIL_LIMIT,
      );
      setTrail([...trailRef.current]);
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as Element | null;
      setHovering(Boolean(target?.closest("button, a")));
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  }, [mx, my]);

  if (!enabled) return null;

  const color = hovering ? "#00d4ff" : "#8b5cf6";

  return (
    <div className="pointer-events-none fixed inset-0 z-[50]" aria-hidden="true">
      {/* Rastro */}
      {trail.map((p, i) => (
        <div
          key={p.id}
          className="absolute h-[3px] w-[3px] bg-[#8b5cf6]"
          style={{
            left: p.x,
            top: p.y,
            opacity: 0.5 * (1 - i / TRAIL_LIMIT),
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {/* Crosshair: 4 traços com spring */}
      <motion.div
        className="absolute"
        style={{ left: x, top: y, width: 20, height: 20, translateX: "-50%", translateY: "-50%" }}
        animate={{ scale: hovering ? 1.5 : 1, opacity: 0.7 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <span
          className="absolute left-1/2 top-0 h-[6px] w-[1.5px] -translate-x-1/2"
          style={{ background: color }}
        />
        <span
          className="absolute bottom-0 left-1/2 h-[6px] w-[1.5px] -translate-x-1/2"
          style={{ background: color }}
        />
        <span
          className="absolute left-0 top-1/2 h-[1.5px] w-[6px] -translate-y-1/2"
          style={{ background: color }}
        />
        <span
          className="absolute right-0 top-1/2 h-[1.5px] w-[6px] -translate-y-1/2"
          style={{ background: color }}
        />
      </motion.div>
    </div>
  );
}
