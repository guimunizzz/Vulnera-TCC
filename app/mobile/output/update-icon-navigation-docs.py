"""Registra a primeira animação do modelo 7 sem apagar o histórico do projeto.

Prepara cópias revisáveis porque PRD/backlog ficam fora da pasta mobile.
Consumidor: fechamento desta etapa; --apply requer permissão de escrita na raiz.
"""
from pathlib import Path
import difflib
import hashlib
import json
import sys

mobile = Path(__file__).resolve().parents[1]
root = mobile.parents[1]
review = mobile / "output" / "icon-navigation-docs-review"
summary = (
    "**✅ 2026-10-08 — Modelo 7, animação 1 entregue (100% desta etapa).** Branch `mobile/api`: "
    "cápsula glass central de 176×56, somente ícones e divisória fina; linha de seleção desliza 79 px em 320 ms, "
    "ícones mudam de cor por opacidade e crescem 10%, com fade da tela. Seleção segue o estado real de navegação, "
    "preservando tabPress/tabLongPress, teclado, rotas aninhadas, acesso pelo avatar e logout. "
    "Movimento reduzido aplica estados imediatamente e mantém ícones sem escala. Área segura e respiro inferior "
    "compartilhados; apenas o respiro inferior acompanha a nova altura. Conteúdo e identidade das telas, API, "
    "autenticação, dependências e lockfiles preservados. "
    "Typecheck/lint e exports web/Android aprovados; **7/7 verificações de interação** em Chrome, com capturas "
    "somente da Home em 320/390 px. API local sem containers ativos: fixtures apenas no roteiro de QA; "
    "desempenho/blur/leitor de tela em aparelho físico pendentes. A tentativa inicial de animar Ionicons "
    "diretamente foi substituída por camadas de opacidade após erro setNativeProps no preview. "
    "**Próximo: mostrar animação 2 após o usuário experimentar a opção 1**, conforme a sequência solicitada. "
    "Relatório: `app/mobile/output/icon-navigation-report.md`."
)

if "--apply" in sys.argv:
    manifest = json.loads((review / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest:
        assert hashlib.sha256((root / item["path"]).read_bytes()).hexdigest() == item["sha256"], "Documento mudou após revisão"
    for item in manifest:
        (root / item["path"]).write_bytes((review / item["copy"]).read_bytes())
        print(f"Atualizado: {item['path']}")
else:
    results = json.loads((mobile / "output" / "icon-navigation-results.json").read_text(encoding="utf-8"))
    assert results["passed"] == 7 and not results["errors"]
    review.mkdir(exist_ok=True)
    manifest, diffs = [], []
    for relative, heading, filename in [("PRD_VIVO.md", "## 1. Estado geral do projeto", "PRD_VIVO.md"), ("docs/BACKLOG.md", "## Status", "BACKLOG.md")]:
        original = (root / relative).read_bytes()
        source = original.decode("utf-8")
        newline = "\r\n" if "\r\n" in source else "\n"
        anchor = heading + newline + newline
        assert source.count(anchor) == 1 and "Modelo 7, animação 1 entregue" not in source
        tasks = "- [x] Aplicar modelo 7 com indicador deslizante e fade (opção 1)." + newline + "- [ ] Apresentar animação 2 após avaliação da opção 1 pelo usuário."
        updated = source.replace(anchor, anchor + summary + newline + newline + tasks + newline + newline, 1)
        if relative == "PRD_VIVO.md":
            updated += newline + newline + "### Marco — 2026-10-08: modelo 7 e animação 1" + newline + newline + summary + newline
        (review / filename).write_bytes(updated.encode("utf-8"))
        manifest.append({"path": relative, "copy": filename, "sha256": hashlib.sha256(original).hexdigest()})
        diffs.extend(difflib.unified_diff(source.splitlines(), updated.splitlines(), fromfile=relative, tofile=relative, lineterm=""))
    (review / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (review / "changes.diff").write_text("\n".join(diffs), encoding="utf-8")
    print("PRD/BACKLOG preparados para revisão; raiz ainda não alterada.")
