import os
import json

# Point d'entrée : adapter si besoin (par ex. 'src')
BASE_DIR = "."

frontend_files = []

# 1) Lister tous les fichiers .js / .jsx du frontend
for root, dirs, files in os.walk(BASE_DIR):
    # ignorer node_modules, build, dist, etc. si nécessaire
    if "node_modules" in root or "dist" in root or "build" in root:
        continue

    for f in files:
        if f.endswith((".jsx", ".js")):
            path = os.path.join(root, f)
            frontend_files.append(path)

summary = {"files": []}

# 2) Analyser chaque fichier (imports / exports / usage de fetch)
for path in frontend_files:
    rel = os.path.relpath(path, BASE_DIR)
    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
        content = fh.read()

    info = {
        "path": rel,
        "imports": [],
        "exports": [],
        "uses_fetch": False,
    }

    for line in content.splitlines():
        line_stripped = line.strip()

        if line_stripped.startswith("import "):
            info["imports"].append(line_stripped)

        if line_stripped.startswith("export "):
            info["exports"].append(line_stripped)

        if "fetch(" in line_stripped or " fetch " in line_stripped:
            info["uses_fetch"] = True

    summary["files"].append(info)

# 3) Sauvegarder en JSON
output_path = "frontend_analysis.json"
with open(output_path, "w", encoding="utf-8") as out:
    json.dump(summary, out, ensure_ascii=False, indent=2)

print(f"Written {output_path} with {len(summary['files'])} files")
