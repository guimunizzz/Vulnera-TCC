# Atualiza os documentos vivos com a entrega mobile e preserva o conteúdo anterior.
# Prepara cópias e um diff para revisão; só grava fora do mobile com --apply.
# Consumidor: encerramento da sessão, conforme AGENTS.md R1-R5.
from pathlib import Path
import difflib
import hashlib
import json
import sys

local = Path(__file__).resolve().parent
repository = local.parents[2]
review = local / "docs-review"
manifest_path = review / "manifest.json"
summary = "**✅ 2026-10-06 — Refatoração autenticada do mobile e integração real (100%).** Branch `mobile/api`: Home, ProjectDetail, FindingDetail, Minha conta e navegação redesenhados com violeta/liquid glass, conforme autorização visual do usuário; login e seus tokens/componentes preservados. Projetos, perfil, vulnerabilidades, evidências e comentários usam a API real; paginação de findings/comentários, facetas do servidor, estados de erro separados de vazio e limpeza de cache por sessão. Refresh concorrente/conta trocada e Retry-After tratados. Typecheck/lint aprovados, exports Android/web aprovados, **30/30 checks** (10 API real, 6 cliente HTTP, 14 UI). Sem mudanças na API/schema/migrations ou manifestos/lockfiles. Validação visual em preview 390/320 px; aparência nativa e push no aparelho continuam pendentes. Relatório: `app/mobile/output/mobile-refactor-report.md`; ADR-045."

