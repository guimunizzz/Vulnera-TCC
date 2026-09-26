/**
 * intro-3d.tsx — abertura: campo de partículas + câmera atravessando o eixo Z,
 * com o nome "VULNERA" se assentando por scramble. Dura 6s, some por fade.
 *
 * Portado de `vulnera-landing/src/components/three/Intro3D.jsx`.
 * `framer-motion` → `motion/react`. Boundary de erro pula direto pra landing
 * se o WebGL/Canvas quebrar.
 */

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import { motion } from "motion/react";
import * as THREE from "three";
import { InteractiveLabel } from "../ui/interactive-label";

const WORD = "VULNERA";
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%";
const DURATION = 6000;

function randomChar(): string {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

/** Campo de partículas violeta/ciano com rotação lenta do sistema todo. */
function ParticleField({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo<[Float32Array, Float32Array]>(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const violet = new THREE.Color("#8b5cf6");
    const cyan = new THREE.Color("#00d4ff");
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 900;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 600;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1200;
      tmp.copy(violet).lerp(cyan, Math.random());
      col[i * 3 + 0] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
    }
    return [pos, col];
  }, [count]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.05;
    ref.current.rotation.x += delta * 0.02;
  });

  return (
    <Points ref={ref} positions={positions} colors={colors} stride={3}>
      <PointMaterial
        transparent
        vertexColors
        size={2.4}
        sizeAttenuation
        depthWrite={false}
        opacity={0.9}
      />
    </Points>
  );
}

/** Câmera atravessa o campo no eixo Z com ease-out, sincronizada com a timeline. */
function CameraRig() {
  const start = useRef<number | null>(null);
  useFrame(({ camera, clock }) => {
    if (start.current === null) start.current = clock.getElapsedTime();
    const t = Math.min(((clock.getElapsedTime() - start.current) * 1000) / DURATION, 1);
    const eased = 1 - Math.pow(1 - t, 2);
    camera.position.z = -500 + eased * 1100;
  });
  return null;
}

interface BoundaryProps {
  onFail: () => void;
  children: ReactNode;
}

/** Se o WebGL/Canvas quebrar por qualquer motivo, pula direto pra landing. */
class CanvasErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Intro3D({ onComplete }: { onComplete: () => void }) {
  const [logoVisible, setLogoVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [letters, setLetters] = useState<string[]>(Array(WORD.length).fill(""));
  const doneRef = useRef(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const count = isMobile ? 1000 : 3000;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  }, [onComplete]);

  // Timeline: logo aos 3s, subtitle aos 4.2s, fim aos 6s (exit fade via AnimatePresence)
  useEffect(() => {
    const timers = [
      window.setTimeout(() => setLogoVisible(true), 3000),
      window.setTimeout(() => setSubtitleVisible(true), 4200),
      window.setTimeout(finish, DURATION),
    ];
    return () => timers.forEach(clearTimeout);
  }, [finish]);

  // Scrambling: cada letra se assenta em momento diferente (delay escalonado)
  useEffect(() => {
    if (!logoVisible) return undefined;
    const settleAt = WORD.split("").map((_, i) => 350 + i * 150);
    const start = performance.now();
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - start;
      setLetters((prev) => prev.map((_, i) => (elapsed >= settleAt[i] ? WORD[i] : randomChar())));
      if (elapsed >= settleAt[settleAt.length - 1]) {
        clearInterval(interval);
        setLetters(WORD.split(""));
      }
    }, 45);
    return () => clearInterval(interval);
  }, [logoVisible]);

  return (
    <motion.div
      className="fixed inset-0 z-[50] bg-[#05010b]"
      exit={{ opacity: 0, transition: { duration: 0.9, ease: "easeInOut" } }}
    >
      <CanvasErrorBoundary onFail={finish}>
        <Canvas
          className="absolute inset-0"
          camera={{ position: [0, 0, -500], fov: 70, near: 0.1, far: 2000 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          aria-hidden="true"
        >
          <ParticleField count={count} />
          <CameraRig />
        </Canvas>
      </CanvasErrorBoundary>

      <motion.button
        type="button"
        onClick={finish}
        aria-label="Pular introdução"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        whileHover={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute right-6 top-6 z-[10] font-mono text-sm tracking-widest text-[#d1d5db]"
      >
        <InteractiveLabel effect="glitch">SKIP INTRO →</InteractiveLabel>
      </motion.button>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {logoVisible && (
          <motion.h1
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="font-mono text-[3rem] font-bold tracking-[0.3em] text-[#e5e7eb] md:text-[4.5rem]"
            style={{ textShadow: "0 0 24px rgba(139,92,246,0.45)" }}
          >
            {letters.join("")}
          </motion.h1>
        )}
        {subtitleVisible && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.8, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mt-4 font-mono text-lg tracking-[0.6em] text-[#00d4ff] md:text-xl"
          >
            SECURITY
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
