# Registra o refinamento visual nos documentos vivos sem apagar o histórico.
# Prepara cópias revisáveis e só grava fora do mobile após aprovação de --apply.
# Consumidor: encerramento da tarefa visual, conforme AGENTS.md R1/R2/R6.
from pathlib import Path
import difflib
import hashlib
import json
import sys

local = Path(__file__).resolve().parent
repository = local.parents[2]
review = local / "docs-review-soft"
manifest_path = review / "manifest.json"
summary = "**✅ 2026-10-07 — Refinamento de suavidade e proporção no mobile (100% da implementação).** Branch `mobile/api`: substitui a apresentação editorial estática anterior por Home compacta, vidros mais leves, escala tipográfica e espaçamentos consistentes. Controles com áreas de toque de pelo menos 48 dp, resposta gradual ao pressionar, seleções/entradas suaves, navegação nativa e paralaxe discreta. Movimento reduzido observado ao vivo; atmosfera para ao sair da tela ou colocar o app em segundo plano. Alvo de blur compartilhado pelas telas autenticadas e barra de abas para Android 12+, com transparência em versões antigas. Login e integração da API preservados. Typecheck/lint e export web finais aprovados; export Android e **23/23 checks** (14 fluxos reais e 9 de movimento/proporção) aprovados antes do último ajuste compacto das abas/CVSS. A repetição visual final parou na abertura do Chrome por timeout; o export Android final não teve conclusão confirmada após a interrupção. Validação dessa última revisão e aparência/desempenho no aparelho continuam pendentes. Relatório: `app/mobile/output/mobile-softness-report.md`."
connectivity = "**✅ 2026-10-07 — Conectividade mobile após mudança de IP (100% da configuração).** O Wi-Fi do computador mudou de `10.87.169.7` para `10.87.169.60`; o `.env` local do mobile ainda apontava ao endereço antigo. Atualizado `EXPO_PUBLIC_API_URL` para `http://10.87.169.60:3001/api`. API e MySQL saudáveis no Docker; `/api/health` e os três planos responderam pelo novo IP. O smoke autenticado confirmou projetos e contratos reais. É necessário reiniciar Expo com `npx expo start -c` e reabrir o app para carregar a URL. Conferência no celular depende dessa recarga; não foi reiniciado o Metro do usuário. Sem mudanças de banco ou backend. Relatório: `app/mobile/output/mobile-connectivity-report.md`."

targets = {
    "PRD_VIVO.md": ("## 1. Estado geral do projeto", connectivity + "\n\n" + summary),
    "docs/BACKLOG.md": ("## Status", connectivity + "\n\n" + summary + "\n\n- [x] Corrigir a URL local da API após mudança do IP Wi-Fi e validar endpoints reais.\n- [x] Suavizar visual, toques, entradas, seleções, rolagem e navegação da área autenticada.\n- [x] Conferir áreas de toque, layouts 320/390/430 px e movimento reduzido na revisão anterior ao último ajuste compacto.\n- [ ] Repetir a QA visual/export Android da última revisão compacta das abas/CVSS após timeout/interrupção.\n- [ ] Avaliar sensação das transições, blur nativo e desempenho no aparelho com a nova apresentação."),
    "docs/ROADMAP_PROMPTS.md": (None, "## Histórico — suavidade e proporção do mobile (2026-10-06)\n\n" + summary + "\n\nContinuidade visual da Fase 7 após feedback do usuário; não altera sua conclusão histórica nem cria nova fase funcional. Sem commit, push ou PR nesta rodada. A apresentação estática anterior fica substituída por esta revisão, mantendo seus registros de API/sessão e ADR-045."),
    "docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md": (None, "## Sessão — refinamento da interação mobile (2026-10-06/07)\n\n" + summary + "\n\n" + connectivity),
    "docs/Vulnera/04-Arquitetura/Mobile Expo.md": (None, "## Movimento e vidro — refinamento de 2026-10-06\n\nA apresentação visual anterior foi substituída pelo refinamento documentado em `app/mobile/output/mobile-softness-report.md`. A área autenticada compartilha preferências de movimento reduzido por contexto, observando alterações em tempo de execução. Reanimated move opacidade/transformação com deslocamentos pequenos; o blur não é animado por frame. A atmosfera para quando a tela perde foco ou o app entra em segundo plano; rolagem atualiza apenas um valor compartilhado, sem setState por frame. Um BlurTargetView por tela contém somente o fundo, é reutilizado pelos cartões e pela barra e evita capturar os próprios vidros. A tela ativa registra sua referência, e o cleanup de uma tela anterior não remove a referência nova. Android 12+ usa `dimezisBlurViewSdk31Plus`; versões anteriores usam a transparência de fallback. No Android a barra desfoca a atmosfera, não o texto dos cartões que passa atrás dela; o tint garante legibilidade. iOS/web mantêm o blur correspondente à plataforma. Login, API, DTOs, cache e autorização continuam iguais à entrega funcional anterior. Sem novas dependências. Validação física nativa continua pendente."),
}

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def prepare():
    review.mkdir(exist_ok=True)
    manifest, diffs = [], []
    for relative, (marker, addition) in targets.items():
        target = (repository / relative).resolve()
        if not target.is_relative_to(repository):
            raise ValueError("Destino fora do repositório")
        raw = target.read_bytes()
        original = raw.decode("utf-8")
        newline = "\r\n" if "\r\n" in original else "\n"
        fragment = ("\n\n" + addition + "\n").replace("\n", newline)
        if marker:
            if marker not in original:
                raise ValueError(f"Marcador ausente: {relative}")
            updated = original.replace(marker, marker + fragment, 1)
        else:
            updated = original + fragment
        if relative == "PRD_VIVO.md":
            updated += ("\n\n### Marco — 2026-10-06/07: interação mobile suave e conectividade\n\n" + summary + "\n\n" + connectivity + "\n").replace("\n", newline)
        staged = review / relative
        staged.parent.mkdir(parents=True, exist_ok=True)
        result = updated.encode("utf-8")
        staged.write_bytes(result)
        manifest.append({"relative": relative, "original_sha256": sha(raw), "staged_sha256": sha(result)})
        diffs.extend(difflib.unified_diff(original.splitlines(True), updated.splitlines(True), fromfile=relative, tofile=relative))
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (review / "review.diff").write_text("".join(diffs), encoding="utf-8")
    print(f"Preparados {len(manifest)} documentos; diff em {review / 'review.diff'}")

def apply():
    entries = json.loads(manifest_path.read_text(encoding="utf-8"))
    if {item["relative"] for item in entries} != set(targets):
        raise ValueError("Lista de arquivos inesperada")
    writes = []
    for item in entries:
        target = (repository / item["relative"]).resolve()
        staged = (review / item["relative"]).read_bytes()
        if not target.is_relative_to(repository) or sha(target.read_bytes()) != item["original_sha256"] or sha(staged) != item["staged_sha256"]:
            raise ValueError(f"Conteúdo mudou desde a revisão: {item['relative']}")
        writes.append((target, staged))
    for target, raw in writes:
        target.write_bytes(raw)
        print(f"Atualizado: {target.relative_to(repository)}")

if "--apply" in sys.argv:
    apply()
else:
    prepare()
