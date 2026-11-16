/**
 * Amortece o olhar e evita alternância de poses na fronteira entre direções.
 * Mantém a arte original; consumido pelo player, sem estado React ou dados externos.
 */
import { vuvuLookFrame, type VuvuFrame } from "./vuvu-sprite";

export interface VuvuGazePoint { x: number; y: number }

export function smoothVuvuGaze(current: VuvuGazePoint | null, target: VuvuGazePoint, elapsedMs: number): VuvuGazePoint {
  if (!current) return { ...target };
  const weight = 1 - Math.exp(-Math.min(64, Math.max(1, elapsedMs)) / 65);
  return { x: current.x + (target.x - current.x) * weight, y: current.y + (target.y - current.y) * weight };
}

export function stableVuvuLook(point: VuvuGazePoint, previous: VuvuFrame | null): VuvuFrame {
  if (previous && previous.row >= 9) {
    const center = ((previous.row - 9) * 8 + previous.column) * 22.5;
    const angle = (Math.atan2(point.x, -point.y) * 180 / Math.PI + 360) % 360;
    const distance = Math.abs((angle - center + 540) % 360 - 180);
    // Uma margem curta elimina tremor sem prender o olhar na direção anterior.
    if (distance <= 15) return previous;
  }
  return vuvuLookFrame(point.x, point.y);
}
