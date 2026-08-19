#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

try:
    import tomllib
except ImportError:
    print("Python 3.11+ é recomendado (tomllib ausente).", file=sys.stderr)
    sys.exit(2)

REQUIRED_AGENTS = {
    "architecture_mapper",
    "checklist_indexer",
    "backend_auditor",
    "frontend_ux_auditor",
    "business_rules_auditor",
    "data_infra_auditor",
    "security_auditor",
    "test_quality_auditor",
    "flow_validator",
    "adversarial_reviewer",
}

ALLOWED_SETUP_DIRTY_PREFIXES = (
    "docs/code-review/",
    ".codex/agents/",
    ".agents/skills/vulnera-implementation-audit/",
    "vulnera_codex_code_review_bootstrap/",
)
ALLOWED_SETUP_DIRTY_FILES = {
    ".codex/config.toml",
    "vulnera_codex_code_review_bootstrap.zip",
}
ALLOWED_REVIEW_BRANCHES = {"dev", "code-review"}
AUDIT_REFERENCE_BRANCH = "dev"

def git(repo: Path, *args: str) -> tuple[int, str]:
    p = subprocess.run(["git", *args], cwd=repo, text=True, capture_output=True)
    return p.returncode, (p.stdout or p.stderr).strip()

def parse_toml(path: Path):
    with path.open("rb") as f:
        return tomllib.load(f)

def status_path(line: str) -> str:
    # porcelain v1: XY<space>path ; rename may contain "old -> new"
    body = line[3:] if len(line) >= 4 else line
    if " -> " in body:
        body = body.split(" -> ", 1)[1]
    return body.strip().strip('"')

