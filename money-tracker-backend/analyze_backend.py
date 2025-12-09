import os
import json

# Point d'entrée : adapter si besoin (par ex. dossier backend)
BASE_DIR = "."

backend_files = []

# 1) Lister les fichiers backend (.js / .mjs / .cjs),
# en ignorant les dossiers front connus
for root, dirs, files in os.walk(BASE_DIR):
    if any(part in root for part in ["node_modules", "dist", "build", "public", "src"]):
        continue

    for f in files:
        if f.endswith((".js", ".mjs", ".cjs")):
            path = os.path.join(root, f)
            backend_files.append(path)

summary = {"files": []}

# 2) Analyser chaque fichier
for path in backend_files:
    rel = os.path.relpath(path, BASE_DIR)
    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
        content = fh.read()

    info = {
        "path": rel,
        "requires": [],
        "imports": [],
        "exports": [],
        "uses_express": False,
        "uses_router": False,
        "uses_db": False,
        "uses_fetch_like": False,
    }

    for line in content.splitlines():
        s = line.strip()

        # require() style
        if s.startswith("const ") and "require(" in s:
            info["requires"].append(s)

        # import ES module
        if s.startswith("import "):
            info["imports"].append(s)

        # exports
        if s.startswith("module.exports") or s.startswith("export "):
            info["exports"].append(s)

        # express
        if (
            "express(" in s
            or "from 'express'" in s
            or 'from "express"' in s
            or "require('express')" in s
            or 'require("express")' in s
        ):
            info["uses_express"] = True

        # routers
        if ".Router(" in s or "express.Router(" in s:
            info["uses_router"] = True

        # DB usage (pool/db/client)
        if "pool." in s or "db." in s or "client." in s:
            info["uses_db"] = True

        # Appels HTTP sortants (approx.)
        if "fetch(" in s or "axios." in s or "request(" in s:
            info["uses_fetch_like"] = True

    summary["files"].append(info)

# 3) Sauvegarder en JSON
output_path = "backend_analysis.json"
with open(output_path, "w", encoding="utf-8") as out:
    json.dump(summary, out, ensure_ascii=False, indent=2)

print(f"Written {output_path} with {len(summary['files'])} files")
