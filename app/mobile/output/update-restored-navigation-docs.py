"""Registra a restauração do indicador e sincroniza a marca de Configurações.

Preserva o histórico e prepara cópias revisáveis antes da escrita na raiz.
Consumidor: fechamento desta tarefa; --apply exige autorização do sandbox.
"""
from pathlib import Path
import difflib
import hashlib
import json
import sys

mobile = Path(__file__).resolve().parents[1]
root = mobile.parents[1]
review = mobile / "output/restored-navigation-docs-review"
summary = (
    "**✅ 2026-10-09 — Indicador deslizante restaurado (100%).** A pedido do usuário, "
    "o modelo 7 voltou à animação 1: linha roxa de 24×3 px desliza 79 px entre os ícones; "
    "selecionado recebe cor e escala de 1,1×, anterior retorna a 1×. Movimento dos ícones, "
    "indicador e fade da tela usam **320 ms**, com a curva suave original. Substitui a opção 2 "
    "de luz/pulsação, preservada no histórico. Cápsula glass, logos, conteúdos e API preservados. "
    "Movimento reduzido mantém estados imediatos e escala normal; seleção segue a navegação real. "
    "Typecheck/lint e export web aprovados; **7/7 verificações no navegador**, incluindo escala, "
    "fade, teclado, trocas rápidas, avatar, pilha do projeto, redução de movimento e logout. "
    "Fixtures apenas no roteiro de QA; aparelho físico e API real não validados nesta tarefa. "
    "Evidências: `app/mobile/output/restored-icon-navigation-results.json` e capturas somente da Home. "
    "**Sincronização documental da tarefa anterior:** Configurações já reutiliza `HomeBrand` no "
    "cabeçalho sem retorno, com MINHA CONTA à direita; conferida em 320/390 px no roteiro "
    "`settings-logo-applied-results.json`. Login e cabeçalhos com retorno preservados."
)
if "--apply" in sys.argv:
    manifest = json.loads((review / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest:
        assert hashlib.sha256((root / item["path"]).read_bytes()).hexdigest() == item["sha256"]
    for item in manifest:
        (root / item["path"]).write_bytes((review / item["copy"]).read_bytes())
        print(f"Atualizado: {item['path']}")
else:
    result = json.loads((mobile / "output/restored-icon-navigation-results.json").read_text(encoding="utf-8"))
    assert result["passed"] == 7 and not result["errors"]
    review.mkdir(exist_ok=True)
    manifest, diffs = [], []
    for relative, heading, filename in [("PRD_VIVO.md", "## 1. Estado geral do projeto", "PRD_VIVO.md"), ("docs/BACKLOG.md", "## Status", "BACKLOG.md")]:
        original = (root / relative).read_bytes()
        source = original.decode("utf-8")
        nl = "\r\n" if "\r\n" in source else "\n"
        anchor = heading + nl + nl
        assert source.count(anchor) == 1 and "Indicador deslizante restaurado (100%)" not in source
        updated = source.replace("Modelo 7, animação 2 entregue (100% desta etapa)", "Modelo 7, animação 2 entregue (100% desta etapa; substituída pela restauração da opção 1 em 2026-10-09)")
        tasks = "- [x] Restaurar a animação 1, indicador deslizante com fade de 320 ms." + nl + "- [x] Aplicar a assinatura compacta da Home em Configurações (registro sincronizado)."
        updated = updated.replace(anchor, anchor + summary + nl + nl + tasks + nl + nl, 1)
        if relative == "PRD_VIVO.md":
            updated += nl + nl + "### Marco — 2026-10-09: restauração do indicador deslizante" + nl + nl + summary + nl
        (review / filename).write_bytes(updated.encode("utf-8"))
        manifest.append({"path": relative, "copy": filename, "sha256": hashlib.sha256(original).hexdigest()})
        diffs.extend(difflib.unified_diff(source.splitlines(), updated.splitlines(), fromfile=relative, tofile=relative, lineterm=""))
    (review / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (review / "changes.diff").write_text("\n".join(diffs), encoding="utf-8")
    print("PRD/BACKLOG preparados; raiz ainda não alterada.")
