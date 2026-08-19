# Mapa de instalação do bootstrap

- `templates/codex/agents/` → `.codex/agents/`
- `templates/codex/config.fragment.toml` → merge em `.codex/config.toml`
- `templates/skill/vulnera-implementation-audit/` → `.agents/skills/vulnera-implementation-audit/`
- `templates/docs/code-review/README.md` → `docs/code-review/README.md`
- `templates/docs/code-review/MASTER_CHECKLIST.md` → `docs/code-review/MASTER_CHECKLIST.md`

Durante a revisão, toda escrita deve ficar em:

`docs/code-review/**`

Estrutura de trabalho criada no SETUP:

```text
docs/code-review/
├── README.md
├── MASTER_CHECKLIST.md
├── SETUP_REPORT.md
├── state/
│   ├── CHECKLIST_MANIFEST.md
│   ├── REQUIREMENT_SEEDS.jsonl
│   ├── REQUIREMENT_REGISTRY.md
│   └── ARCHITECTURE_MAP.md
├── findings/
├── reviews/
├── runtime/
├── VULNERA_IMPLEMENTATION_AUDIT.md
└── RECOMMENDATIONS.md
```

`MASTER_CHECKLIST.md` é imutável durante a auditoria.
