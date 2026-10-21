"""Prepara e aplica o login web centralizado sem sobrescrever trabalho paralelo.

Existe porque a sessão permite escrita apenas no mobile; o Codex revisa os
arquivos preparados antes de solicitar acesso ao layout web e aos docs vivos.
"""

from pathlib import Path
import argparse
import difflib
import hashlib
import json
import sys


sys.stdout.reconfigure(encoding="utf-8")


MOBILE = Path(__file__).resolve().parent.parent
ROOT = MOBILE.parent.parent
STAGE = MOBILE / "output" / "web-login-centered"
LAYOUT = "app/web/src/pages/auth/auth-layout.tsx"
CSS = "app/web/src/pages/auth/login-page.css"
LOGIN = "app/web/src/pages/auth/login-page.tsx"
REGISTER = "app/web/src/pages/auth/register-page.tsx"
ALLOWED = {LAYOUT, CSS, LOGIN, REGISTER, "PRD_VIVO.md", "docs/BACKLOG.md"}
ALLOWED.update({
    'app/web/src/components/ui/interactive-label.tsx',
    'app/web/src/pages/auth/auth-submission.test.tsx',
    'app/web/src/pages/auth/auth-layout-motion.test.tsx',
})


def replace_once(content, old, new):
    if content.count(old) != 1:
        raise RuntimeError(f"Trecho esperado ausente ou ambíguo: {old[:90]}")
    return content.replace(old, new, 1)


