Aplicações autorizadas na LAN eram bloqueadas como alvo privado, e a descoberta manual encontrava apenas links `<a href>` entre aspas. O DAST agora aceita HTTP/HTTPS internos e públicos e usa o Spider tradicional do OWASP ZAP antes da análise passiva, descobrindo também recursos, robots e sitemap.

- Real continua explícito, com confirmação, ADMIN/PENTESTER e ownership. Falhas permanecem FAILED, sem fallback de demonstração.
- Spider limitado à origem/subárvore, profundidade 2, 30 filhos por nó, uma thread, parsing até 1 MB e duração de 1..10 min. Queries são excluídas diretamente no Spider; forms/POST, JavaScript/AJAX e active scan ficam desligados.
- Perfil, URLs e limites registrados por execução; PDF histórico sem artefato indica método não registrado, sem atribuição retroativa.
- README reorganizado com div/style, tabelas HTML, instalação, features, arquitetura, limites e três prints reais. PRD/BACKLOG/roadmap/vault/changelog sincronizados; ADR-045/046.

Validação final: API focal **104/104**, full **642/642 em 43 suítes**, build/lint alterado aprovados; web **338/338 em 30 suítes**, contraste **66/66**, lint **0 erros/9 avisos preexistentes**; Docker API/web reconstruídos e serviços recriados. `npm run check` global API continua bloqueado pelos dois imports não usados preexistentes em `vulnerability.service.ts:45`; testes executados separadamente.

Scan real ZAP 2.17.0 em fixture controlada: **26,641 s, 9 URLs e 14 findings**, COMPLETED/100%/não simulado. Log comprova **10 GETs**, sem query, formulários, caminhos sensíveis, outra origem ou profundidade além do limite. UI, HTML e PDFs novo/legado exportados/renderizados/inspecionados. A primeira prova expôs um GET com query apesar do contexto; exclusão própria do Spider foi adicionada e a prova repetida. O cenário LAN anterior também validou cadastro Application/Project, triagem, promoção e início da correção.

Sem schema/migration, dependências ou lockfile. Alterações anteriores do usuário preservadas e excluídas do commit. Spider tradicional não cobre rotas exclusivas de JavaScript, autenticação ou exploração ativa. Não há bloqueio SSRF por faixa de endereço, conforme a autorização registrada no ADR-045.

Evidências: [Spider e README](https://github.com/guimunizzz/Vulnera-TCC/blob/codex/fix-dast-network-targets/docs/DAST-SPIDER-VALIDACAO-2026-10-09.md), [prova LAN anterior](https://github.com/guimunizzz/Vulnera-TCC/blob/codex/fix-dast-network-targets/docs/DAST-REDE-VALIDACAO-2026-10-09.md).
