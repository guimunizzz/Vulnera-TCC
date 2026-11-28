/**
 * Descreve o atlas original da Vuvu e seleciona seus quadros sem alterar a arte.
 * Mantém tempos e direções fora do componente; consumido pelo player e seus testes.
 */
export type VuvuActivity = "idle" | "greeting" | "playful" | "moving" | "dragging" | "six-seven" | "thinking" | "waiting" | "answered" | "error";
export interface VuvuFrame { row: number; column: number }

export const VUVU_ATLAS = { columns: 8, rows: 11, cellWidth: 192, cellHeight: 208 } as const;
export const VUVU_SIX_SEVEN = { columns: 4, rows: 2, cellWidth: 512, cellHeight: 512, durationMs: 2880 } as const;
const ANIMATIONS: Record<VuvuActivity, { row: number; frames: readonly number[]; frameMs: number; once?: boolean }> = {
  idle: { row: 0, frames: [0], frameMs: 240, once: true },
  greeting: { row: 3, frames: [0, 1, 2, 3], frameMs: 220, once: true },
  playful: { row: 4, frames: [0, 1, 2, 3, 4], frameMs: 170, once: true },
  moving: { row: 1, frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: 180 },
  dragging: { row: 6, frames: [0, 1, 2, 3, 4, 5], frameMs: 150 },
  "six-seven": { row: 0, frames: Array.from({ length: 24 }, (_, index) => index % 8), frameMs: 120, once: true },
  thinking: { row: 7, frames: [0, 1, 2, 3, 4, 5], frameMs: 240 },
  waiting: { row: 6, frames: [0, 1, 2, 3, 4, 5], frameMs: 300, once: true },
  answered: { row: 8, frames: [0, 1, 2, 3, 4, 5], frameMs: 210, once: true },
  error: { row: 5, frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: 240, once: true },
};

export function vuvuFrame(activity: VuvuActivity, elapsedMs: number, movingLeft = false): VuvuFrame {
  const animation = ANIMATIONS[activity];
  if (activity === "idle") return { row: 0, column: 0 };
  const index = Math.floor(Math.max(0, elapsedMs) / animation.frameMs);
  if (animation.once && index >= animation.frames.length) {
    return activity === "error" ? { row: 5, column: 0 } : vuvuFrame("idle", elapsedMs - animation.frames.length * animation.frameMs);
  }
  const frame = animation.frames[index % animation.frames.length];
  if (activity === "six-seven") return { row: Math.floor(frame / VUVU_SIX_SEVEN.columns), column: frame % VUVU_SIX_SEVEN.columns };
  return { row: activity === "moving" && movingLeft ? 2 : animation.row, column: frame };
}

export function vuvuIsAnimating(activity: VuvuActivity, elapsedMs: number): boolean {
  const animation = ANIMATIONS[activity];
  return activity !== "idle" && (!animation.once || elapsedMs < animation.frames.length * animation.frameMs);
}

/** O atlas mede ângulos no sentido horário a partir do alto, em passos de 22,5°. */
export function vuvuLookFrame(dx: number, dy: number): VuvuFrame {
  const degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  const direction = Math.round(degrees / 22.5) % 16;
  return { row: 9 + Math.floor(direction / 8), column: direction % 8 };
}

export function vuvuCanLook(activity: VuvuActivity, elapsedMs: number): boolean {
  const animation = ANIMATIONS[activity];
  return activity === "idle" || (activity !== "error" && activity !== "six-seven" && !!animation.once && elapsedMs >= animation.frames.length * animation.frameMs);
}
