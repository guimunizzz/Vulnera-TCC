"""Registra a opção 2 e preserva a opção 1 como histórico substituído.

Prepara cópias revisáveis dos documentos que ficam fora da pasta mobile.
Consumidor: fechamento da tarefa; --apply exige escrita autorizada na raiz.
"""
from pathlib import Path
import difflib
import hashlib
import json
import sys

mobile = Path(__file__).resolve().parents[1]
root = mobile.parents[1]
review = mobile / "output" / "light-navigation-docs-review"
summary = (
    "**✅ 2026-10-08 — Modelo 7, animação 2 entregue (100% desta etapa).** Branch `mobile/api`: "
    "luz roxa radial atravessa a cápsula até a aba selecionada e se dissipa, com pulsação de 12% "
    "que retorna ao tamanho original e fade da tela; duração total de **400 ms**. Substitui a animação 1. "
    "Cápsula, ícones e divisória preservados. Não anima na montagem ou no toque da aba já aberta; "
    "trocas rápidas retomam o brilho da posição atual. Movimento reduzido remove brilho, pulsação e fade. "
    "Seleção acompanha a navegação real, incluindo avatar e pilha do projeto. Conteúdo das telas e API preservados. "
    "Typecheck/lint e exports web/Android aprovados; **7/7 verificações de interação** com fixtures isoladas "
    "no navegador, incluindo luz/pulsação nos dois sentidos, fade, teclado, trocas rápidas, logout e ausência "
    "de exceções. Capturas somente da Home em 320/390 px. Avaliação de suavidade e blur em aparelho físico "
    "continua pendente. Relatório: `app/mobile/output/light-navigation-report.md`."
)

if "--apply" in sys.argv:
    manifest = json.loads((review / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest:
        assert hashlib.sha256((root / item["path"]).read_bytes()).hexdigest() == item["sha256"], "Documento mudou após revisão"
    for item in manifest:
        (root / item["path"]).write_bytes((review / item["copy"]).read_bytes())
        print(f"Atualizado: {item['path']}")
else:
    result = json.loads((mobile / "output" / "light-navigation-results.json").read_text(encoding="utf-8"))
    assert result["passed"] == 7 and not result["errors"]
    review.mkdir(exist_ok=True)
    manifest, diffs = [], []
    for relative, heading, filename in [("PRD_VIVO.md", "## 1. Estado geral do projeto", "PRD_VIVO.md"), ("docs/BACKLOG.md", "## Status", "BACKLOG.md")]:
        original = (root / relative).read_bytes()
        source = original.decode("utf-8")
        newline = "\r\n" if "\r\n" in source else "\n"
        anchor = heading + newline + newline
        assert source.count(anchor) == 1 and "Modelo 7, animação 2 entregue" not in source
        pending = "- [ ] Apresentar animação 2 após avaliação da opção 1 pelo usuário."
        assert source.count(pending) == 1
        updated = source.replace(pending, "- [x] Apresentar animação 2 após avaliação da opção 1 pelo usuário — luz atravessando o vidro, 400 ms.")
        updated = updated.replace("Modelo 7, animação 1 entregue (100% desta etapa)", "Modelo 7, animação 1 entregue (100% desta etapa; animação substituída pela opção 2)")
        updated = updated.replace("**Próximo: mostrar animação 2 após o usuário experimentar a opção 1**", "**Próximo daquela etapa: mostrar animação 2 após o usuário experimentar a opção 1 (atendido em 2026-10-08)**")
        updated = updated.replace(anchor, anchor + summary + newline + newline, 1)
        if relative == "PRD_VIVO.md":
            updated += newline + newline + "### Marco — 2026-10-08: luz atravessando o vidro, opção 2" + newline + newline + summary + newline
        (review / filename).write_bytes(updated.encode("utf-8"))
        manifest.append({"path": relative, "copy": filename, "sha256": hashlib.sha256(original).hexdigest()})
        diffs.extend(difflib.unified_diff(source.splitlines(), updated.splitlines(), fromfile=relative, tofile=relative, lineterm=""))
    (review / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (review / "changes.diff").write_text("\n".join(diffs), encoding="utf-8")
    print("PRD/BACKLOG preparados para revisão; raiz ainda não alterada.")
