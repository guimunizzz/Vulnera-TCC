"""Registra a marca compacta de Configurações nos documentos vivos.

Prepara cópias e diff para revisão antes da escrita autorizada na raiz.
Consumidor: fechamento da tarefa visual; histórico anterior permanece.
"""
from pathlib import Path
import difflib
import hashlib
import json
import sys

mobile = Path(__file__).resolve().parents[1]
root = mobile.parents[1]
review = mobile / "output/settings-brand-docs-review"
summary = (
    "**✅ 2026-10-09 — Assinatura compacta em Configurações (100%).** "
    "Auditoria dos cabeçalhos confirmou: Home já usa a logo escolhida; Minha conta "
    "era a única tela com o escudo anterior. `PageHeader` reutiliza `HomeBrand` quando "
    "não há botão de voltar, com MINHA CONTA alinhado à direita. Projeto e vulnerabilidade "
    "mantêm botão de retorno/título; login e rodapé textual preservados. Cabeçalho com "
    "altura mínima de 64 px e mesma assinatura da Home. A aplicação inicialmente limitada "
    "à Home foi ampliada para Configurações; registros da etapa anterior são históricos. "
    "Typecheck, lint e export web aprovados; preview em 320/390 px sem sobreposição, "
    "navegação à Home e retorno do projeto conferidos, sem exceções. Dados isolados "
    "somente no roteiro do navegador; API e aparência nativa não validadas nesta tarefa. "
    "Capturas e medidas em `app/mobile/output/settings-logo-aplicada-*.png` e "
    "`app/mobile/output/settings-logo-applied-results.json`."
)
if "--apply" in sys.argv:
    manifest = json.loads((review / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest:
        assert hashlib.sha256((root / item["path"]).read_bytes()).hexdigest() == item["sha256"]
    for item in manifest:
        (root / item["path"]).write_bytes((review / item["copy"]).read_bytes())
        print(f"Atualizado: {item['path']}")
else:
    result = json.loads((mobile / "output/settings-logo-applied-results.json").read_text(encoding="utf-8"))
    assert len(result["measurements"]) == 2 and result["homeBrand"] and result["projectBack"] and not result["errors"]
    review.mkdir(exist_ok=True)
    manifest, diffs = [], []
    for relative, heading, filename in [("PRD_VIVO.md", "## 1. Estado geral do projeto", "PRD_VIVO.md"), ("docs/BACKLOG.md", "## Status", "BACKLOG.md")]:
        original = (root / relative).read_bytes()
        source = original.decode("utf-8")
        nl = "\r\n" if "\r\n" in source else "\n"
        anchor = heading + nl + nl
        assert source.count(anchor) == 1 and "Assinatura compacta em Configurações (100%)" not in source
        updated = source.replace(anchor, anchor + summary + nl + nl + "- [x] Aplicar a mesma assinatura compacta da Home em Configurações." + nl + nl, 1)
        if relative == "PRD_VIVO.md":
            updated += nl + nl + "### Marco — 2026-10-09: logo compacta em Configurações" + nl + nl + summary + nl
        (review / filename).write_bytes(updated.encode("utf-8"))
        manifest.append({"path": relative, "copy": filename, "sha256": hashlib.sha256(original).hexdigest()})
        diffs.extend(difflib.unified_diff(source.splitlines(), updated.splitlines(), fromfile=relative, tofile=relative, lineterm=""))
    (review / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (review / "changes.diff").write_text("\n".join(diffs), encoding="utf-8")
    print("PRD/BACKLOG preparados para revisão; raiz ainda não alterada.")
