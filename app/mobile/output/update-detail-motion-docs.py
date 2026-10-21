"""Prepara documentos vivos e ADR da navegação suave antes da escrita na raiz.

Preserva o histórico e valida hashes para não sobrescrever mudanças posteriores.
Consumidor: fechamento da tarefa mobile; --apply depende de escrita autorizada.
"""
from pathlib import Path
import difflib
import hashlib
import json
import sys

mobile = Path(__file__).resolve().parents[1]
root = mobile.parents[1]
review = mobile / "output/detail-motion-docs-review"
adr_path = "docs/Vulnera/07-Decisoes/ADR-046 - Transicoes curtas no stack de projetos mobile.md"
summary = """**✅ 2026-10-09 — Movimento suave em projetos e detalhes (100%; 5/5 melhorias).** Branch `mobile/api`: projeto e vulnerabilidade entram pela direita e a tela anterior retorna pela esquerda, com deslize de **28 px**, fade e duração de **320 ms**. Home, Minha conta e detalhes apresentam blocos em sequência com subida de **8 px**, entrada de 280 ms e atrasos limitados a 180 ms. Skeletons com brilho discreto cobrem a primeira carga de métricas, projetos, vulnerabilidade, evidências e comentários; conteúdos carregados entram por fade. Informações e comentários expandem/recolhem altura e opacidade em **260 ms**, medindo o texto real e anunciando o estado do controle. Comentários começam abertos; vetor CVSS começa recolhido. Movimento reduzido remove essas animações; o brilho para fora do foco ou com app inativo. Consultas, paginação, retentativas e distinção entre erro/vazio continuam iguais. Apenas o stack aninhado de projetos usa `expo-router/js-stack`, já fornecido pelo Expo Router instalado, para controlar o deslocamento exato (ADR-046). Typecheck, lint e exports web/Android aprovados; **10/10 verificações de interação** no navegador e **7/7 de regressão da barra/abas**, com fixtures isoladas, sem validar API real ou desempenho em aparelho nesta tarefa. Relatório: `app/mobile/output/detail-motion-report.md`.

**Estado visual vigente das entregas anteriores:** Configurações usa a assinatura compacta da Home com MINHA CONTA à direita. A barra está novamente na **opção 1**, com indicador deslizante e ícone selecionado em 1,1×, 320 ms; substitui a luz da opção 2. Home ↔ Configurações usa deslize de 28 px com fade em 320 ms, inclusive pelo avatar. Os registros de 2026-10-08 são históricos e permanecem preservados."""
tasks = """- [x] Aplicar a assinatura compacta da Home em Configurações.
- [x] Restaurar o indicador deslizante da opção 1 e o deslize curto entre abas.
- [x] Animar abertura/retorno de projeto e vulnerabilidade com fade e 28 px em 320 ms.
- [x] Apresentar blocos de Home, conta e detalhes em sequência curta.
- [x] Mostrar skeleton durante a primeira consulta, preservando erro e vazio.
- [x] Expandir/recolher informações e comentários com altura medida e estado acessível.
- [x] Validar movimento reduzido, paginação e regressão de navegação no navegador.
- [ ] Validar suavidade, gesto de retorno e leitura de tela em aparelho Android/iOS."""
architecture = """
## Movimento e navegação — atualização de 2026-10-09

O stack aninhado de Home/projeto/vulnerabilidade usa `Stack` de `expo-router/js-stack`. O interpolador combina o progresso da rota atual e da próxima para aplicar 28 px e fade em 320 ms na ida e no retorno; root e abas mantêm os navegadores existentes. Gesto horizontal de retorno usa o mesmo progresso; saiu a configuração de gesto de tela inteira do stack nativo. O módulo de gestos já vem na árvore instalada do Expo Router; nenhum manifesto ou lockfile mudou.

`MotionReveal` aceita distância opcional: as telas autenticadas usam 8 px com atraso máximo de 180 ms e duração de 280 ms. O padrão anterior continua para consumidores existentes. `WorkspaceSkeleton` compartilha um relógio de brilho por grupo, pausado por foco, estado do app e movimento reduzido. `WorkspaceDisclosure` mede o conteúdo real para animar altura/opacidade em 260 ms, com controles de pelo menos 48 px e conteúdo recolhido oculto à acessibilidade. Skeletons só representam espera; não adicionam dados de demonstração ou consultas.

A barra vigente é o indicador deslizante da opção 1 (320 ms), e Home/Configurações usam fade com deslize de 28 px. A assinatura compacta está nos cabeçalhos Home e Minha conta; detalhes preservam retorno e título. Ver [[ADR-046 - Transicoes curtas no stack de projetos mobile]]. Exports web/Android e QA no navegador aprovados; avaliação nativa permanece pendente.
"""
product = """
## Comportamento visual vigente — 2026-10-09

Home e Configurações compartilham a assinatura compacta; a barra usa o indicador roxo deslizante da opção 1. Abrir projeto/vulnerabilidade e alternar Home/Configurações aplica deslize curto com fade de 320 ms, com direção invertida no retorno. Blocos entram em sequência, skeletons indicam a primeira espera da API e informações/comentários permitem expansão suave. Comentários são mostrados inicialmente; o vetor CVSS é expansível. A preferência por movimento reduzido aplica estados diretamente. O escopo continua de consulta, com contratos reais, paginação e erros separados de vazio. Aparência e desempenho nativos ainda precisam de validação em aparelho.
"""
adr = """---
type: decisao
tags: [decision, mobile, navigation, animation, accessibility]
status: vigente
codigo: ADR-046
data: 2026-10-09
---

# ADR-046 - Transicoes curtas no stack de projetos mobile

## Contexto

O usuário pediu continuidade suave ao abrir projetos, vulnerabilidades e abas, com deslocamento discreto como o já escolhido para Home/Configurações. O preset `slide_from_right` do stack nativo deslocava a largura da tela e não oferecia o controle de 28 px com fade nas duas direções. Também pediu entrada em sequência, skeletons e expansão animada, mantendo os dados e fluxos existentes.

## Decisão

- Usar `Stack` de `expo-router/js-stack` somente no fluxo Home → projeto → vulnerabilidade. O Expo Router instalado já disponibiliza esse navegador e seus módulos de gestos; não adicionar dependências nem alterar os outros navegadores.
- Combinar `current.progress` e `next.progress` no interpolador, com posições 28/0/−28 px e opacidades 0/1/0. Aplicar timing de 320 ms e curva Bézier (0.22, 1, 0.36, 1), também no retorno. Manter gesto horizontal de borda, sem a antiga opção nativa de gesto na tela inteira.
- Reutilizar `MotionReveal` com distância de 8 px, duração de 280 ms e atrasos até 180 ms. Valores padrão continuam para outros consumidores.
- Mostrar skeleton apenas na primeira carga, com um relógio por grupo e brilho pausado quando fora de foco, app inativo ou movimento reduzido. Não acrescentar dados fictícios à aplicação.
- Medir a altura real dos textos em `WorkspaceDisclosure` e animar altura/opacidade em 260 ms. Anunciar expansão ao leitor de tela e ocultar conteúdo recolhido. Comentários começam abertos e permanecem paginados; vetor CVSS começa recolhido.
- Respeitar movimento reduzido com transições imediatas. Manter API, cache, sessão, erros, atualização manual e escopo CLIENT de consulta existentes.

## Consequências

A ida e o retorno compartilham uma direção consistente com movimento limitado. A pilha de projetos passa a ser renderizada pelo stack JS, exigindo avaliação de fluidez, memória e gesto no aparelho; export Android e preview web não demonstram esse desempenho. O gesto deixa de ocupar a tela inteira e usa a configuração de borda do stack JS. Animações de texto acompanham mudanças de fonte/largura sem altura fixa. Novos componentes visuais não consultam nem alteram recursos do servidor. Login e demais stacks mantêm a navegação anterior.

## Relacionado

- [[ADR-004 - Mobile cliente e read-mostly]]
- [[ADR-027 - Mobile fora do workspace npm da raiz]]
- [[ADR-045 - Consulta mobile paginada e isolamento de sessao]]
- `app/mobile/app/(tabs)/home/_layout.tsx`
- `app/mobile/output/detail-motion-report.md`
"""

