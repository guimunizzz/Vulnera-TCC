/**
 * Reproduz a arte original da Vuvu e seus olhares em resposta à interação real.
 * Atualiza somente o elemento gráfico, sem renders por quadro; consumido pelo botão e painel.
 */
import { useEffect, useRef, useState } from "react";
import { useMotion } from "../../motion/use-motion";
import spritesheet from "../../assets/vuvu/spritesheet.png";
import sixSeven from "../../assets/vuvu/six-seven.png";
import { VUVU_ATLAS, VUVU_SIX_SEVEN, vuvuCanLook, vuvuFrame, vuvuIsAnimating, vuvuLookFrame, type VuvuActivity } from "./vuvu-sprite";

interface Props {
  activity?: VuvuActivity;
  paused?: boolean;
  trackPointer?: boolean;
  reactionKey?: string | number;
  movingLeft?: () => boolean;
}

export function AssistantMascot({ activity = "idle", paused = false, trackPointer = false, reactionKey, movingLeft }: Props) {
  const { reduzido } = useMotion();
  const root = useRef<HTMLSpanElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const direction = useRef(movingLeft);
  const [failed, setFailed] = useState(false);
  const geometry = activity === "six-seven" ? VUVU_SIX_SEVEN : VUVU_ATLAS;
  direction.current = movingLeft;

  useEffect(() => {
    const element = root.current;
    const atlas = image.current;
    if (!element || !atlas || failed) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let started = performance.now();
    let pointer: { x: number; y: number } | null = null;
    let lastFrame = "";
    const paint = () => {
      const elapsed = performance.now() - started;
      const stopped = paused || reduzido || document.hidden;
      let frame = stopped ? { row: 0, column: 0 } : vuvuFrame(activity, elapsed, direction.current?.());
      if (!stopped && trackPointer && pointer && vuvuCanLook(activity, elapsed)) {
        const box = element.getBoundingClientRect();
        const dx = pointer.x - (box.left + box.width / 2);
        const dy = pointer.y - (box.top + box.height / 2);
        const distance = Math.hypot(dx, dy);
        if (distance > 36 && distance < 720) frame = vuvuLookFrame(dx, dy);
      }
      const key = `${frame.row}:${frame.column}`;
      if (key !== lastFrame) {
        atlas.style.transform = `translate(${-frame.column * 100 / geometry.columns}%, ${-frame.row * 100 / geometry.rows}%)`;
        element.dataset.frame = key;
        lastFrame = key;
      }
    };
    const tick = () => {
      paint();
      if (!paused && !reduzido && !document.hidden && vuvuIsAnimating(activity, performance.now() - started)) timer = setTimeout(tick, 120);
    };
    const restart = () => { clearTimeout(timer); started = performance.now(); tick(); };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || paused || reduzido || document.hidden) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); });
    };
    const leave = () => { pointer = null; paint(); };
    tick();
    document.addEventListener("visibilitychange", restart);
    if (trackPointer && !paused && !reduzido) {
      window.addEventListener("pointermove", move, { passive: true });
      document.documentElement.addEventListener("pointerleave", leave);
    }
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", restart);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [activity, paused, reduzido, trackPointer, reactionKey, failed, geometry]);

  return <span ref={root} className={`vuvu-sprite${activity === "six-seven" ? " vuvu-six-seven" : ""}`} data-vuvu-state={activity} data-vuvu-paused={paused || reduzido || undefined} aria-hidden="true">
    {failed ? <span className="vuvu-fallback">V</span> : <img ref={image} src={activity === "six-seven" ? sixSeven : spritesheet} alt="" draggable={false}
      width={geometry.cellWidth * geometry.columns} height={geometry.cellHeight * geometry.rows} onError={() => setFailed(true)} />}
  </span>;
}
