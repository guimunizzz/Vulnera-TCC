# Stop Conditions

PARE e peça decisão humana somente se ocorrer um destes casos:

1. **Divergência material no CP0**: o estado atual refuta ou muda substancialmente a premissa de um finding do escopo.
2. **Schema Prisma**: qualquer correção exigir alteração de `app/api/prisma/schema.prisma`. Produza primeiro o diff/proposta e pare antes de editar.
3. **Contrato público**: a correção exigir quebrar endpoint, payload, status code, schema público ou comportamento já mergeado de forma incompatível.
4. **Docker/ambiente**: Docker estiver indisponível e não houver forma equivalente de executar o ambiente necessário.
5. **Saneamento documental ausente/inconsistente** no Gate -1.
6. **Escopo humano**: `SPEC-001`, `SPEC-002` ou outra decisão de especificação for necessária para escolher entre comportamentos incompatíveis.

## Não é motivo para parar

- teste normal falhando por causa da própria implementação: corrija e reexecute;
- patch review apontando defeito local: devolva ao agente responsável;
- CP9 encontrando regressão dentro do escopo: roteie de volta ao checkpoint/agente responsável e revalide;
- falta de GitHub Actions remoto, se o workflow puder ser reproduzido localmente na mesma ordem;
- necessidade de adicionar dependência explicitamente prevista no prompt, desde que não quebre contrato e a política do repositório permita.

## Baseline vermelho no CP0

`npm run check`/build/test vermelho antes das correções não autoriza "consertar qualquer coisa".

1. classifique a falha;
2. se for causada pelo ambiente/setup necessário para CP0, corrija o mínimo para estabelecer baseline;
3. se for defeito de produto fora do escopo da Fase 6.8, registre como baseline preexistente e não o corrija automaticamente;
4. se impedir validar a fase, marque `BLOCKED` e reporte a limitação.