stable = "--stable" in sys.argv
compatibility = "--compat" in sys.argv or stable
marker = "Movimento suave em projetos e detalhes (100%"
milestone = "movimento suave em projetos e detalhes"
if compatibility:
    review = mobile / "output/gesture-compatibility-docs-review"
    compatibility_result = json.loads((mobile / "output/gesture-compatibility-results.json").read_text(encoding="utf-8"))
    assert compatibility_result["passed"] == 3
    marker = "Compatibilidade de gestos com Expo Go (100%"
    milestone = "compatibilidade de gestos com Expo Go"
    summary = """**✅ 2026-10-09 — Compatibilidade de gestos com Expo Go (100% da correção; confirmação no aparelho pendente).** O usuário reportou crash iOS em `RNGestureHandlerModule.installUIRuntimeBindings` após a troca para o stack JS. A resolução transitiva carregava Gesture Handler **3.3.0**, enquanto o Expo SDK 57 instalado e sua documentação indicam **~2.32.0**. A exportação anterior não detectou essa incompatibilidade de ABI; o fechamento visual anterior não comprovava execução nativa. `npx expo install react-native-gesture-handler` adicionou a faixa compatível como dependência direta e regenerou o lockfile pelo npm. Stack JS, deslize de 28 px/fade em 320 ms, skeletons, expansão e API mantidos. Verificação de matriz/resolução/lockfile **3/3**, UI **10/10**, navegação **7/7**, typecheck, lint e exports iOS/web aprovados. Limitações de notificações no Expo Go são avisos separados e permanecem sem alteração nesta correção. Para aplicar no aparelho: parar Metro, fechar Expo Go e reiniciar com `npx expo start --clear`. Relatório: `app/mobile/output/gesture-compatibility-report.md`; complemento do ADR-046."""
    tasks = """- [x] Diagnosticar a incompatibilidade Gesture Handler JS 3.x × módulo nativo 2.x.
- [x] Declarar a faixa do SDK e atualizar o lockfile pelo instalador oficial.
- [x] Conferir resolução do stack/drawer, bundle iOS e regressão das animações.
- [ ] Confirmar abertura, retorno e ausência do crash no Expo Go iOS do usuário após limpar Metro."""
    summary += "\n\n**Dependência do preview web:** a reinstalação expôs `react-native-web` ausente do manifesto, embora o preview anterior o utilizasse como pacote opcional instalado. O export web falhou por módulo ausente; `npx expo install react-native-web` declarou `^0.21.2` e atualizou o lockfile para tornar o preview e a regressão reproduzíveis. Essa dependência não é a causa do crash iOS."
    architecture = """
## Correção de compatibilidade Expo Go — 2026-10-09

A entrega inicial do stack JS usava uma dependência transitiva de gestos sem verificar a ABI do Expo Go. A resolução 3.3.0 chamava um método ausente no módulo nativo 2.x, causando o crash iOS reportado pelo usuário. O pacote `react-native-gesture-handler` agora é dependência direta em `~2.32.0`, alinhada ao `expo/bundledNativeModules.json` instalado e à [documentação SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/gesture-handler/). Manifesto e lockfile foram atualizados pelo instalador, substituindo a afirmação anterior de que bastava a dependência transitiva. Navegadores e transições continuam iguais. Export iOS e QA estático/web passaram; confirmação no aparelho pendente. Os avisos de `expo-notifications` no Expo Go são separados desta falha e não foram ocultados.

O preview web também passou a declarar `react-native-web` (`^0.21.2`), instalado pelo Expo após o export detectar módulo ausente na reinstalação. Antes era um peer opcional presente em `node_modules`, sem dependência direta. Essa correção permite repetir o QA existente e usar o script web de forma reproduzível; não introduz uma nova plataforma distribuída.
"""
    product = """
## Compatibilidade da prévia no Expo Go — 2026-10-09

A resolução do módulo de gestos foi fixada na faixa nativa do SDK 57 para corrigir o crash iOS após a mudança de navegador. As animações e funções de consulta seguem as mesmas. É necessário reiniciar o Metro com cache limpo e reabrir o Expo Go para carregar a versão corrigida. A confirmação no aparelho do usuário continua pendente; avisos de limitações de push no Expo Go permanecem separados do crash.
"""
    adr = (root / adr_path).read_text(encoding="utf-8")
    adr += "\n## Complemento — 2026-10-09: ABI de gestos no Expo Go\n\nA decisão inicial dispensava dependência direta porque o módulo já estava instalado. O crash iOS reportado pelo usuário mostrou que presença na árvore não garante compatibilidade nativa: a versão JS 3.3.0 chamava `installUIRuntimeBindings`, ausente no Expo Go com módulo 2.x. Essa parte da decisão fica substituída pela dependência explícita `~2.32.0`, instalada com `npx expo install` e lockfile gerado pelo npm. As transições permanecem no stack JS. A matriz instalada, a resolução e o lockfile foram conferidos, além de export iOS e regressão web; confirmação física permanece pendente. Export bem-sucedido não testa ABI ou execução nativa.\n"

