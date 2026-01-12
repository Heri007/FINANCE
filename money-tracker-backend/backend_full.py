import json
import os
from collections import defaultdict

# Fichiers d'entrée / sortie
BACKEND_ANALYSIS_PATH = "backend_analysis.json"
OUTPUT_PATH = "backend_report.json"

# Mots-clés pour catégoriser
KEYWORDS = {
    "solde": ["balance", "recalculate", "solde", "accounts/recalculate-all"],
    "projets": ["project", "projects", "archive", "toggle-status"],
    "avoirs": ["receivable", "receivables", "avoir"],
}

def detect_categories(info):
    """
    Détecte si un fichier touche aux soldes / projets / avoirs
    en inspectant les lignes d'import/require/export.
    """
    text = "\n".join(info.get("imports", []) + info.get("requires", []) + info.get("exports", []))
    text_lower = text.lower()

    categories = []
    for cat, kws in KEYWORDS.items():
        if any(kw.lower() in text_lower for kw in kws):
            categories.append(cat)
    return categories

def main():
    if not os.path.exists(BACKEND_ANALYSIS_PATH):
        raise SystemExit(f"{BACKEND_ANALYSIS_PATH} introuvable, lance d'abord analyze_backend.py")

    with open(BACKEND_ANALYSIS_PATH, "r", encoding="utf-8") as f:
        analysis = json.load(f)

    files = analysis.get("files", [])
    report = {
        "by_route_file": [],
        "summary": {
            "total_files": len(files),
            "routes_files": 0,
            "controllers_files": 0,
            "db_users": 0,
        },
    }

    for info in files:
        path = info.get("path", "")
        # on s'intéresse surtout aux routes et controllers
        is_route = path.endswith(".js") and any(
            kw in os.path.basename(path).lower()
            for kw in ["accounts", "transactions", "backup", "receivables", "projects", "operator", "content", "auth"]
        )
        is_controller = "controller" in os.path.basename(path).lower()

        categories = detect_categories(info)

        entry = {
            "path": path,
            "is_route": is_route,
            "is_controller": is_controller,
            "uses_express": info.get("uses_express", False),
            "uses_router": info.get("uses_router", False),
            "uses_db": info.get("uses_db", False),
            "categories": categories,
            # on garde aussi un aperçu brut des exports pour voir les handlers
            "exports": info.get("exports", []),
        }

        report["by_route_file"].append(entry)

        # Update summary
        if is_route:
            report["summary"]["routes_files"] += 1
        if is_controller:
            report["summary"]["controllers_files"] += 1
        if info.get("uses_db", False):
          report["summary"]["db_users"] += 1

    # Tri optionnel: routes d'abord, puis controllers, puis le reste
    report["by_route_file"].sort(
        key=lambda e: (
            not e["is_route"],
            not e["is_controller"],
            e["path"],
        )
    )

    with open(OUTPUT_PATH, "w", encoding="utf-8") as out:
        json.dump(report, out, ensure_ascii=False, indent=2)

    print(f"Written {OUTPUT_PATH} with {len(report['by_route_file'])} entries")

if __name__ == "__main__":
    main()
