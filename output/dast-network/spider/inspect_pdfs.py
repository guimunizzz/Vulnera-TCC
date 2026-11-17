# Confere PDFs exportados pela UI para validar metodologia e limites visuais;
# existe como evidência desta sessão e é consumido pelo relatório de validação.
from pathlib import Path
import json
import pdfplumber
import subprocess

root = Path(__file__).parent
results = []
for kind in ("spider", "legacy"):
    doc = pdfplumber.open(root / f"report-{kind}-final.pdf")
    text = "\n".join(page.extract_text() or "" for page in doc.pages)
    (root / f"report-{kind}-final.txt").write_text(text, encoding="utf-8")
    bounds = []
    subprocess.run(["pdftoppm", "-scale-to", "900", "-png", str(root / f"report-{kind}-final.pdf"), str(root / f"{kind}-page")],check=True)
    for index, page in enumerate(doc.pages):
        for word in page.extract_words():
            if word["x0"] < -1 or word["top"] < -1 or word["x1"] > page.width+1 or word["bottom"] > page.height+1:
                bounds.append({"page":index+1, "word":word["text"]})
    checks = {"all_text_in_page": not bounds}
    if kind == "spider":
        checks.update({"method": "spider tradicional" in text.lower(), "discovery": "9 URLs no escopo" in text, "limits": "30 filhos por nó" in text})
    else:
        checks.update({"legacy_unknown": "não foi registrado" in text, "no_current_discovery": "Descoberta registrada" not in text})
    results.append({"kind":kind,"pages":len(doc.pages),"checks":checks,"overflow":bounds})
(root / "pdf-validation.json").write_text(json.dumps(results, indent=2),encoding="utf-8")
print(json.dumps(results,indent=2))
assert all(all(item["checks"].values()) for item in results)
