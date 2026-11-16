/**
 * Reproduz a arte original da Vuvu e seus olhares em resposta à interação real.
 * Atualiza somente o elemento gráfico, sem renders por quadro; consumido pelo botão e painel.
 */
import { useEffect, useRef, useState } from "react";
import { useMotion } from "../../motion/use-motion";
import { DURACAO } from "../../motion/tokens";
import spritesheet from "../../assets/vuvu/spritesheet.png";
import sixSeven from "../../assets/vuvu/six-seven.png";
import { VUVU_ATLAS, VUVU_SIX_SEVEN, vuvuCanLook, vuvuFrame, vuvuIsAnimating, type VuvuActivity } from "./vuvu-sprite";
import { smoothVuvuGaze, stableVuvuLook, type VuvuGazePoint } from "./vuvu-gaze";
import type { VuvuFrame } from "./vuvu-sprite";

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
  const previous = useRef<HTMLImageElement>(null);
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
    let gaze: VuvuGazePoint | null = null;
    let look: VuvuFrame | null = null;
    let rendered: VuvuFrame | undefined;
    let gazeTime = started;
    let blend: Animation | undefined;
    let lastFrame = "";
    const transform = (frame: VuvuFrame) => `translate(${-frame.column * 100 / geometry.columns}%, ${-frame.row * 100 / geometry.rows}%)`;
    const paint = (now = performance.now()) => {
      const elapsed = now - started;
      const stopped = paused || reduzido || document.hidden;
      let settling = false;
      let frame = stopped ? { row: 0, column: 0 } : vuvuFrame(activity, elapsed, direction.current?.());
      if (!stopped && trackPointer && pointer && vuvuCanLook(activity, elapsed)) {
        const box = element.getBoundingClientRect();
        const dx = pointer.x - (box.left + box.width / 2);
        const dy = pointer.y - (box.top + box.height / 2);
        const distance = Math.hypot(dx, dy);
        if (distance < 720) {
          if (distance >= 18) {
            gaze = smoothVuvuGaze(gaze, { x: dx, y: dy }, now - gazeTime);
            frame = stableVuvuLook(gaze, look);
            look = frame;
            settling = Math.hypot(gaze.x - dx, gaze.y - dy) > 0.4;
          } else if (look) frame = look;
        } else { gaze = null; look = null; }
      }
      gazeTime = now;
      const key = `${frame.row}:${frame.column}`;
      if (key !== lastFrame) {
        blend?.cancel();
        if (!stopped && trackPointer && rendered && previous.current && (rendered.row >= 9 || frame.row >= 9)) {
          previous.current.style.transform = transform(rendered);
          blend = previous.current.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: DURACAO.instant * 1000, easing: "ease-out" });
        }
        atlas.style.transform = transform(frame);
        element.dataset.frame = key;
        rendered = frame;
        lastFrame = key;
      }
      if (stopped) blend?.cancel();
      return settling;
    };
    const follow = (now: number) => { raf = 0; if (paint(now) && !paused && !reduzido && !document.hidden) raf = requestAnimationFrame(follow); };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(follow); };
    const tick = () => {
      if (paint()) schedule();
      if (!paused && !reduzido && !document.hidden && vuvuIsAnimating(activity, performance.now() - started)) timer = setTimeout(tick, 120);
    };
    const restart = () => { clearTimeout(timer); cancelAnimationFrame(raf); raf = 0; pointer = null; gaze = null; look = null; started = performance.now(); tick(); };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || paused || reduzido || document.hidden) return;
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const leave = () => { pointer = null; gaze = null; look = null; schedule(); };
    tick();
    document.addEventListener("visibilitychange", restart);
    if (trackPointer && !paused && !reduzido) {
      window.addEventListener("pointermove", move, { passive: true });
      document.documentElement.addEventListener("pointerleave", leave);
    }
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      blend?.cancel();
      document.removeEventListener("visibilitychange", restart);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [activity, paused, reduzido, trackPointer, reactionKey, failed, geometry]);

  return <span ref={root} className={`vuvu-sprite${activity === "six-seven" ? " vuvu-six-seven" : ""}`} data-vuvu-state={activity} data-vuvu-paused={paused || reduzido || undefined} aria-hidden="true">
    {failed ? <span className="vuvu-fallback">V</span> : <>
      <img ref={image} src={activity === "six-seven" ? sixSeven : spritesheet} alt="" draggable={false}
        width={geometry.cellWidth * geometry.columns} height={geometry.cellHeight * geometry.rows} onError={() => setFailed(true)} />
      <img ref={previous} className="vuvu-previous-frame" src={activity === "six-seven" ? sixSeven : spritesheet} alt="" draggable={false}
        width={geometry.cellWidth * geometry.columns} height={geometry.cellHeight * geometry.rows} />
    </>}
  </span>;
}
