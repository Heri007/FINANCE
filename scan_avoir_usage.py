#!/usr/bin/env python3
# scan_avoir_usage.py
# Scan tous les fichiers frontend/backend pour détecter l'usage du compte AVOIR

import os
import re
from pathlib import Path
from collections import defaultdict

# Patterns à chercher
PATTERNS = [
    r'Avoir',
    r'account.*id.*7',
    r'accountid.*7',
    r'account_id.*7',
    r'AVOIR',
    r'type.*credit',
    r'receivables',
    r'totalOpenReceivables',
]

# Dossiers à scanner
SCAN_DIRS = [
    'src',           # Frontend React
    'server',        # Backend Express
    'routes',
    'services',
    'config',
    'scripts',
]

# Extensions de fichiers à analyser
EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.sql', '.json']

def scan_file(filepath):
    """Scan un fichier et retourne les lignes qui matchent les patterns"""
    matches = []
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            lines = content.split('\n')
            
            for i, line in enumerate(lines, 1):
                for pattern in PATTERNS:
                    if re.search(pattern, line, re.IGNORECASE):
                        matches.append({
                            'line_num': i,
                            'line': line.strip(),
                            'pattern': pattern
                        })
    except Exception as e:
        print(f"❌ Erreur lecture {filepath}: {e}")
    
    return matches

def main():
    results = defaultdict(list)
    total_files = 0
    files_with_matches = 0
    
    print("🔍 SCAN DES FICHIERS POUR USAGE DU COMPTE AVOIR")
    print("=" * 70)
    
    for scan_dir in SCAN_DIRS:
        if not os.path.exists(scan_dir):
            continue
            
        for root, dirs, files in os.walk(scan_dir):
            # Ignorer node_modules, dist, build
            dirs[:] = [d for d in dirs if d not in ['node_modules', 'dist', 'build', '.git']]
            
            for file in files:
                if any(file.endswith(ext) for ext in EXTENSIONS):
                    filepath = os.path.join(root, file)
                    total_files += 1
                    
                    matches = scan_file(filepath)
                    if matches:
                        files_with_matches += 1
                        results[filepath] = matches
    
    # Afficher les résultats
    print(f"\n📊 RÉSULTATS:")
    print(f"   Fichiers scannés: {total_files}")
    print(f"   Fichiers avec matches: {files_with_matches}")
    print("\n" + "=" * 70 + "\n")
    
    if not results:
        print("✅ Aucune référence au compte AVOIR trouvée!")
        return
    
    # Grouper par catégorie
    frontend_files = {}
    backend_files = {}
    config_files = {}
    
    for filepath, matches in results.items():
        if 'src' in filepath:
            frontend_files[filepath] = matches
        elif any(x in filepath for x in ['server', 'routes', 'services']):
            backend_files[filepath] = matches
        else:
            config_files[filepath] = matches
    
    # Afficher Frontend
    if frontend_files:
        print("🎨 FRONTEND (React)")
        print("-" * 70)
        for filepath, matches in frontend_files.items():
            print(f"\n📁 {filepath}")
            for match in matches[:5]:  # Limiter à 5 lignes par fichier
                print(f"   L{match['line_num']:4d} | {match['line'][:80]}")
            if len(matches) > 5:
                print(f"   ... ({len(matches) - 5} autres lignes)")
    
    # Afficher Backend
    if backend_files:
        print("\n\n⚙️  BACKEND (Node.js/Express)")
        print("-" * 70)
        for filepath, matches in backend_files.items():
            print(f"\n📁 {filepath}")
            for match in matches[:5]:
                print(f"   L{match['line_num']:4d} | {match['line'][:80]}")
            if len(matches) > 5:
                print(f"   ... ({len(matches) - 5} autres lignes)")
    
    # Afficher Config
    if config_files:
        print("\n\n🔧 CONFIG/SCRIPTS")
        print("-" * 70)
        for filepath, matches in config_files.items():
            print(f"\n📁 {filepath}")
            for match in matches[:5]:
                print(f"   L{match['line_num']:4d} | {match['line'][:80]}")
            if len(matches) > 5:
                print(f"   ... ({len(matches) - 5} autres lignes)")
    
    # Recommandations
    print("\n\n💡 RECOMMANDATIONS")
    print("=" * 70)
    print("""
1. Le compte AVOIR (ID 7) est un compte virtuel obsolète
2. Utilisez UNIQUEMENT la table 'receivables' pour les créances
3. Actions recommandées:
   
   a) Supprimer le compte AVOIR de la base:
      DELETE FROM accounts WHERE id = 7;
   
   b) Nettoyer les références dans le code:
      - FinanceContext.jsx: Supprimer accountsWithCorrectAvoir
      - App.jsx: Supprimer la condition "Avoir" dans onSelectAccount
      - init-db.js: Retirer "Avoir" de DEFAULT_ACCOUNTS
   
   c) Afficher les receivables via ReceivablesScreen uniquement
   
   d) Calculer le total dynamiquement:
      const totalReceivables = receivables
        .filter(r => r.status === 'open')
        .reduce((sum, r) => sum + r.amount, 0);
""")

if __name__ == '__main__':
    main()
