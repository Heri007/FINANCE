#!/usr/bin/env python3
# scan_avoir_usage.py - VERSION 3 (multi-dossiers)

import os
import re

# Patterns à chercher
PATTERNS = {
    'Avoir_keyword': r'\bAvoir\b',
    'Avoir_string': r'["\']Avoir["\']',
    'account_id_7': r'(account_?id|accountId).*[=:].*7\b',
    'id_equals_7': r'\bid\s*[=:]\s*7\b',
    'type_credit': r'type.*["\']credit["\']',
    'receivables_calc': r'totalOpenReceivables|accountsWithCorrectAvoir',
}

# Dossiers à scanner (structure de votre projet)
SCAN_ROOTS = [
    'money-tracker-backend',
    'money-tracker-vite',
]

# Extensions à analyser
EXTENSIONS = {'.js', '.jsx', '.ts', '.tsx', '.sql', '.json'}

def scan_all_projects():
    """Scan tous les sous-projets"""
    all_results = {}
    total_files = 0
    
    print("🔍 SCAN DES PROJETS")
    print("=" * 80)
    
    # Vérifier que les dossiers existent
    existing_roots = [d for d in SCAN_ROOTS if os.path.exists(d)]
    
    if not existing_roots:
        print("❌ ERREUR: Aucun dossier trouvé!")
        print(f"   Cherché: {SCAN_ROOTS}")
        print(f"   Dans: {os.getcwd()}")
        return {}, 0
    
    print(f"📁 Dossiers trouvés: {', '.join(existing_roots)}\n")
    
    for root_dir in existing_roots:
        print(f"   🔎 Scan de {root_dir}...")
        results, count = scan_directory(root_dir)
        all_results.update(results)
        total_files += count
    
    return all_results, total_files

def scan_directory(start_path):
    """Scan un dossier spécifique"""
    results = {}
    file_count = 0
    
    for root, dirs, files in os.walk(start_path):
        # Ignorer certains dossiers
        dirs[:] = [d for d in dirs if d not in {
            'node_modules', '.git', 'dist', 'build', '.next', 
            'coverage', '__pycache__', '.venv', 'venv', 'uploads'
        }]
        
        for file in files:
            ext = os.path.splitext(file)[1]
            if ext not in EXTENSIONS:
                continue
            
            filepath = os.path.join(root, file)
            file_count += 1
            
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    lines = content.split('\n')
                    
                    matches = []
                    for i, line in enumerate(lines, 1):
                        for pattern_name, pattern in PATTERNS.items():
                            if re.search(pattern, line, re.IGNORECASE):
                                matches.append({
                                    'line_num': i,
                                    'line': line.strip(),
                                    'pattern': pattern_name
                                })
                    
                    if matches:
                        results[filepath] = matches
                        
            except Exception:
                pass  # Ignorer les erreurs
    
    return results, file_count

def categorize_file(filepath):
    """Catégorise un fichier selon son chemin"""
    if 'money-tracker-vite' in filepath or 'frontend' in filepath:
        if 'src/contexts' in filepath:
            return 'Frontend - Contexts'
        elif 'src/components' in filepath:
            return 'Frontend - Components'
        elif 'src/services' in filepath:
            return 'Frontend - Services'
        else:
            return 'Frontend - Autres'
    elif 'money-tracker-backend' in filepath or 'backend' in filepath:
        if 'routes' in filepath:
            return 'Backend - Routes'
        elif 'services' in filepath:
            return 'Backend - Services'
        elif 'config' in filepath or 'db' in filepath:
            return 'Backend - Config/DB'
        else:
            return 'Backend - Autres'
    else:
        return 'Autres'

def print_results(results, total_files):
    """Affiche les résultats groupés"""
    
    print("\n" + "=" * 80)
    print(f"📊 RÉSULTATS:")
    print(f"   Fichiers scannés: {total_files}")
    print(f"   Fichiers avec références AVOIR: {len(results)}")
    print("=" * 80 + "\n")
    
    if not results:
        print("✅ Aucune référence au compte AVOIR trouvée!\n")
        return
    
    # Grouper par catégorie
    categorized = {}
    for filepath, matches in results.items():
        category = categorize_file(filepath)
        if category not in categorized:
            categorized[category] = {}
        categorized[category][filepath] = matches
    
    # Afficher par catégorie
    for category in sorted(categorized.keys()):
        print(f"\n{'=' * 80}")
        print(f"📦 {category}")
        print('=' * 80)
        
        for filepath, matches in sorted(categorized[category].items()):
            # Afficher chemin relatif
            rel_path = filepath.replace('money-tracker-backend/', 'backend/')
            rel_path = rel_path.replace('money-tracker-vite/', 'frontend/')
            
            print(f"\n📁 {rel_path} ({len(matches)} occurrences)")
            
            # Afficher les 5 premières lignes
            for match in matches[:5]:
                line_preview = match['line'][:70]
                print(f"   L{match['line_num']:4d} [{match['pattern']:20s}] {line_preview}")
            
            if len(matches) > 5:
                print(f"   ... et {len(matches) - 5} autres occurrences")
    
    # Recommandations
    print("\n\n" + "=" * 80)
    print("💡 ACTIONS À EFFECTUER")
    print("=" * 80)
    print("""
🗑️  ÉTAPE 1 : SUPPRIMER LE COMPTE AVOIR DE LA BASE
────────────────────────────────────────────────────────────
psql -U m1 -d moneytracker
DELETE FROM accounts WHERE id = 7;
\\q

📝 ÉTAPE 2 : NETTOYER LE CODE (fichiers identifiés ci-dessus)
────────────────────────────────────────────────────────────
Frontend (money-tracker-vite):
  □ src/contexts/FinanceContext.jsx
     - Supprimer: accountsWithCorrectAvoir
     - Remplacer toutes occurrences par: accounts
  
  □ src/App.jsx
     - Supprimer: condition "if (acc.name === 'Avoir')"
     - Supprimer: { name: 'Avoir', type: 'credit' } de DEFAULT_ACCOUNTS

Backend (money-tracker-backend):
  □ db/init-db.js ou config/init-db.js
     - Supprimer: { name: 'Avoir', type: 'credit' } de DEFAULT_ACCOUNTS

✅ ÉTAPE 3 : TESTER
────────────────────────────────────────────────────────────
cd money-tracker-backend && npm run dev
cd money-tracker-vite && npm run dev

# Vérifier:
# - 6 comptes affichés (pas 7)
# - Receivables accessibles dans onglet dédié
# - Pas d'erreur console

📊 ÉTAPE 4 : VÉRIFIER LA BASE
────────────────────────────────────────────────────────────
psql -U m1 -d moneytracker -c "SELECT id, name, balance FROM accounts;"
# Doit afficher 6 comptes

psql -U m1 -d moneytracker -c "SELECT COUNT(*), SUM(amount) FROM receivables WHERE status = 'open';"
# Doit afficher: 6 créances, 51821300
""")

if __name__ == '__main__':
    results, total_files = scan_all_projects()
    print_results(results, total_files)
