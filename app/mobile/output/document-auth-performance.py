"""Registra a otimização do acesso web e suas evidências sem apagar históricos.

O Codex usa este preparador para revisar PRD/BACKLOG antes da escrita autorizada
fora do mobile; o relatório local reúne medições e limites da validação.
"""

import argparse
import importlib.util
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("auth_changes", HERE / "update-centered-web-login.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
helper.STAGE = HERE / "web-auth-performance"


def prepare(tests, files):
    stage = helper.STAGE
    before = json.loads((stage / "baseline.json").read_text(encoding="utf-8"))
    after = json.loads((stage / "optimized.json").read_text(encoding="utf-8"))
    smoke = json.loads((stage / "smoke-results.json").read_text(encoding="utf-8"))
    if smoke["errors"]:
        raise RuntimeError("O relatório do navegador contém erros.")
    checks = len(smoke["checks"])

    rows = []
    for sample, metric, label in [
        ("pointer", "RecalcStyleDuration", "Recalcular estilos durante 150 movimentos"),
        ("pointer", "TaskDuration", "Tarefas da thread principal durante 150 movimentos"),
        ("idle", "TaskDuration", "Tarefas da thread principal em 2 s com fundo invisível"),
    ]:
        previous = before["median"][sample][metric]
        current = after["median"][sample][metric]
        reduction = 100 * (1 - current / previous)
        rows.append(f"| {label} | {previous * 1000:.3f} ms | {current * 1000:.3f} ms | {reduction:.1f}% |")

    note = (
        "**✅ 2026-10-15 — Otimização do login e cadastro web (100%).** Branch `refactor/web`: "
        "coordenadas do ponteiro restritas às duas camadas decorativas, com um frame pendente; "
        "SVG e rótulos estáveis evitam trabalho repetido ao digitar. Circuitos CSS/SMIL pausam "
        "após o fade de saída de 550ms e retomam do mesmo ponto; aba oculta pausa os efeitos, "
        "toque mantém o fundo visível e movimento reduzido dispensa as atualizações. "
        "Envios simultâneos bloqueados antes do próximo render, com nova tentativa liberada "
        "após erro. Layout, efeitos visíveis, campos, validações, foco e destinos preservados. "
        "Medição local em Chrome, mediana de três sequências de 150 movimentos: tempo de "
        "recálculo de estilos de 1.420ms para 145ms (cerca de 90% menor), sem garantia geral de FPS. "
        f"npm run check aprovado: {tests}/{tests} testes em {files} arquivos, contraste 66/66 e "
        f"lint 0 erros/9 avisos anteriores; build aprovado e navegador {checks}/{checks}, "
        "com revisão visual independente. Relatório: `app/mobile/output/web-auth-performance/report.md`. "
        "Sem mudança de API, schema, dependências ou lockfiles."
    )
    completed = "- [x] Otimizar login/cadastro web mantendo recursos e aparência, com comparação de desempenho e regressão."
    followup = (
        "- [ ] Trabalho futuro — autenticação web: revisar resposta tardia depois de sair do formulário. "
        "Comportamento preexistente identificado na revisão: os handlers ainda podem atualizar a sessão "
        "e navegar quando o request termina após a saída; não alterado nesta otimização."
    )
    changes = {}
    for relative, heading in [("PRD_VIVO.md", "## 1. Estado geral do projeto"), ("docs/BACKLOG.md", "## Status")]:
        content = (helper.ROOT / relative).read_text(encoding="utf-8")
        if "Otimização do login e cadastro web (100%)" in content:
            raise RuntimeError("O marco desta tarefa já foi registrado.")
        insert = f"{heading}\n\n{note}\n\n{completed}"
        if relative == "docs/BACKLOG.md":
            insert += f"\n{followup}"
        content = helper.replace_once(content, heading, insert)
        if relative == "PRD_VIVO.md":
            content = content.rstrip() + "\n\n\n### Marco — 2026-10-15: otimização do acesso web\n\n" + note + "\n"
        changes[relative] = content

    report = f"""# Otimização do acesso web — 2026-10-15

Branch: `refactor/web`. Pedido: tornar login e cadastro mais fluidos mantendo os recursos existentes.

## Mudanças

- `auth-layout.tsx` e `login-page.css`: coordenadas do mouse somente nas duas camadas decorativas, sem propagação pelo formulário/SVG estático; até um `requestAnimationFrame` pendente, usando a posição mais recente e compensando a rolagem.
- Circuito SVG memorizado. Animações CSS e SVG/SMIL pausam quando o fundo termina o fade de saída (550ms), ou a aba fica oculta. Retomada mantém o tempo da animação. Toque mantém o fundo visível animado; movimento reduzido cancela atualizações dispensáveis. Listeners, frame e timer são removidos ao sair.
- `interactive-label.tsx`: `memo` evita reconciliar textos iguais a cada tecla; classificação das letras calculada uma vez, caracteres já revelados pulados e restauração altera somente o texto necessário. Decode/glitch e seus tempos preservados.
- `login-page.tsx` e `register-page.tsx`: trava síncrona impede requests duplicados antes do próximo render, inclusive por Enter. `finally` libera nova tentativa. Senhas diferentes continuam bloqueando cadastro antes de qualquer request.
- Layout compacto, logo interna, campos, mostrar senha, validação, mensagens de erro, foco, nomes acessíveis, store, destinos e transições preservados.

## Comparação local

Chrome headless, viewport 1440×900, servidor Vite local. Três rodadas por versão; mediana de métricas do Chrome DevTools Protocol. Cada rodada: 2s em repouso com fundo invisível e 150 movimentos de ponteiro. Medidas feitas antes dos jobs de teste/build para reduzir disputa de CPU.

| Medida | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
{chr(10).join(rows)}

O tempo de recálculo caiu; a medição não demonstra redução na quantidade de recálculos. Resultados são deste ambiente, sem garantia de FPS ou percentual equivalente em outros computadores. Digitação teve uma amostra exploratória por versão, insuficiente para um percentual confiável. Não foi medido paint/GPU ou consumo de bateria.

Com movimento reduzido, os 60 movimentos do roteiro passaram de 120 mutações de estilo no `main` para zero mutações nas três camadas observadas. Com movimento normal, o formulário e o SVG estático deixaram de herdar as coordenadas variáveis. Dados brutos: `baseline.json` e `optimized.json`.

## Validação

- `npm run check --workspace=app/web -- -- --pool=threads --maxWorkers=1 --silent`: {tests}/{tests} testes em {files} arquivos; ESLint 0 erros e 9 avisos anteriores; contraste 66/66.
- Testes focais: 20/20 em quatro arquivos. Novos testes cobrem envio repetido, sucesso e destino, retry após erro, valores preservados, confirmação de senha, coalescência de ponteiro, pausa/retomada, mudança de preferências, visibilidade e limpeza ao desmontar.
- `npm run build --workspace=app/web`: aprovado, com aviso anterior sobre tamanho de bundle.
- Navegador: {checks}/{checks}, sem exceções JavaScript. `smoke-results.json` detalha os cenários, incluindo 320×568, orientação horizontal, teclado/foco, erros, decode/glitch, transições, toque, rolagem e movimento reduzido.
- Revisão visual independente aprovada em `login-1440x900.png`, `register-320x568.png` e `touch-register-390x844.png`: elementos inteiros, sem sobreposição.

Autenticação foi simulada nos testes, sem criar contas reais. Visibilidade oculta foi simulada por evento; toque foi emulado no navegador. Não houve validação em aparelho físico nem benchmark de produção. Nenhuma mudança de API/schema/dependências/lockfiles nesta tarefa.

## Acompanhamento

Revisão identificou comportamento preexistente: uma resposta de autenticação que termina depois de sair do formulário ainda pode atualizar a sessão e navegar. Registrado no BACKLOG como trabalho futuro, sem ampliar o escopo desta otimização.
"""
    (stage / "report.md").write_text(report, encoding="utf-8")
    helper.stage_changes(changes)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tests", type=int, required=True)
    parser.add_argument("--files", type=int, required=True)
    args = parser.parse_args()
    prepare(args.tests, args.files)