def stage_changes(changes):
    STAGE.mkdir(parents=True, exist_ok=True)
    manifest = []
    diffs = []
    for relative, updated in changes.items():
        target = ROOT / relative
        exists = target.exists()
        original = target.read_bytes() if exists else b''
        source = original.decode("utf-8").replace("\r\n", "\n")
        newline = "\r\n" if b"\r\n" in original else "\n"
        staged = STAGE / relative.replace("/", "__")
        staged.write_bytes(updated.replace("\n", newline).encode("utf-8"))
        manifest.append({"target": relative, "sha256": hashlib.sha256(original).hexdigest() if exists else None, "staged": staged.name})
        diffs.extend(difflib.unified_diff(source.splitlines(True), updated.splitlines(True), fromfile=relative, tofile=relative))
    (STAGE / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (STAGE / "review.diff").write_text("".join(diffs), encoding="utf-8")
    print("".join(diffs))


def prepare():
    layout = (ROOT / LAYOUT).read_text(encoding="utf-8")
    layout = replace_once(layout,
        '      <header className="vx-login-header">\n'
        '        <Link to="/" className="vx-login-brand" aria-label="Vulnera — página inicial">\n'
        '          VULNERA<span className="vx-login-cursor" aria-hidden="true" />\n'
        '        </Link>\n'
        '      </header>\n\n'
        '      <div className="vx-login-stage">',
        '      <div className="vx-login-stage">\n'
        '        <header className="vx-login-header">\n'
        '          <Link to="/" className="vx-login-brand" aria-label="Vulnera — página inicial">\n'
        '            <span className="vx-login-wordmark">\n'
        '              VULNERA<span className="vx-login-cursor" aria-hidden="true" />\n'
        '            </span>\n'
        '            <span className="vx-login-brand-security">SECURITY</span>\n'
        '          </Link>\n'
        '        </header>')
    css = (ROOT / CSS).read_text(encoding="utf-8")
    css = replace_once(css, 'grid-template-rows: auto 1fr auto;', 'grid-template-rows: minmax(16px, 1fr) auto minmax(min-content, 1fr);')
    css = replace_once(css,
        '.vx-login-header {\n  display: flex;\n  min-height: 44px;\n  align-items: center;',
        '.vx-login-header {\n  display: flex;\n  min-height: 44px;\n  align-items: center;\n  justify-content: center;')
    css = replace_once(css,
        '.vx-login-brand {\n  display: inline-flex;\n  min-height: 44px;\n  align-items: center;\n  gap: 6px;\n  color: var(--login-text);\n  font: 700 1rem/1 var(--font-mono);',
        '.vx-login-brand {\n  display: inline-flex;\n  min-height: 44px;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  color: var(--login-text);\n  font: 700 clamp(1.5rem, 4vw, 1.75rem)/1 var(--font-mono);')
    css = replace_once(css, '.vx-login-cursor {',
        '.vx-login-wordmark { display: inline-flex; align-items: center; gap: 6px; }\n\n'
        '.vx-login-brand-security {\n'
        '  color: var(--login-muted);\n'
        '  font: 400 .625rem/1 var(--font-mono);\n'
        '  letter-spacing: .4em;\n'
        '}\n\n'
        '.vx-login-cursor {')
    css = replace_once(css, '  height: 14px;\n  background: var(--login-accent);', '  height: 20px;\n  background: var(--login-accent);')
    css = replace_once(css,
        '.vx-login-stage {\n  display: grid;\n  place-items: center;\n  min-width: 0;\n  padding: 16px 0;\n}',
        '/* Marca e formulário compartilham o centro; o rodapé ocupa a faixa inferior. */\n'
        '.vx-login-stage {\n  display: grid;\n  grid-row: 2;\n  place-items: center;\n'
        '  align-content: center;\n  gap: 28px;\n  min-width: 0;\n  padding: 16px 0;\n}')
    css = replace_once(css, '.vx-login-heading { margin-bottom: 26px; }',
        '.vx-login-heading { margin-bottom: 26px; }\n'
        '.vx-login-panel:not(.vx-register-panel) .vx-login-heading { text-align: center; }')
    css = replace_once(css, '.vx-login-footer {\n  display: grid;',
        '.vx-login-footer {\n  display: grid;\n  grid-row: 3;\n  align-self: end;')
    css = replace_once(css, '  .vx-login-stage { padding: 8px 0; }', '  .vx-login-stage { gap: 24px; padding: 8px 0; }')
    css = replace_once(css, '  .vx-login-stage { padding-block: 8px; }', '  .vx-login-stage { gap: 20px; padding-block: 8px; }')
    stage_changes({LAYOUT: layout, CSS: css})


def prepare_compact():
    layout = (ROOT / LAYOUT).read_text(encoding='utf-8')
    start = layout.index('      <div className="vx-login-stage">')
    end = layout.index('      <footer className="vx-login-footer">')
    stage = layout[start:end].rstrip().splitlines()
    if stage[-1] != '      </div>':
        raise RuntimeError('Estrutura inesperada do cenário de login.')
    inner = '\n'.join('  ' + line for line in stage[1:-1])
    updated_stage = '      <div className="vx-login-stage">\n        <div className="vx-auth-card">\n' + inner + '\n        </div>\n      </div>\n'
    footer_end = layout.index('      </footer>', end) + len('      </footer>\n')
    layout = layout[:start] + updated_stage + layout[footer_end:]
    login = (ROOT / LOGIN).read_text(encoding='utf-8')
    login = replace_once(login, '        <p className="vx-login-eyebrow"><span aria-hidden="true">//</span> BEM-VINDO DE VOLTA</p>\n', '')
    login = replace_once(login, '        <p>Acesse sua conta e continue suas análises.</p>\n', '')
    login = replace_once(login, 'Primeira vez por aqui?', 'Não tem conta?')
    css = (ROOT / CSS).read_text(encoding='utf-8')
    css = replace_once(css, 'grid-template-rows: minmax(16px, 1fr) auto minmax(min-content, 1fr);', 'grid-template-rows: 1fr;')
    css = replace_once(css, 'font: 700 clamp(1.5rem, 4vw, 1.75rem)/1 var(--font-mono);', 'font: 700 1.5rem/1 var(--font-mono);')
    css = replace_once(css,
        '/* Marca e formulário compartilham o centro; o rodapé ocupa a faixa inferior. */\n'
        '.vx-login-stage {\n  display: grid;\n  grid-row: 2;\n  place-items: center;\n  align-content: center;\n  gap: 28px;\n  min-width: 0;\n  padding: 16px 0;\n}',
        '/* O card reúne marca e formulário sem reservar uma faixa para o rodapé. */\n'
        '.vx-login-stage {\n  display: grid;\n  place-items: center;\n  min-width: 0;\n}')
    css = replace_once(css, '.vx-auth-transition { width: min(100%, 480px); min-width: 0; }', '.vx-auth-transition { width: 100%; min-width: 0; }')
    css = replace_once(css, '.vx-login-panel {\n  position: relative;\n  isolation: isolate;\n  width: 100%;\n  min-width: 0;\n  padding: 40px var(--login-panel-padding) 32px;',
        '.vx-login-panel { min-width: 0; }\n\n.vx-auth-card {\n  position: relative;\n  isolation: isolate;\n  display: grid;\n  gap: 20px;\n  width: min(100%, 400px);\n  min-width: 0;\n  padding: 28px;')
    css = replace_once(css, '.vx-login-panel:not(.vx-register-panel) .vx-login-heading { text-align: center; }',
        '.vx-login-panel:not(.vx-register-panel) .vx-login-heading { margin-bottom: 16px; text-align: center; }\n'
        '.vx-login-panel:not(.vx-register-panel) .vx-login-heading h1 { margin: 0; font-size: 1.5rem; }')
    css = replace_once(css, '.vx-login-form {\n  display: flex;\n  flex-direction: column;\n  gap: 20px;', '.vx-login-form {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;')
    css = replace_once(css, '.vx-login-field label { color: var(--login-text); font-size: .875rem;', '.vx-login-field label { color: var(--login-text); font-size: .75rem;')
    css = replace_once(css, '.vx-login .vx-login-input {\n  height: 48px;', '.vx-login .vx-login-input {\n  height: 44px;')
    css = replace_once(css, '.vx-login .vx-login-submit {\n  min-height: 48px;\n  height: auto;\n  padding-block: 12px;', '.vx-login .vx-login-submit {\n  min-height: 44px;\n  height: auto;\n  padding-block: 10px;')
    register_start = css.index('.vx-login-register {')
    register_end = css.index('\n}', register_start) + 2
    register = css[register_start:register_end].replace('margin: 20px 0 0;', 'margin: 16px 0 0;').replace('font-size: .875rem;', 'font-size: .8125rem;')
    css = css[:register_start] + register + css[register_end:]
    footer_start = css.index('.vx-login-footer {')
    footer_end = css.index('.vx-login :focus-visible', footer_start)
    css = css[:footer_start] + css[footer_end:]
    css = replace_once(css, '  .vx-login-stage { gap: 24px; padding: 8px 0; }\n', '')
    css = replace_once(css, '  .vx-login-panel { padding-block: 32px 24px; }', '  .vx-auth-card { gap: 16px; padding: 20px; }')
    css = replace_once(css, '  .vx-login-footer { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; }\n', '')
    css = replace_once(css, '  .vx-login-footer-decoration { display: none; }\n', '')
    css = replace_once(css, '  .vx-login-stage { gap: 20px; padding-block: 8px; }\n', '')
    css = replace_once(css, '.vx-login-heading::after,\n.vx-login-footer-decoration { display: none; }', '.vx-login-heading::after { display: none; }')
    stage_changes({LAYOUT: layout, CSS: css, LOGIN: login})


def prepare_brand_fields():
    changes = {}
    for relative, title_id, label in [(LOGIN, 'login-title', 'Entrar'), (REGISTER, 'register-title', 'Criar conta')]:
        content = (ROOT / relative).read_text(encoding='utf-8')
        old = ('      <div className="vx-login-heading">\n'
            f'        <h1 id="{title_id}" tabIndex={{-1}}>{label}<span className="vx-login-title-mark" aria-hidden="true">_</span></h1>\n'
            '      </div>')
        new = ('      {/* O título mantém o nome acessível e recebe o foco da transição. */}\n'
            f'      <h1 id="{title_id}" className="sr-only" tabIndex={{-1}}>{label}</h1>')
        changes[relative] = replace_once(content, old, new)
    stage_changes(changes)


def prepare_brand_fields_docs():
    report = json.loads((STAGE / 'validation.json').read_text(encoding='utf-8'))
    note = (
        '**✅ 2026-10-15 — Acesso web só com logo e campos (100%).** Branch '
        '`refactor/web`: títulos visuais Entrar/Criar conta removidos do login '
        'e cadastro, com seus wrappers e margens; a logo passa diretamente aos '
        'campos. Os h1 permanecem com `sr-only`, IDs e `tabIndex=-1`, mantendo '
        'nomes acessíveis dos formulários e foco ao alternar rotas. Animações, '
        'validação, botões e navegação entre login/cadastro preservados. Esta '
        'apresentação substitui os títulos centrais de 24px das entregas '
        'anteriores, mantidas como histórico. ' + report['checks'] +
        ' Evidências: `app/mobile/output/web-auth-brand-fields/`.'
    )
    prd = (ROOT / 'PRD_VIVO.md').read_text(encoding='utf-8')
    backlog = (ROOT / 'docs/BACKLOG.md').read_text(encoding='utf-8')
    marker = '### Marco — 2026-10-15: acesso web só com logo e campos'
    if marker in prd:
        raise RuntimeError('Marco desta apresentação já registrado.')
    task = '- [x] Deixar login e cadastro só com logo e campos, mantendo títulos acessíveis e foco das transições.\n'
    prd = replace_once(prd, '## 1. Estado geral do projeto\n', '## 1. Estado geral do projeto\n\n' + note + '\n\n' + task)
    prd += '\n\n' + marker + '\n\n' + note + '\n'
    backlog = replace_once(backlog, '## Status\n', '## Status\n\n' + note + '\n\n' + task)
    stage_changes({'PRD_VIVO.md': prd, 'docs/BACKLOG.md': backlog})


def prepare_register():
    register = (ROOT / REGISTER).read_text(encoding='utf-8')
    register = replace_once(register, '        <p className="vx-login-eyebrow"><span aria-hidden="true">//</span> COMECE POR AQUI</p>\n', '')
    register = replace_once(register, '        <p>Crie seu acesso. O próximo passo é cadastrar sua empresa.</p>\n', '')
    layout = (ROOT / LAYOUT).read_text(encoding='utf-8')
    layout = replace_once(layout, 'className="vx-login" onPointerMove=', 'className={pathname === "/register" ? "vx-login vx-register" : "vx-login"} onPointerMove=')
    css = (ROOT / CSS).read_text(encoding='utf-8')
    css = replace_once(css, '.vx-register-panel .vx-login-form { gap: 16px; }\n', '')
    css = replace_once(css, '.vx-login-panel:not(.vx-register-panel) .vx-login-heading { margin-bottom: 16px; text-align: center; }', '.vx-login-panel .vx-login-heading { margin-bottom: 16px; text-align: center; }')
    css = replace_once(css, '.vx-login-panel:not(.vx-register-panel) .vx-login-heading h1 { margin: 0; font-size: 1.5rem; }', '.vx-login-panel .vx-login-heading h1 { margin: 0; font-size: 1.5rem; }')
    css = replace_once(css, '@media (hover: none) {',
        '/* Quatro campos continuam legíveis em telas baixas, com alvos de 44px.\n'
        '   Erros aumentam o conteúdo e permitem rolar, sem cortar o formulário. */\n'
        '@media (max-height: 700px) {\n'
        '  .vx-login.vx-register { padding-block: 12px; }\n'
        '  .vx-register .vx-auth-card { gap: 8px; padding: 14px; }\n'
        '  .vx-register-panel .vx-login-heading { margin-bottom: 8px; }\n'
        '  .vx-register-panel .vx-login-form { gap: 8px; }\n'
        '  .vx-login.vx-register .vx-login-field { gap: 4px; }\n'
        '  .vx-register .vx-login-submit { margin-top: 0; }\n'
        '  .vx-register-panel .vx-login-register { margin-top: 8px; padding-top: 0; border-top: 0; }\n'
        '}\n\n'
        '@media (hover: none) {')
    stage_changes({REGISTER: register, LAYOUT: layout, CSS: css})


def prepare_register_routes():
    layout = (ROOT / LAYOUT).read_text(encoding='utf-8')
    layout = replace_once(layout, '  const direction = pathname === "/register" ? 1 : -1;',
        '  const isRegister = pathname.replace(/\\/+$/, "").toLowerCase() === "/register";\n'
        '  const direction = isRegister ? 1 : -1;')
    layout = replace_once(layout, 'className={pathname === "/register" ? "vx-login vx-register" : "vx-login"}', 'className={isRegister ? "vx-login vx-register" : "vx-login"}')
    stage_changes({LAYOUT: layout})


def prepare_register_docs():
    report = json.loads((STAGE / 'validation.json').read_text(encoding='utf-8'))
    note = (
        '**✅ 2026-10-15 — Cadastro web compacto (100%).** Branch `refactor/web`: '
        'cadastro com título centralizado de 24px e apresentação curta, seguindo '
        'o login; logo permanece dentro do card compartilhado, sem rodapé. '
        'Espaçamentos específicos em telas de até 700px de altura acomodam os '
        'quatro campos e a dica de senha em 320×568, mantendo controles de 44px. '
        'Erros podem expandir a página e permitem rolagem. Preservados fundo '
        'interativo, cursor, decode/glitch, transição login/cadastro, foco, '
        'movimento reduzido e validação/envio do cadastro. ' + report['checks'] +
        ' Evidências: `app/mobile/output/web-register-centered/`. Sem mudança de '
        'API, schema, dependências ou lockfiles nesta tarefa.'
    )
    prd = (ROOT / 'PRD_VIVO.md').read_text(encoding='utf-8')
    backlog = (ROOT / 'docs/BACKLOG.md').read_text(encoding='utf-8')
    marker = '### Marco — 2026-10-15: cadastro web compacto'
    if marker in prd:
        raise RuntimeError('Marco do cadastro já registrado.')
    task = '- [x] Aplicar ao cadastro web o mesmo visual compacto do login, preservando campos, validação e animações.\n'
    prd = replace_once(prd, '## 1. Estado geral do projeto\n', '## 1. Estado geral do projeto\n\n' + note + '\n\n' + task)
    prd += '\n\n' + marker + '\n\n' + note + '\n'
    backlog = replace_once(backlog, '## Status\n', '## Status\n\n' + note + '\n\n' + task)
    stage_changes({'PRD_VIVO.md': prd, 'docs/BACKLOG.md': backlog})


def prepare_docs():
    report = json.loads((STAGE / "validation.json").read_text(encoding="utf-8"))
    note = (
        '**✅ 2026-10-15 — Login web centralizado (100%).** Branch `refactor/web`: '
        'marca VULNERA SECURITY dentro do card, acima dos campos; card de até 400px, '
        'espaçamentos compactos e rodapé removido. Login inteiro em telas a partir de '
        '320×568; orientação horizontal baixa permite rolagem. Preservados '
        'o fundo revelado pelo ponteiro, circuitos/sinais, cursor pulsante, efeitos de '
        'foco/hover, textos interativos e transição login/cadastro (incluindo foco e '
        'movimento reduzido). A marca continua montada ao alternar os formulários. '
        + report['checks'] + ' Evidências: `app/mobile/output/web-login-centered/`. '
        'Sem alteração de autenticação, API, dependências ou lockfiles nesta tarefa.'
    )
    prd = (ROOT / 'PRD_VIVO.md').read_text(encoding='utf-8')
    backlog = (ROOT / 'docs/BACKLOG.md').read_text(encoding='utf-8')
    if '### Marco — 2026-10-15: login web centralizado' in prd:
        raise RuntimeError('Marco já registrado; revisar antes de repetir.')
    prd = replace_once(prd, '## 1. Estado geral do projeto\n', '## 1. Estado geral do projeto\n\n' + note + '\n\n- [x] Centralizar logo e formulário do login web mantendo as animações existentes.\n')
    prd += '\n\n### Marco — 2026-10-15: login web centralizado\n\n' + note + '\n'
    backlog = replace_once(backlog, '## Status\n', '## Status\n\n' + note + '\n\n- [x] Centralizar logo e formulário do login web mantendo as animações existentes.\n')
    stage_changes({'PRD_VIVO.md': prd, 'docs/BACKLOG.md': backlog})


def apply():
    manifest = json.loads((STAGE / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest:
        if item['target'] not in ALLOWED:
            raise RuntimeError('Destino fora do escopo autorizado.')
        target = ROOT / item['target']
        staged = STAGE / item['staged']
        actual = hashlib.sha256(target.read_bytes()).hexdigest() if target.exists() else None
        if actual != item['sha256']:
            raise RuntimeError(f"Arquivo mudou desde a preparação: {item['target']}")
        if not staged.is_file() or staged.parent.resolve() != STAGE.resolve():
            raise RuntimeError('Arquivo preparado inválido.')
    for item in manifest:
        (ROOT / item['target']).write_bytes((STAGE / item['staged']).read_bytes())
        print(f"Atualizado: {item['target']}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--prepare-compact', action='store_true')
    parser.add_argument('--prepare-register', action='store_true')
    parser.add_argument('--prepare-register-docs', action='store_true')
    parser.add_argument('--prepare-register-routes', action='store_true')
    parser.add_argument('--prepare-brand-fields', action='store_true')
    parser.add_argument('--prepare-brand-fields-docs', action='store_true')
    parser.add_argument('--brand-fields', action='store_true')
    parser.add_argument('--performance', action='store_true')
    parser.add_argument('--register', action='store_true')
    parser.add_argument('--prepare-docs', action='store_true')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if sum([args.prepare, args.prepare_compact, args.prepare_docs, args.prepare_register, args.prepare_register_docs, args.prepare_register_routes, args.prepare_brand_fields, args.prepare_brand_fields_docs, args.apply]) != 1:
        parser.error('Escolha exatamente um modo.')
    if args.register or args.prepare_register or args.prepare_register_docs or args.prepare_register_routes:
        STAGE = MOBILE / 'output' / 'web-register-centered'
    if args.brand_fields or args.prepare_brand_fields or args.prepare_brand_fields_docs:
        STAGE = MOBILE / 'output' / 'web-auth-brand-fields'
    if args.performance:
        STAGE = MOBILE / 'output' / 'web-auth-performance'
    if args.prepare:
        prepare()
    elif args.prepare_compact:
        prepare_compact()
    elif args.prepare_register:
        prepare_register()
    elif args.prepare_register_docs:
        prepare_register_docs()
    elif args.prepare_register_routes:
        prepare_register_routes()
    elif args.prepare_brand_fields:
        prepare_brand_fields()
    elif args.prepare_brand_fields_docs:
        prepare_brand_fields_docs()
    elif args.prepare_docs:
        prepare_docs()
    else:
        apply()
