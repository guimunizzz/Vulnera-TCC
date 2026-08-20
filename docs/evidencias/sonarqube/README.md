# SonarQube — evidência (Fase 8, Checkpoint 4)

**Status: pendente.** O pipeline do SonarQube nunca rodou de fato em
nenhuma fase anterior — o workflow disparava em push/PR pra `develop`, mas
a branch de integração real do GitHub sempre foi `dev` (mismatch nunca
percebido, ver `PRD_VIVO.md` marco 2026-08-11 e ADR-007).

Já corrigido nesta sessão (branch `feat/fase-8-maturidade-tcc`):

1. `.github/workflows/build.yml` — trigger agora inclui `dev` (mantendo
   `develop` por compatibilidade futura).
2. Job `test` passou a rodar com `--coverage`, publicando
   `app/api/coverage/lcov.info` como artifact; o job `sonarqube` baixa esse
   artifact antes do scan (antes o Sonar só via análise estática, cobertura
   sempre em 0%).
3. `sonar-project.properties` ganhou `sources`/`tests`/`exclusions`
   explícitos, escopados a `app/api` (único workspace com suíte de testes
   rodando no CI hoje).

**Falta**: abrir o PR `feat/fase-8-maturidade-tcc` → `dev` pra disparar o
evento `pull_request` que aciona o job — link em `PRD_VIVO.md` e no
relatório da sessão. Assim que rodar, este arquivo é substituído pelo
resumo real (Quality Gate, % de cobertura, security hotspots) + captura de
tela ou link do SonarCloud.
