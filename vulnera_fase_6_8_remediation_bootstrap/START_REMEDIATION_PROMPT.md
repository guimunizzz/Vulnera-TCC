# START — Vulnera Fase 6.8

Modelo recomendado da thread principal: **GPT-5.6 Sol / reasoning high**.

Leia e execute a Skill:

`$vulnera-fase-6-8-remediation`

Use como fonte de execução o prompt original da fase, se estiver disponível no repositório:

`PROMPT_FASE_6.8_FINDINGS.md`

Se não estiver, a Skill já contém o contrato normalizado em `references/CHECKPOINTS.md`.

Regras adicionais desta sessão:

- branch esperada: `fix/fase-6.8-findings-p1`;
- não faça `git commit`;
- não abra PR;
- não pule checkpoints;
- dentro de cada checkpoint, use os agentes e o protocolo RED → PATCH → GREEN → REVIEW → CLOSURE;
- não feche finding sem satisfazer o `CLOSURE_CRITERIA` e o tipo de `VALIDATION_REQUIRED` registrado no consolidado;
- reporte o encerramento de cada checkpoint e prossiga automaticamente, exceto nas STOP CONDITIONS da Skill.

Comece pelo Gate -1 e depois CP0.