if stable:
    review = mobile / "output/stable-motion-docs-review"
    marker = "Animações com layout estável (100%"
    milestone = "animações com layout estável"
    dependency_history = summary
    summary = """**✅ 2026-10-09 — Animações com layout estável (100% da implementação; fluidez no aparelho pendente).** Após o usuário relatar oscilação visual/travadas, a pilha de projetos voltou ao **Stack nativo** do Expo Router: `simple_push` em 320 ms no iOS e `slide_from_right` no Android. O deslize nativo passa a ocupar a largura da tela nos detalhes, substituindo o limite de 28 px/fade do stack JS. Home/Configurações mantêm 28 px e 320 ms, mas a opacidade da cena varia apenas de 96% a 100%. `WorkspaceScreen` deixa de animar a tela inteira; seus blocos autenticados começam visíveis (opacidade mínima de 96%), sobem até 4 px em 220 ms e usam atrasos até 60 ms. Login continua com o movimento anterior. Seções abertas usam altura natural desde a primeira renderização; altura/opacidade em 260 ms ficam restritas à interação do usuário. Animações automáticas de layout foram removidas dessa área e listas animam somente os primeiros quatro projetos/findings e três comentários. Skeletons têm uma única variação de opacidade de 94% a 100% por grupo, sem SVG animado por linha; toque tem escala/opacidade menores na área autenticada. API, erros, paginação, glass, marca e indicador permanecem. Typecheck/lint e exports web/iOS/Android aprovados; **10/10 verificações funcionais dos detalhes e 7/7 da barra/abas** no navegador, com fixtures isoladas. Nenhum benchmark de FPS/latência ou avaliação de transição nativa em aparelho foi realizado. ADR-047 substitui a decisão de stack JS do ADR-046. Relatório: `app/mobile/output/stable-motion-report.md`."""
    summary += "\n\n### Marco intermediário — correção de dependências anterior ao ajuste de fluidez\n\n" + dependency_history
    tasks = """- [x] Remover fade da tela inteira e limitar movimento dos blocos autenticados.
- [x] Restaurar o navegador nativo para abrir/voltar nos detalhes.
- [x] Montar seções abertas com altura natural e animar apenas o toque.
- [x] Reduzir animações simultâneas de listas, skeletons e feedback de toque.
- [x] Revalidar rotas, comentários, erro/vazio e preferência de movimento reduzido.
- [ ] Avaliar fluidez, gesto de retorno e ausência de oscilação no iOS/Android do usuário."""
    architecture += """
## Navegação e layout vigentes — 2026-10-09, revisão após feedback no iOS

O stack JS descrito acima foi substituído pelo `Stack` nativo de `expo-router` no fluxo Home → projeto → vulnerabilidade. iOS usa `simple_push` em 320 ms, sem fade de rota; Android usa `slide_from_right` com duração administrada pela plataforma. O deslocamento dos detalhes agora é o da navegação nativa, sem limite de 28 px. Abas continuam com deslize de 28 px em 320 ms, reduzindo o fade a opacidade 0.96–1.

`WorkspaceScreen` usa wrappers estáticos. `WorkspaceContentMotionProvider` limita os reveals autenticados a 4 px/220 ms, atraso de 60 ms e opacidade mínima 0.96, desativando seus `LinearTransition` concorrentes; consumidores fora da tela autenticada mantêm o comportamento anterior. `WorkspaceDisclosure` mantém conteúdo inicial expandido no fluxo natural: só após toque passa à medição absoluta/altura animada. `WorkspaceSkeleton` anima uma opacidade mínima por grupo, sem brilho SVG por linha; lists limitam entradas automáticas aos primeiros itens. A intenção é remover sumiços e trabalho simultâneo, sem alegar FPS medido. Ver [[ADR-047 - Navegacao nativa e layout estavel no mobile]]. As declarações anteriores de stack JS são históricas e ficam substituídas por esta seção.
"""
    product += """
## Ajuste de fluidez — estado vigente em 2026-10-09

Detalhes de projeto/vulnerabilidade usam o deslize nativo do aparelho. Home/Configurações mantêm o deslocamento curto, com variação mínima de opacidade. Blocos começam visíveis; seções abertas já ocupam sua altura correta e só expandem/recolhem ao tocar. Carregamento e toque têm efeitos mais discretos e menos animações simultâneas. O login mantém sua suavidade anterior. A revisão foi validada funcionalmente em preview e compilação; a fluidez real precisa ser avaliada no aparelho.
"""
    adr = adr.replace("status: vigente", "status: substituida", 1)
    adr += "\n## Substituição — 2026-10-09: navegação nativa e layout estável\n\nApós o usuário relatar oscilação e travadas nas animações, a decisão de stack JS com deslocamento exato/fade foi substituída pelo ADR-047. O navegador vigente é o Stack nativo. Reveals autenticados, skeletons e montagem inicial dos disclosures também foram simplificados. A correção de dependência Gesture Handler permanece. O texto anterior registra a decisão histórica, não a navegação atual.\n"
    native_adr = """---
type: decisao
tags: [decision, mobile, navigation, animation, performance]
status: vigente
codigo: ADR-047
data: 2026-10-09
---

# ADR-047 - Navegacao nativa e layout estavel no mobile

## Contexto

O usuário relatou que a revisão com stack JS e 28 px/fade parecia piscar e travar no aparelho. A tela inteira e seus blocos animavam opacidade ao mesmo tempo. Disclosures inicialmente abertos começavam com altura zero e cresciam durante a navegação, enquanto seus pais também tinham animações de layout. Listas longas e skeletons acrescentavam várias animações de montagem. A versão de gestos já foi alinhada ao SDK, mas compatibilidade e export não demonstravam fluidez nativa.

## Decisão

- Restaurar `Stack` de `expo-router` no fluxo de projetos, delegando a navegação à plataforma: `simple_push` em 320 ms no iOS, `slide_from_right` no Android. Usar gesto horizontal e respeitar movimento reduzido. Abandonar o limite customizado de 28 px nos detalhes.
- Manter indicador/ícones da opção 1 e o deslize curto de 28 px/320 ms entre abas, com opacidade apenas de 0.96 a 1, para evitar a cena apagar durante a troca.
- Usar wrappers estáticos para a tela inteira. No contexto autenticado, limitar reveal a 4 px, 220 ms, atraso máximo de 60 ms e opacidade mínima 0.96; desativar `LinearTransition` concorrente. Fora desse contexto, incluindo login, manter os padrões anteriores.
- Montar disclosures inicialmente abertos com altura natural. Só animar altura/opacidade após interação explícita, em 260 ms. Continuar medindo conteúdo real e anunciando expansão à acessibilidade.
- Limitar entradas automáticas de listas aos primeiros quatro projetos/findings e três comentários. Usar um efeito de opacidade de 0.94 a 1 por grupo de skeleton, pausado por foco/app/preferência de movimento reduzido.
- Preservar API, paginação, sessão, erros, glass e as dependências compatíveis declaradas na correção de gestos.

## Consequências

O fluxo abre com layout estável e evita combinar sumiço da tela, crescimento inicial e vários deslocamentos. O stack nativo permite animações/gestos administrados pelo iOS/Android; o tradeoff é perder o deslocamento exato de 28 px nos detalhes. A versão web não reproduz a transição nativa. Typecheck, exports e testes de navegador confirmam montagem e funções; FPS, latência, fluidez, blur e gesto precisam de avaliação física. Não há promessa de 60/120 FPS baseada no preview.

## Relacionado

- [[ADR-046 - Transicoes curtas no stack de projetos mobile]] (navegação substituída)
- [[ADR-045 - Consulta mobile paginada e isolamento de sessao]]
- [Native Stack — React Navigation](https://reactnavigation.org/docs/native-stack-navigator/)
- `app/mobile/output/stable-motion-report.md`
"""

