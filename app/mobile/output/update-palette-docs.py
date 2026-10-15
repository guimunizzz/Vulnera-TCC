"""Prepara e aplica o registro da paleta grafite preservando os documentos vivos.

Existe porque PRD/backlog ficam fora da pasta mobile liberada para escrita.
Consumidor: revisão desta task; --apply exige permissão para os dois arquivos.
"""
from pathlib import Path
import difflib
import hashlib
import json
import sys

mobile = Path(__file__).resolve().parents[1]
root = mobile.parents[1]
review = mobile / "output" / "palette-docs-review"
summary = (
    "**✅ 2026-10-08 — Paleta grafite do mobile (100% da implementação e revisão em preview).** "
    "Branch `mobile/api`: fundo, vidro, bordas, barra inferior, metadados e ícones de apoio neutralizados; "
    "violeta mantido nas ações, foco, seleção e marca, com brilho ambiente reduzido. "
    "Status Em revisão em azul e Pendente em amarelo; anel CVSS usa a severidade calculada da API, "
    "preservando o badge de severidade final quando existe override. Liquid glass e animações suaves mantidos. "
    "Typecheck/lint e exports web/Android aprovados; **6/6 verificações visuais** em Chrome, "
    "incluindo larguras 320/390 px, cinco níveis de severidade, nota ausente, conta, evidências, comentários e toque. "
    "Docker/API desligados: esta revisão usa fixtures somente no script de QA; não comprova conectividade real "
    "nem aparência/desempenho em aparelho físico. Código de API, autenticação, dados, dependências e lockfiles sem alterações nesta task. "
    "A paleta autenticada anterior fica substituída por esta; registros históricos preservados. "
    "Relatório: `app/mobile/output/mobile-palette-report.md`."
)

if "--apply" in sys.argv:
    manifest = json.loads((review / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest:
        target = root / item["path"]
        if hashlib.sha256(target.read_bytes()).hexdigest() != item["sha256"]:
            raise SystemExit(f"Documento mudou após a revisão: {item['path']}")
    for item in manifest:
        (root / item["path"]).write_bytes((review / item["copy"]).read_bytes())
        print(f"Atualizado: {item['path']}")
else:
    results = json.loads((mobile / "output" / "palette-preview-results.json").read_text(encoding="utf-8"))
    assert results["passed"] == 6
    review.mkdir(exist_ok=True)
    manifest = []
    diffs = []
    for relative, heading, filename in [
        ("PRD_VIVO.md", "## 1. Estado geral do projeto", "PRD_VIVO.md"),
        ("docs/BACKLOG.md", "## Status", "BACKLOG.md"),
    ]:
        original = (root / relative).read_bytes()
        source = original.decode("utf-8")
        newline = "\r\n" if "\r\n" in source else "\n"
        anchor = heading + newline + newline
        assert source.count(anchor) == 1 and "2026-10-08 — Paleta grafite do mobile" not in source
        task = "- [x] Neutralizar a paleta autenticada e destacar status/severidade mantendo vidro e suavidade."
        updated = source.replace(anchor, anchor + summary + newline + newline + task + newline + newline, 1)
        if relative == "PRD_VIVO.md":
            updated += newline + newline + "### Marco — 2026-10-08: paleta grafite do mobile" + newline + newline + summary + newline
        (review / filename).write_bytes(updated.encode("utf-8"))
        manifest.append({"path": relative, "copy": filename, "sha256": hashlib.sha256(original).hexdigest()})
        diffs.extend(difflib.unified_diff(source.splitlines(True), updated.splitlines(True), fromfile=relative, tofile=relative))
    (review / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (review / "changes.diff").write_text("".join(diffs), encoding="utf-8")
    print("Preparados PRD e BACKLOG; nenhum documento da raiz foi alterado.")
