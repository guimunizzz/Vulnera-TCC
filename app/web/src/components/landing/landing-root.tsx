/**
 * landing-root.tsx — a landing pública inteira: a intro 3D (uma vez por sessão)
 * e, depois dela, a sequência de seções.
 *
 * Portado de `vulnera-landing/src/App.jsx` + `src/pages/Landing.jsx` (juntados
 * num arquivo só). Este módulo é carregado via `lazy()` em
 * `pages/landing-page.tsx` — é o que mantém `three`, `gsap`, `@react-three/*` e
 * todas as seções FORA do bundle principal do app.
 */

import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Intro3D from "./intro-3d";
import CustomCursor from "./custom-cursor";
import Nav from "./nav";
import { ScrollProgress } from "./ui";
import Hero from "./sections/hero";
import Problem from "./sections/problem";
import HowItWorks from "./sections/how-it-works";
import Features from "./sections/features";
import Comparison from "./sections/comparison";
import Demo from "./sections/demo";
import Maturity from "./sections/maturity";
import Pricing from "./sections/pricing";
import FAQ from "./sections/faq";
import Team from "./sections/team";
import FinalCTA from "./sections/final-cta";

const INTRO_SEEN_KEY = "vx-intro-seen";

function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function LandingSections() {
  return (
    <div className="font-sans text-[var(--vx-text)]">
      <ScrollProgress />
      <CustomCursor />
      <Nav />
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <Comparison />
      <Demo />
      <Maturity />
      <Pricing />
      <FAQ />
      <Team />
      <FinalCTA />
    </div>
  );
}

export default function LandingRoot() {
  const [introActive, setIntroActive] = useState(() => !hasSeenIntro());

  const finishIntro = () => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      // sessionStorage indisponível (modo privado etc.) — só não persiste
    }
    setIntroActive(false);
  };

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {introActive ? (
          <Intro3D key="intro" onComplete={finishIntro} />
        ) : (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <LandingSections />
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
