/**
 * ambient-particles.tsx — fundo 3D sutil (react-three-fiber) para o hero.
 *
 * Portado de `vulnera-landing/src/components/three/AmbientParticles.jsx`.
 * Leve de propósito: poucas partículas, sem interação, `pointer-events: none`.
 * Vai num chunk à parte via `lazy()` no consumidor — `three` + fiber + drei
 * não podem entrar no bundle principal.
 */

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import type { Points as ThreePoints } from "three";

function Drift({ count }: { count: number }) {
  const ref = useRef<ThreePoints>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 600;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 400;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 300;
    }
    return pos;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.02;
    ref.current.position.y = Math.sin(t * 0.2) * 6;
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#8b5cf6"
        size={1.6}
        sizeAttenuation
        depthWrite={false}
        opacity={0.35}
      />
    </Points>
  );
}

interface AmbientParticlesProps {
  count?: number;
  className?: string;
}

export default function AmbientParticles({ count = 400, className = "" }: AmbientParticlesProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 300], fov: 60 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Drift count={count} />
      </Canvas>
    </div>
  );
}
