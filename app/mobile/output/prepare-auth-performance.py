"""Prepara otimizações locais do acesso web antes da aplicação autorizada.

Isola o trabalho visual do ponteiro, pausa animações sem exposição e protege
envios concorrentes; o Codex consome o diff e os arquivos preparados.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import textwrap

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('auth_changes', HERE / 'update-centered-web-login.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
helper.STAGE = HERE / 'web-auth-performance'
ROOT = helper.ROOT
replace_once = helper.replace_once

HANDLERS = '''
  useEffect(() => {
    const hover = window.matchMedia("(hover: none)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    function cancelPointerFrame(): void {
      if (pointerFrameRef.current !== undefined) {
        cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = undefined;
      }
    }

    function setPlaying(playing: boolean): void {
      const page = loginRef.current;
      if (!page) return;
      if (page.dataset.backgroundRunning !== String(playing)) {
        page.dataset.backgroundRunning = String(playing);
        if (playing) circuitRef.current?.unpauseAnimations?.();
        else circuitRef.current?.pauseAnimations?.();
      }
    }

    function syncPlayback(fadeOut = false): void {
      const page = loginRef.current;
      if (!page) return;
      if (backgroundTimerRef.current !== undefined) {
        window.clearTimeout(backgroundTimerRef.current);
        backgroundTimerRef.current = undefined;
      }
      const visible = !document.hidden;
      const allowed = visible && !reduced.matches;
      backgroundMotionRef.current = allowed;
      page.dataset.pageVisible = String(visible);
      if (!allowed) {
        cancelPointerFrame();
        page.dataset.revealActive = "false";
      }
      const playing = allowed && (hover.matches || page.dataset.revealActive === "true");
      // Mantém os sinais durante o fade de 550ms e retoma do mesmo ponto.
      if (!playing && fadeOut && allowed && page.dataset.backgroundRunning === "true") {
        backgroundTimerRef.current = window.setTimeout(() => {
          backgroundTimerRef.current = undefined;
          syncPlayback();
        }, BACKGROUND_FADE_MS);
      } else setPlaying(playing);
    }

    const mediaChanged = () => syncPlayback(true);
    const visibilityChanged = () => syncPlayback();
    refreshBackgroundRef.current = syncPlayback;
    syncPlayback();
    hover.addEventListener("change", mediaChanged);
    reduced.addEventListener("change", mediaChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      cancelPointerFrame();
      if (backgroundTimerRef.current !== undefined) window.clearTimeout(backgroundTimerRef.current);
      refreshBackgroundRef.current = null;
      hover.removeEventListener("change", mediaChanged);
      reduced.removeEventListener("change", mediaChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  function revelarFundo(event: ReactPointerEvent<HTMLElement>): void {
    const page = loginRef.current;
    if (!page || !backgroundMotionRef.current || event.pointerType === "touch") return;
    pointerPositionRef.current = { x: event.clientX, y: event.clientY };
    if (page.dataset.revealActive !== "true") {
      page.dataset.revealActive = "true";
      refreshBackgroundRef.current?.();
    }
    if (pointerFrameRef.current !== undefined) return;

    // Só as duas camadas decorativas mudam, no máximo uma vez por frame.
    pointerFrameRef.current = requestAnimationFrame(() => {
      pointerFrameRef.current = undefined;
      const current = loginRef.current;
      if (!current || !backgroundMotionRef.current || document.hidden) return;
      const bounds = current.getBoundingClientRect();
      const x = `${pointerPositionRef.current.x - bounds.left}px`;
      const y = `${pointerPositionRef.current.y - bounds.top}px`;
      for (const layer of [backgroundRef.current, glowRef.current]) {
        layer?.style.setProperty("--login-mouse-x", x);
        layer?.style.setProperty("--login-mouse-y", y);
      }
    });
  }

  function ocultarFundo(): void {
    if (pointerFrameRef.current !== undefined) {
      cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = undefined;
    }
    if (loginRef.current) loginRef.current.dataset.revealActive = "false";
    refreshBackgroundRef.current?.(true);
  }
'''.strip('\n')


def prepare_source():
    changes = {}
    layout = (ROOT / helper.LAYOUT).read_text(encoding='utf-8')
    original_start = layout.index('        <svg className="vx-login-circuit"')
    original_end = layout.index('        </svg>', original_start) + len('        </svg>')
    circuit = textwrap.dedent(layout[original_start:original_end]).replace('<svg className=', '<svg ref={svgRef} className=', 1)
    circuit = textwrap.indent(circuit, '    ')
    component = ('const BACKGROUND_FADE_MS = 550;\n\n'
        '// O SVG estático não precisa reconciliar seus caminhos a cada troca de rota.\n'
        'const AuthCircuit = memo(function AuthCircuit({ patternId, svgRef }: {\n'
        '  patternId: string;\n  svgRef: RefObject<SVGSVGElement>;\n}) {\n  return (\n' + circuit + '\n  );\n});\n\n')
    layout = layout[:original_start] + '        <AuthCircuit patternId={patternId} svgRef={circuitRef} />' + layout[original_end:]
    layout = replace_once(layout, 'import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent } from "react";',
        'import { memo, useEffect, useId, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";')
    layout = replace_once(layout, '// O cenário permanece montado enquanto apenas o formulário troca de rota.', component + '// O cenário permanece montado enquanto apenas o formulário troca de rota.')
    layout = replace_once(layout, '  const loginRef = useRef<HTMLElement>(null);',
        '  const loginRef = useRef<HTMLElement>(null);\n'
        '  const backgroundRef = useRef<HTMLDivElement>(null);\n'
        '  const glowRef = useRef<HTMLDivElement>(null);\n'
        '  const circuitRef = useRef<SVGSVGElement>(null);\n'
        '  const backgroundTimerRef = useRef<number>();\n'
        '  const backgroundMotionRef = useRef(false);\n'
        '  const refreshBackgroundRef = useRef<((fadeOut?: boolean) => void) | null>(null);')
    start = layout.index('  useEffect(() => () => {')
    end = layout.index('\n  return (\n    <main', start)
    layout = layout[:start] + HANDLERS + '\n' + layout[end:]
    layout = replace_once(layout, '      <div className="vx-login-background" aria-hidden="true">',
        '      <div ref={glowRef} className="vx-login-glow" aria-hidden="true" />\n'
        '      <div ref={backgroundRef} className="vx-login-background" aria-hidden="true">')
    changes[helper.LAYOUT] = layout

    css = (ROOT / helper.CSS).read_text(encoding='utf-8')
    if css.count('  inherits: true;') != 2:
        raise RuntimeError('Registro de coordenadas inesperado.')
    css = css.replace('  inherits: true;', '  inherits: false;')
    css = replace_once(css, '.vx-login::before {\n  content: "";', '.vx-login-glow {')
    css = replace_once(css, '.vx-login[data-reveal-active="true"]::before { opacity: 1; }', '.vx-login[data-reveal-active="true"] .vx-login-glow { opacity: 1; }')
    css = replace_once(css, '.vx-login-header {',
        '/* Sem exposição, CSS e SMIL pausam juntos; a retomada preserva o tempo. */\n'
        '.vx-login:not([data-background-running="true"]) .vx-login-circuit,\n'
        '.vx-login:not([data-background-running="true"]) .vx-login-signals path,\n'
        '.vx-login[data-page-visible="false"] .vx-login-header,\n'
        '.vx-login[data-page-visible="false"] .vx-login-cursor,\n'
        '.vx-login[data-page-visible="false"] .vx-label-slice { animation-play-state: paused; }\n\n'
        '.vx-login-header {')
    css = replace_once(css, '.vx-login[data-reveal-active="true"]::before { opacity: 0; }', '.vx-login[data-reveal-active="true"] .vx-login-glow { opacity: 0; }')
    changes[helper.CSS] = css

    for relative in [helper.LOGIN, helper.REGISTER]:
        content = (ROOT / relative).read_text(encoding='utf-8')
        content = replace_once(content, 'import { useState, type FormEvent } from "react";', 'import { useRef, useState, type FormEvent } from "react";')
        content = replace_once(content, '  const [enviando, setEnviando] = useState(false);', '  const [enviando, setEnviando] = useState(false);\n  const envioPendente = useRef(false);')
        content = replace_once(content, '    event.preventDefault();\n    setErro(null);',
            '    event.preventDefault();\n'
            '    // Enter repetido também passa por esta trava antes do próximo render.\n'
            '    if (envioPendente.current) return;\n'
            '    setErro(null);')
        content = replace_once(content, '    setEnviando(true);', '    envioPendente.current = true;\n    setEnviando(true);')
        content = replace_once(content, '    } finally {\n      setEnviando(false);', '    } finally {\n      envioPendente.current = false;\n      setEnviando(false);')
        changes[relative] = content

    label_path = 'app/web/src/components/ui/interactive-label.tsx'
    label = (ROOT / label_path).read_text(encoding='utf-8')
    label = replace_once(label, 'import { useEffect, useRef } from "react";', 'import { memo, useEffect, useRef } from "react";')
    label = replace_once(label, 'export function InteractiveLabel({', 'export const InteractiveLabel = memo(function InteractiveLabel({')
    if not label.endswith('}\n'):
        raise RuntimeError('Final inesperado do rótulo interativo.')
    label = label[:-2] + '});\n'
    label = replace_once(label, '    const letters = Array.from(children);',
        '    const letters = Array.from(children);\n'
        '    // A classificação não muda entre frames do mesmo texto.\n'
        '    const animatable = letters.map((letter) => /\\p{L}/u.test(letter));')
    label = replace_once(label, '      displayed.forEach((char, index) => { char.textContent = letters[index]; });',
        '      displayed.forEach((char, index) => {\n'
        '        if (char.textContent !== letters[index]) char.textContent = letters[index];\n'
        '      });')
    label = replace_once(label, '            const letter = letters[index];\n            if (index < revealed || !/\\p{L}/u.test(letter)) {',
        '            if (settled[index]) return;\n'
        '            const letter = letters[index];\n'
        '            if (index < revealed || !animatable[index]) {')
    changes[label_path] = label
    for relative in changes:
        original = helper.STAGE / ('original__' + relative.replace('/', '__'))
        if not original.exists():
            original.write_bytes((ROOT / relative).read_bytes())
    helper.stage_changes(changes)


def prepare_tests():
    changes = {}
    for name in ['auth-submission.test.tsx', 'auth-layout-motion.test.tsx']:
        changes['app/web/src/pages/auth/' + name] = (helper.STAGE / name).read_text(encoding='utf-8')
    helper.stage_changes(changes)


def finish_source():
    css = (ROOT / helper.CSS).read_text(encoding='utf-8')
    css = replace_once(css,
        '.vx-login[data-page-visible="false"] .vx-login-cursor,\n'
        '.vx-login[data-page-visible="false"] .vx-label-slice { animation-play-state: paused; }',
        '.vx-login[data-page-visible="false"] .vx-login-cursor { animation-play-state: paused; }\n'
        '/* O glitch possui seletores de foco/hover com maior especificidade. */\n'
        '.vx-login[data-page-visible="false"] .vx-label-slice { animation-play-state: paused !important; }')
    helper.stage_changes({helper.CSS: css})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', action='store_true')
    parser.add_argument('--tests', action='store_true')
    parser.add_argument('--finish', action='store_true')
    args = parser.parse_args()
    if args.source:
        prepare_source()
    elif args.tests:
        prepare_tests()
    elif args.finish:
        finish_source()
    else:
        parser.error('Escolha --source ou --tests.')
