"""Registra o deslize curto entre abas e sincroniza as tarefas visuais anteriores.

Prepara cópias revisáveis dos documentos vivos antes de escrever na raiz.
Consumidor: fechamento desta tarefa; --apply requer autorização de escrita.
"""
from pathlib import Path
import difflib
import hashlib
import json
import sys

mobile = Path(__file__).resolve().parents[1]
root = mobile.parents[1]
review = mobile / "output/short-slide-docs-review"
summary = (
    "**✅ 2026-10-09 — Deslize curto com fade entre abas (100%).** Configurações entra pela direita "
    "e Home pela esquerda, com deslocamento de **28 px**, fade e duração de **320 ms**. "
    "Interpolação usa o progresso de navegação das abas; funciona pelo avatar e pelos botões da barra, "
    "preservando a pilha do projeto e os eventos existentes. Mesmo tempo/curva do indicador e dos ícones. "
    "Preferência de movimento reduzido remove a transição; nenhuma nova dependência, consulta ou mudança "
    "no conteúdo das telas. Typecheck/lint e export web aprovados; **7/7 verificações no navegador**, "
    "com medidas por frame das duas direções, limite de 28 px, posição final, fade, escala dos ícones, "
    "trocas rápidas, teclado, avatar, retorno ao projeto e logout, sem exceções. Dados isolados "
    "somente no roteiro de QA; aparência nativa e API real não validadas nesta tarefa. "
    "Evidências em `app/mobile/output/short-slide-navigation-results.json`. "
    "**Sincronização das etapas anteriores:** a barra voltou ao indicador deslizante da opção 1 "
    "(linha 24×3 px, deslocamento de 79 px, ícone selecionado 1,1×), substituindo a luz da opção 2; "
    "Configurações reutiliza a assinatura compacta da Home, com MINHA CONTA à direita. "
    "Projeto/vulnerabilidade mantêm retorno e título. Histórico anterior preservado."
)
if "--apply" in sys.argv:
    manifest = json.loads((review / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest:
        assert hashlib.sha256((root / item["path"]).read_bytes()).hexdigest() == item["sha256"], "Documento mudou após revisão"
    for item in manifest:
        (root / item["path"]).write_bytes((review / item["copy"]).read_bytes())
        print(f"Atualizado: {item['path']}")
else:
    result = json.loads((mobile / "output/short-slide-navigation-results.json").read_text(encoding="utf-8"))
    assert result["passed"] == 7 and not result["errors"]
    review.mkdir(exist_ok=True)
    manifest, diffs = [], []
    for relative, heading, filename in [("PRD_VIVO.md", "## 1. Estado geral do projeto", "PRD_VIVO.md"), ("docs/BACKLOG.md", "## Status", "BACKLOG.md")]:
        original = (root / relative).read_bytes()
        source = original.decode("utf-8")
        nl = "\r\n" if "\r\n" in source else "\n"
        anchor = heading + nl + nl
        assert source.count(anchor) == 1 and "Deslize curto com fade entre abas (100%)" not in source
        updated = source.replace("Modelo 7, animação 2 entregue (100% desta etapa)", "Modelo 7, animação 2 entregue (100% desta etapa; substituída pela restauração da opção 1 em 2026-10-09)")
        tasks = "- [x] Aplicar a assinatura compacta em Configurações." + nl + "- [x] Restaurar o indicador deslizante da opção 1." + nl + "- [x] Aplicar deslize curto de 28 px com fade de 320 ms entre Home e Configurações."
        updated = updated.replace(anchor, anchor + summary + nl + nl + tasks + nl + nl, 1)
        if relative == "PRD_VIVO.md":
            updated += nl + nl + "### Marco — 2026-10-09: deslize curto com fade entre abas" + nl + nl + summary + nl
        (review / filename).write_bytes(updated.encode("utf-8"))
        manifest.append({"path": relative, "copy": filename, "sha256": hashlib.sha256(original).hexdigest()})
        diffs.extend(difflib.unified_diff(source.splitlines(), updated.splitlines(), fromfile=relative, tofile=relative, lineterm=""))
    (review / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (review / "changes.diff").write_text("\n".join(diffs), encoding="utf-8")
    print("PRD/BACKLOG preparados; raiz ainda não alterada.")