def allowed_setup_path(path: str) -> bool:
    if path in ALLOWED_SETUP_DIRTY_FILES:
        return True
    return any(path.startswith(prefix) for prefix in ALLOWED_SETUP_DIRTY_PREFIXES)

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".")
    ap.add_argument("--write-report", action="store_true")
    ns = ap.parse_args()
    repo = Path(ns.repo).resolve()

    result = {
        "repo": str(repo),
        "git_repo": False,
        "branch": None,
        "commit": None,
        "audit_reference_branch": AUDIT_REFERENCE_BRANCH,
        "audit_reference_commit": None,
        "review_branch_derived_from_reference": None,
        "working_tree_clean": None,
        "unexpected_worktree_changes": [],
        "checklist_present": False,
        "checklist_sha256": None,
        "seeds_present": False,
        "manifest_present": False,
        "skill_present": False,
        "config_present": False,
        "config_valid": False,
        "agents": {},
        "required_agents_missing": [],
        "errors": [],
        "ready_for_review": False,
    }

    rc, _ = git(repo, "rev-parse", "--show-toplevel")
    if rc == 0:
        result["git_repo"] = True
        rc, branch = git(repo, "branch", "--show-current")
        result["branch"] = branch if rc == 0 else None
        rc, commit = git(repo, "rev-parse", "HEAD")
        result["commit"] = commit if rc == 0 and commit else None
        if result["commit"] is None:
            result["errors"].append("Não existe commit HEAD para fixar a revisão.")
        rc, reference_commit = git(repo, "rev-parse", AUDIT_REFERENCE_BRANCH)
        if rc == 0 and reference_commit:
            result["audit_reference_commit"] = reference_commit
        else:
            result["errors"].append("Audit reference branch is unavailable.")
        if result["branch"] == "code-review" and result["audit_reference_commit"]:
            rc, _ = git(repo, "merge-base", "--is-ancestor", AUDIT_REFERENCE_BRANCH, "code-review")
            result["review_branch_derived_from_reference"] = (rc == 0)
            if rc != 0:
                result["errors"].append("code-review does not derive from the audit reference branch.")
        rc, status = git(repo, "status", "--short", "--untracked-files=all")
        if rc == 0:
            result["working_tree_clean"] = (status == "")
            unexpected = []
            for line in status.splitlines():
                pth = status_path(line)
                if pth and not allowed_setup_path(pth):
                    unexpected.append(line)
            result["unexpected_worktree_changes"] = unexpected
            if unexpected:
                result["errors"].append(
                    "Existem mudanças locais fora do harness/docs/code-review; "
                    "a revisão ficaria ambígua. Resolva ou autorize explicitamente antes de iniciar."
                )
    else:
        result["errors"].append("Não é possível confirmar um repositório Git.")

    review = repo / "docs" / "code-review"
    checklist = review / "MASTER_CHECKLIST.md"
    result["checklist_present"] = checklist.exists()
    if checklist.exists():
        result["checklist_sha256"] = hashlib.sha256(checklist.read_bytes()).hexdigest()
    else:
        result["errors"].append("Checklist Mestre ausente em docs/code-review/MASTER_CHECKLIST.md")

    seeds = review / "state" / "REQUIREMENT_SEEDS.jsonl"
    manifest = review / "state" / "CHECKLIST_MANIFEST.md"
    result["seeds_present"] = seeds.exists() and seeds.stat().st_size > 0
    result["manifest_present"] = manifest.exists() and manifest.stat().st_size > 0
    if not result["seeds_present"]:
        result["errors"].append("REQUIREMENT_SEEDS.jsonl ausente/vazio; execute build_requirement_seeds.py.")
    if not result["manifest_present"]:
        result["errors"].append("CHECKLIST_MANIFEST.md ausente/vazio; execute build_requirement_seeds.py.")

    skill = repo / ".agents" / "skills" / "vulnera-implementation-audit" / "SKILL.md"
    result["skill_present"] = skill.exists()
    if not skill.exists():
        result["errors"].append("Skill vulnera-implementation-audit ausente.")

    config = repo / ".codex" / "config.toml"
    result["config_present"] = config.exists()
    if config.exists():
        try:
            cfg = parse_toml(config)
            result["config_valid"] = True
            a = cfg.get("agents", {})
            expected = {
                "enabled": True,
                "max_concurrent_threads_per_session": 6,
                "default_subagent_model": "gpt-5.6-luna",
                "default_subagent_reasoning_effort": "high",
            }
            for k, v in expected.items():
                if a.get(k) != v:
                    result["errors"].append(
                        f"Config [agents].{k} esperado={v!r}, encontrado={a.get(k)!r}"
                    )
        except Exception as e:
            result["errors"].append(f".codex/config.toml inválido: {e}")
    else:
        result["errors"].append(".codex/config.toml ausente.")

    agent_dir = repo / ".codex" / "agents"
    found_names = set()
    if agent_dir.exists():
        for p in sorted(agent_dir.glob("*.toml")):
            entry = {"valid": False, "name": None, "model": None, "reasoning": None, "sandbox": None}
            try:
                data = parse_toml(p)
                entry.update({
                    "valid": all(k in data for k in ("name", "description", "developer_instructions")),
                    "name": data.get("name"),
                    "model": data.get("model"),
                    "reasoning": data.get("model_reasoning_effort"),
                    "sandbox": data.get("sandbox_mode"),
                })
                if entry["name"]:
                    found_names.add(entry["name"])
                if entry["sandbox"] != "read-only":
                    result["errors"].append(f"Agente {p.name} não está read-only.")
            except Exception as e:
                entry["error"] = str(e)
                result["errors"].append(f"Agente TOML inválido {p.name}: {e}")
            result["agents"][p.name] = entry
    else:
        result["errors"].append("Diretório .codex/agents ausente.")

    missing = sorted(REQUIRED_AGENTS - found_names)
    result["required_agents_missing"] = missing
    if missing:
        result["errors"].append("Agentes obrigatórios ausentes: " + ", ".join(missing))

    if result["branch"] not in ALLOWED_REVIEW_BRANCHES:
        result["errors"].append(
            f"Review branch must be one of {sorted(ALLOWED_REVIEW_BRANCHES)!r}; "
            f"found {result['branch']!r}"
        )

    result["ready_for_review"] = bool(
        result["git_repo"]
        and result["branch"] in ALLOWED_REVIEW_BRANCHES
        and result["commit"]
        and result["audit_reference_commit"]
        and result["review_branch_derived_from_reference"] is not False
        and not result["unexpected_worktree_changes"]
        and result["checklist_present"]
        and result["seeds_present"]
        and result["manifest_present"]
        and result["skill_present"]
        and result["config_valid"]
        and not missing
        and not result["errors"]
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))

    if ns.write_report:
        review.mkdir(parents=True, exist_ok=True)
        report = review / "SETUP_VALIDATION.json"
        report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return 0 if result["ready_for_review"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
