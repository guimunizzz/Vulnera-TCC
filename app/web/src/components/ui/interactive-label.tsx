import { useEffect, useRef } from "react";
import "./interactive-label.css";

/** Public-page button labels: decode for CTAs, sliced glitch for text links.
 * The original label owns layout and accessibility; animated copies are decorative.
 */
export function InteractiveLabel({ children, effect = "decode" }: {
  children: string;
  effect?: "decode" | "glitch";
}) {
  const root = useRef<HTMLSpanElement>(null);
  const animated = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (effect !== "decode") return;
    const label = root.current;
    const output = animated.current;
    const control = label?.closest("a, button");
    if (!label || !output || !control) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const letters = Array.from(children);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let frame: number | undefined;

    const stop = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      delete label.dataset.decoding;
      output.textContent = children;
    };
    const blocked = () => control.matches(':disabled, [aria-disabled="true"], [aria-busy="true"]');
    const start = () => {
      if (reduced.matches || blocked() || frame !== undefined) return;
      const startTime = performance.now();
      const duration = Math.min(900, Math.max(320, letters.length * 40));
      let lastTick = -1;
      label.dataset.decoding = "true";
      const tick = (now: number) => {
        const elapsed = now - startTime;
        if (elapsed >= duration || blocked() || document.hidden) { stop(); return; }
        const step = Math.floor(elapsed / 20);
        if (step !== lastTick) {
          lastTick = step;
          const revealed = Math.floor((elapsed / duration) * letters.length);
          output.textContent = letters.map((letter, index) =>
            index < revealed || !/\p{L}/u.test(letter)
              ? letter
              : alphabet[Math.floor(Math.random() * alphabet.length)],
          ).join("");
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const enter = (event: Event) => {
      if ((event as PointerEvent).pointerType !== "touch") start();
    };
    const focus = () => { if (control.matches(":focus-visible")) start(); };
    control.addEventListener("pointerenter", enter);
    control.addEventListener("pointerleave", stop);
    control.addEventListener("focus", focus);
    control.addEventListener("blur", stop);
    control.addEventListener("click", stop);
    reduced.addEventListener("change", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      stop();
      control.removeEventListener("pointerenter", enter);
      control.removeEventListener("pointerleave", stop);
      control.removeEventListener("focus", focus);
      control.removeEventListener("blur", stop);
      control.removeEventListener("click", stop);
      reduced.removeEventListener("change", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [children, effect]);

  return (
    <span ref={root} className={`vx-label vx-label--${effect}`}>
      <span className="vx-label-original">{children}</span>
      {effect === "decode" ? (
        <span ref={animated} className="vx-label-decoded" aria-hidden="true">{children}</span>
      ) : (
        <>
          <span className="vx-label-slice vx-label-top" aria-hidden="true">{children}</span>
          <span className="vx-label-slice vx-label-bottom" aria-hidden="true">{children}</span>
        </>
      )}
    </span>
  );
}
