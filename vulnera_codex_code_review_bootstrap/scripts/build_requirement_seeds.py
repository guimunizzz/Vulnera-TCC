#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

CHECKBOX_RE = re.compile(r"^\s*-\s+\[(?: |x|X)\]\s+(.*)$")
H2_RE = re.compile(r"^##\s+(.*)$")
H3_RE = re.compile(r"^###\s+(.*)$")

def slug_num(title: str, fallback: int) -> str:
    m = re.match(r"^(\d+)(?:\.(\d+))?", title.strip())
    if not m:
        return f"S{fallback:02d}"
    if m.group(2):
        return f"S{int(m.group(1)):02d}_{int(m.group(2)):02d}"
    return f"S{int(m.group(1)):02d}"

def classify_marker(text: str) -> str | None:
    if "⚠️ Especificação incompleta ou ambígua" in text:
        return "SPEC_AMBIGUITY"
    if "⚠️ Conflito de especificação" in text:
        return "SPEC_CONFLICT"
    if "🚧" in text:
        return "OUT_OF_MVP"
    return None

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".")
    ns = ap.parse_args()
    repo = Path(ns.repo).resolve()

    checklist = repo / "docs" / "code-review" / "MASTER_CHECKLIST.md"
    if not checklist.exists():
        raise SystemExit(f"Checklist ausente: {checklist}")

    text = checklist.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()

    out_dir = repo / "docs" / "code-review" / "state"
    out_dir.mkdir(parents=True, exist_ok=True)
    seeds_path = out_dir / "REQUIREMENT_SEEDS.jsonl"
    manifest_path = out_dir / "CHECKLIST_MANIFEST.md"

    current_h2 = "Sem seção"
    current_h3 = ""
    section_seq = 0
    item_seq_by_section: dict[str, int] = {}
    items = []
    section_counts: dict[str, int] = {}

    i = 0
    while i < len(lines):
        line = lines[i]
        m2 = H2_RE.match(line)
        if m2:
            current_h2 = m2.group(1).strip()
            current_h3 = ""
            section_seq += 1
            i += 1
            continue
        m3 = H3_RE.match(line)
        if m3:
            current_h3 = m3.group(1).strip()
            i += 1
            continue
        mc = CHECKBOX_RE.match(line)
        if not mc:
            i += 1
            continue

        body = mc.group(1).strip()
        start_line = i + 1
        extra = []
        j = i + 1
        while j < len(lines):
            nxt = lines[j]
            if CHECKBOX_RE.match(nxt) or H2_RE.match(nxt) or H3_RE.match(nxt):
                break
            if nxt.strip():
                extra.append(nxt.strip())
            j += 1

        section_key = slug_num(current_h2, section_seq)
        item_seq_by_section[section_key] = item_seq_by_section.get(section_key, 0) + 1
        rid = f"{section_key}-R{item_seq_by_section[section_key]:03d}"

        marker = classify_marker(body)
        rec = {
            "id": rid,
            "line": start_line,
            "section": current_h2,
            "subsection": current_h3 or None,
            "text": body,
            "context": extra,
            "explicit_marker": marker,
            "auditability": marker,
            "canonical_requirement_id": None,
            "domain": None,
            "type": None,
        }
        items.append(rec)
        section_counts[current_h2] = section_counts.get(current_h2, 0) + 1
        i = j

    with seeds_path.open("w", encoding="utf-8") as f:
        for rec in items:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    sha = hashlib.sha256(checklist.read_bytes()).hexdigest()
    amb = sum(1 for x in items if x["explicit_marker"] == "SPEC_AMBIGUITY")
    con = sum(1 for x in items if x["explicit_marker"] == "SPEC_CONFLICT")
    fut = sum(1 for x in items if x["explicit_marker"] == "OUT_OF_MVP")

    lines_out = [
        "# Checklist Manifest",
        "",
        f"- SHA-256: `{sha}`",
        f"- Total de linhas: **{len(lines)}**",
        f"- Total de itens marcáveis: **{len(items)}**",
        f"- Itens explicitamente ambíguos: **{amb}**",
        f"- Conflitos explícitos de especificação: **{con}**",
        f"- Itens explicitamente fora do MVP/futuro: **{fut}**",
        "",
        "## Itens por seção",
        "",
        "| Seção | Itens |",
        "|---|---:|",
    ]
    for sec, count in section_counts.items():
        lines_out.append(f"| {sec.replace('|', '\\|')} | {count} |")
    lines_out += [
        "",
        "Este arquivo é estrutural. Ele não representa resultado da auditoria.",
    ]
    manifest_path.write_text("\n".join(lines_out) + "\n", encoding="utf-8")

    print(f"CHECKLIST_SHA256={sha}")
    print(f"CHECKBOX_ITEMS={len(items)}")
    print(f"SEEDS={seeds_path}")
    print(f"MANIFEST={manifest_path}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