def build():
    updates = {}
    originals = {}
    def read(relative):
        target = (repository / relative).resolve()
        if not target.is_relative_to(repository):
            raise ValueError("Destino fora do repositório")
        raw = target.read_bytes() if target.exists() else b""
        originals[relative] = raw
        return raw.decode("utf-8")
    def adapted(original, addition):
        newline = "\r\n" if "\r\n" in original else "\n"
        return addition.replace("\r\n", "\n").replace("\n", newline)
    def insert(relative, marker, addition):
        original = read(relative)
        if marker not in original:
            raise ValueError(f"Marcador ausente: {relative}")
        updates[relative] = original.replace(marker, marker + adapted(original, "\n\n" + addition), 1)
    def append(relative, addition):
        original = read(relative)
        updates[relative] = original + adapted(original, "\n\n" + addition + "\n")

    insert("PRD_VIVO.md", "## 1. Estado geral do projeto", summary)
    updates["PRD_VIVO.md"] += adapted(updates["PRD_VIVO.md"], "\n\n### Marco — 2026-10-06: mobile autenticado\n\n" + summary + "\n")
    insert("docs/BACKLOG.md", "## Status", summary + "\n\n- [x] Refatorar as quatro telas autenticadas e a navegação, mantendo login, violeta e liquid glass.\n- [x] Validar API real, paginação, tratamento de erro e isolamento de sessão no mobile.\n- [ ] Conferir blur/áreas seguras em aparelho Android/iOS e entrega de push em build compatível (validação física).")
    append("docs/ROADMAP_PROMPTS.md", "## Histórico — refatoração autenticada do mobile (2026-10-06)\n\n" + summary + "\n\n- Branch: `mobile/api`; sem commit, push ou PR.\n- Escopo: continuidade da Fase 7; não cria uma fase nova nem altera seu histórico de conclusão.\n- Desvio autorizado: visual livre nas telas após o login; roxo/liquid glass preservados.\n- Detalhes da API, autorização e fluxo read-only seguem a documentação funcional vigente.\n- As menções antigas a testar push no Expo Go Android são históricas: o código atual trata esse ambiente como indisponível. O teste de push exige um build compatível e aparelho.\n- Evidências e limites: `app/mobile/output/mobile-refactor-report.md`.")
    append("docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md", "## Sessão — mobile autenticado e API real (2026-10-06)\n\n" + summary + "\n\nA refatoração tem estilo próprio, sem alterar a aparência do login. Home usa projetos reais, ProjectDetail preserva a paginação/facetas do backend, FindingDetail carrega abas de evidências/comentários sob demanda e Minha conta consulta `/users/me`. O cache é limpo em logout/nova autenticação e refresh de conta anterior não reabre nem encerra uma nova sessão. Os testes controlados não introduzem fixtures no produto. O backend e seus dados de domínio não foram modificados nesta refatoração; as leituras autenticadas usam as contas de demonstração já existentes. A instalação temporária para preview não alterou manifestos/lockfiles. Conferência nativa e chegada de push no aparelho continuam pendentes.")
    relative = "docs/Vulnera/04-Arquitetura/Mobile Expo.md"
    original = read(relative)
    prefix = original.split("## Responsabilidades", 1)[0]
    updates[relative] = prefix + adapted(original, "## Responsabilidades no MVP\n- login exclusivo do CLIENT, sem cadastro\n- lista de projetos da empresa, com busca/status e atualização\n- detalhe de projeto com metadados, datas e lista paginada de vulnerabilidades\n- detalhe read-only de vulnerabilidade, com CVSS, OWASP, descrição, impacto, recomendação e SLA/VRS quando fornecidos\n- consulta de evidências autenticadas e comentários paginados\n- conta com perfil atualizado, logout e status compartilhado do push\n- registro de dispositivo e alertas de novas vulnerabilidades CRITICAL\n\n## Limites\n\nRelatórios/PDF e preferências de push por categoria eram citados como responsabilidades aqui, mas não integram o recorte da Fase 7. Permanecem fora do mobile atual, assim como criação/edição, upload, envio de comentários, chat, maturidade e funções de ADMIN/PENTESTER. A RN24 descreve uma evolução futura.\n\n## Consulta e sessão — atualização de 2026-10-06\n\nA identidade visual autenticada foi refeita com autorização explícita do usuário. Login e tokens anteriores foram preservados. As consultas usam os DTOs reais, paginação e facetas do servidor; falha não equivale a lista vazia. Cache por sessão é limpo em logout/troca de conta, o refresh preserva sessão em falha de rede e ignora respostas de conta anterior, e 429 respeita Retry-After. Android/iOS mantêm SecureStore; preview web guarda sessão apenas em memória. Ver [[ADR-045 - Consulta mobile paginada e isolamento de sessao]] e `app/mobile/output/mobile-refactor-report.md`.\n")
    relative = "docs/Vulnera/03-Produto/Plataformas/Mobile Cliente.md"
    original = read(relative)
    original = original.replace("Acompanhamento read-mostly de projetos, findings e relatórios, com notificações push.", "Acompanhamento read-only de projetos e findings da própria empresa, com notificações push de novas vulnerabilidades críticas.")
    updates[relative] = original + adapted(original, "\n\n## Escopo vigente do MVP\n\nCinco telas: Login, Home/Projetos, ProjectDetail, FindingDetail e Configurações/Minha conta. O cadastro acontece no web. O cliente consulta projetos, vulnerabilidades, evidências e comentários; não cria/edita dados nem envia comentários no mobile. Relatórios/PDF, chat e preferências por categoria não integram a Fase 7. Em 2026-10-06, a área autenticada recebeu visual próprio com roxo/liquid glass e integração validada contra a API real, mantendo o login. Ver `docs/ROADMAP_PROMPTS.md` e [[ADR-045 - Consulta mobile paginada e isolamento de sessao]].\n")
    relative = "docs/Vulnera/02-Dominio/Regras de Negocio/RN24 - Push mobile filtravel por categoria.md"
    original = read(relative)
    title = "# RN24 - Push mobile filtravel por categoria"
    updates[relative] = original.replace(title, title + adapted(original, "\n\n> **Requisito futuro — esclarecimento em 2026-10-06.** A regra abaixo descreve a evolução desejada, não uma função implementada no MVP. A Fase 7 oferece somente status de notificações e alertas de novas vulnerabilidades CRITICAL; não possui armazenamento nem controles de preferências por categoria. PROJECT_STATUS, CHAT_MESSAGE e FINDING_COMMENT não são gatilhos de push no mobile atual. Ver Contexto Mestre v4 e o recorte explícito da Fase 7 em `docs/ROADMAP_PROMPTS.md`."), 1)
    relative = "docs/Vulnera/07-Decisoes/ADR-045 - Consulta mobile paginada e isolamento de sessao.md"
    if (repository / relative).exists():
        raise ValueError("ADR-045 já existe; não sobrescrever")
    originals[relative] = b""
    updates[relative] = (local / "adr-mobile-session.md").read_bytes().decode("utf-8")
    review.mkdir(exist_ok=True)
    manifest = []
    diffs = []
    for relative, content in updates.items():
        staged = review / relative
        staged.parent.mkdir(parents=True, exist_ok=True)
        payload = content.encode("utf-8")
        staged.write_bytes(payload)
        manifest.append({"path": relative, "original_sha256": hashlib.sha256(originals[relative]).hexdigest(), "new_sha256": hashlib.sha256(payload).hexdigest(), "existed": (repository / relative).exists()})
        diffs.extend(difflib.unified_diff(originals[relative].decode("utf-8").splitlines(keepends=True), content.splitlines(keepends=True), fromfile=relative, tofile=relative))
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (review / "changes.diff").write_bytes("".join(diffs).encode("utf-8"))
    print(f"Preparados {len(manifest)} documentos; nenhuma gravação fora do mobile.")

def apply():
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for item in manifest:
        target = (repository / item["path"]).resolve()
        if not target.is_relative_to(repository):
            raise ValueError("Destino fora do repositório")
        raw = target.read_bytes() if target.exists() else b""
        if target.exists() != item["existed"] or hashlib.sha256(raw).hexdigest() != item["original_sha256"]:
            raise ValueError(f"Documento mudou após preparação: {item['path']}")
        payload = (review / item["path"]).read_bytes()
        if hashlib.sha256(payload).hexdigest() != item["new_sha256"]:
            raise ValueError("Cópia preparada foi alterada")
    for item in manifest:
        (repository / item["path"]).write_bytes((review / item["path"]).read_bytes())
    print(f"Atualizados {len(manifest)} documentos; histórico e edições anteriores preservados.")

if "--apply" in sys.argv:
    apply()
else:
    build()