if "--apply" in sys.argv:
    manifest = json.loads((review / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest:
        target = root / item["path"]
        if item["sha256"] is None:
            assert not target.exists(), "ADR já existe; revisar antes de gravar"
        else:
            assert hashlib.sha256(target.read_bytes()).hexdigest() == item["sha256"], "Documento mudou após revisão"
    for item in manifest:
        (root / item["path"]).write_bytes((review / item["copy"]).read_bytes())
        print(f"Atualizado: {item['path']}")
else:
    results = json.loads((mobile / ("output/stable-motion-results.json" if stable else "output/detail-motion-results.json")).read_text(encoding="utf-8"))
    navigation = json.loads((mobile / "output/short-slide-navigation-results.json").read_text(encoding="utf-8"))
    assert results["passed"] == 10 and not results["errors"]
    assert navigation["passed"] == 7 and not navigation["errors"]
    review.mkdir(exist_ok=True)
    manifest, diffs = [], []
    documents = [
        ("PRD_VIVO.md", "PRD_VIVO.md", "## 1. Estado geral do projeto", summary + "\n\n" + tasks),
        ("docs/BACKLOG.md", "BACKLOG.md", "## Status", summary + "\n\n" + tasks),
        ("docs/Vulnera/04-Arquitetura/Mobile Expo.md", "Mobile Expo.md", None, architecture),
        ("docs/Vulnera/03-Produto/Plataformas/Mobile Cliente.md", "Mobile Cliente.md", None, product),
        (adr_path, "ADR-046.md", None, adr),
    ]
    if stable:
        native_path = "docs/Vulnera/07-Decisoes/ADR-047 - Navegacao nativa e layout estavel no mobile.md"
        assert not (root / native_path).exists()
        documents.append((native_path, "ADR-047.md", None, native_adr))
    for relative, filename, heading, added in documents:
        target = root / relative
        original = target.read_bytes() if target.exists() else None
        assert relative != adr_path or original is None or compatibility
        source = original.decode("utf-8") if original is not None else ""
        nl = "\r\n" if "\r\n" in source else "\n"
        added = added.replace("\n", nl)
        if heading:
            anchor = heading + nl + nl
            assert source.count(anchor) == 1
            assert marker not in source
            updated = source.replace("Modelo 7, animação 2 entregue (100% desta etapa)", "Modelo 7, animação 2 entregue (100% desta etapa; substituída pela restauração da opção 1 em 2026-10-09)")
            if stable:
                updated = updated.replace("Movimento suave em projetos e detalhes (100%; 5/5 melhorias)", "Movimento suave em projetos e detalhes (100%; 5/5 melhorias; revisão substituída pelo ADR-047)")
            updated = updated.replace(anchor, anchor + added + nl + nl, 1)
            if relative == "PRD_VIVO.md":
                updated += nl + "### Marco — 2026-10-09: " + milestone + nl + nl + summary.replace("\n", nl) + nl
        elif relative == adr_path and compatibility:
            updated = added
        else:
            updated = source + (nl if source else "") + added
        (review / filename).write_bytes(updated.encode("utf-8"))
        manifest.append({"path": relative, "copy": filename, "sha256": hashlib.sha256(original).hexdigest() if original is not None else None})
        diffs.extend(difflib.unified_diff(source.splitlines(), updated.splitlines(), fromfile=relative, tofile=relative, lineterm=""))
    (review / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (review / "changes.diff").write_text("\n".join(diffs), encoding="utf-8")
    print(f"{len(documents)} documentos preparados para revisão; raiz ainda não alterada.")
