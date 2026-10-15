"""Registra o comparativo de logos entregue e a escolha pendente do usuário.

Prepara cópias e diff antes de aplicar os documentos vivos fora do mobile.
Consumidor: fechamento da exploração visual; não modifica o código do app.
"""
from pathlib import Path
import difflib
import hashlib
import json
import sys

mobile = Path(__file__).resolve().parents[1]
root = mobile.parents[1]
review = mobile / "output" / "home-logo-docs-review"
summary = (
    "**✅ 2026-10-08 — Comparativo de logos da Home entregue (100% da exploração visual).** "
    "A pedido do usuário, três estilos para cada marca: wordmark VULNERA SECURITY da Home web "
    "e V geométrico do login mobile, totalizando seis opções (compacta, cápsula glass e editorial). "
    "Capturas somente da Home, reunidas em `app/mobile/output/comparativo-logos-home.png`; "
    "HTML e capturas individuais na mesma pasta. Adaptações renderizadas no DOM do preview, "
    "sem gerar uma marca diferente ou alterar arquivos de produção. Conferidas seis opções em "
    "320/390 px, sem sobrepor avatar ou deslocar o conteúdo; dados isolados no navegador. "
    "**Pendente: usuário escolher a versão para aplicação na Home mobile.**"
)
if "--apply" in sys.argv:
    manifest = json.loads((review / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest:
        assert hashlib.sha256((root / item["path"]).read_bytes()).hexdigest() == item["sha256"]
    for item in manifest:
        (root / item["path"]).write_bytes((review / item["copy"]).read_bytes())
        print(f"Atualizado: {item['path']}")
else:
    result = json.loads((mobile / "output/home-logo-comparison-results.json").read_text(encoding="utf-8"))
    assert len(result["choices"]) == 6 and not result["errors"] and not result["appChanged"]
    review.mkdir(exist_ok=True)
    manifest, diffs = [], []
    for relative, heading, filename in [("PRD_VIVO.md", "## 1. Estado geral do projeto", "PRD_VIVO.md"), ("docs/BACKLOG.md", "## Status", "BACKLOG.md")]:
        original = (root / relative).read_bytes()
        source = original.decode("utf-8")
        nl = "\r\n" if "\r\n" in source else "\n"
        anchor = heading + nl + nl
        assert source.count(anchor) == 1 and "Comparativo de logos da Home entregue" not in source
        tasks = "- [x] Comparar três estilos para cada uma das duas logos na Home mobile." + nl + "- [ ] Aplicar a logo escolhida pelo usuário no topo da Home mobile."
        updated = source.replace(anchor, anchor + summary + nl + nl + tasks + nl + nl, 1)
        if relative == "PRD_VIVO.md":
            updated += nl + nl + "### Marco — 2026-10-08: comparativo de logos da Home" + nl + nl + summary + nl
        (review / filename).write_bytes(updated.encode("utf-8"))
        manifest.append({"path": relative, "copy": filename, "sha256": hashlib.sha256(original).hexdigest()})
        diffs.extend(difflib.unified_diff(source.splitlines(), updated.splitlines(), fromfile=relative, tofile=relative, lineterm=""))
    (review / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (review / "changes.diff").write_text("\n".join(diffs), encoding="utf-8")
    print("Comparativo registrado nas cópias; raiz ainda não alterada.")
