"""Registra a assinatura compacta escolhida e preserva o histórico comparativo.

Prepara cópias revisáveis antes da escrita autorizada nos documentos da raiz.
Consumidor: fechamento da implementação da logo da Home mobile.
"""
from pathlib import Path
import difflib
import hashlib
import json
import sys

mobile = Path(__file__).resolve().parents[1]
root = mobile.parents[1]
review = mobile / "output/compact-home-brand-docs-review"
summary = (
    "**✅ 2026-10-08 — Logo da Home, opção 4 aplicada (100%).** "
    "Usuário escolheu a assinatura compacta: V geométrico roxo de 28 px, VULNERA "
    "em JetBrains Mono bold de 15 px e SECURITY menor abaixo, sem moldura. "
    "Componente `HomeBrand` usado somente no topo da Home; preserva o cabeçalho de 64 px, "
    "avatar de 48 px e geometria oficial do símbolo do login. Marca com rótulo acessível "
    "único. Login, demais cabeçalhos, barra inferior, API e conteúdo preservados. "
    "Typecheck, lint e export web aprovados; conferência visual em 320/390 px e "
    "navegação pelo avatar aprovadas, com dados isolados apenas no roteiro do navegador. "
    "Capturas: `app/mobile/output/home-logo-aplicada-320.png` e "
    "`app/mobile/output/home-logo-aplicada-390.png`. Aparência nativa ainda não validada em aparelho."
)
if "--apply" in sys.argv:
    manifest = json.loads((review / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest:
        assert hashlib.sha256((root / item["path"]).read_bytes()).hexdigest() == item["sha256"], "Documento mudou após revisão"
    for item in manifest:
        (root / item["path"]).write_bytes((review / item["copy"]).read_bytes())
        print(f"Atualizado: {item['path']}")
else:
    result = json.loads((mobile / "output/home-logo-applied-results.json").read_text(encoding="utf-8"))
    assert len(result["measurements"]) == 2 and result["avatarNavigation"] and not result["errors"]
    review.mkdir(exist_ok=True)
    manifest, diffs = [], []
    for relative, heading, filename in [("PRD_VIVO.md", "## 1. Estado geral do projeto", "PRD_VIVO.md"), ("docs/BACKLOG.md", "## Status", "BACKLOG.md")]:
        original = (root / relative).read_bytes()
        source = original.decode("utf-8")
        nl = "\r\n" if "\r\n" in source else "\n"
        anchor = heading + nl + nl
        pending = "- [ ] Aplicar a logo escolhida pelo usuário no topo da Home mobile."
        assert source.count(anchor) == 1 and source.count(pending) == 1 and "Logo da Home, opção 4 aplicada" not in source
        updated = source.replace(pending, "- [x] Aplicar a logo escolhida pelo usuário no topo da Home mobile — opção 4, assinatura compacta.")
        updated = updated.replace("**Pendente: usuário escolher a versão para aplicação na Home mobile.**", "**Escolha desta etapa atendida: usuário selecionou a opção 4, aplicada em 2026-10-08.**")
        updated = updated.replace(anchor, anchor + summary + nl + nl, 1)
        if relative == "PRD_VIVO.md":
            updated += nl + nl + "### Marco — 2026-10-08: assinatura compacta aplicada na Home" + nl + nl + summary + nl
        (review / filename).write_bytes(updated.encode("utf-8"))
        manifest.append({"path": relative, "copy": filename, "sha256": hashlib.sha256(original).hexdigest()})
        diffs.extend(difflib.unified_diff(source.splitlines(), updated.splitlines(), fromfile=relative, tofile=relative, lineterm=""))
    (review / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (review / "changes.diff").write_text("\n".join(diffs), encoding="utf-8")
    print("PRD/BACKLOG preparados; raiz ainda não alterada.")
