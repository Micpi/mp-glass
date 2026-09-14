# Release MP Glass

Le paquet Integration unique contient `custom_components/mp_glass`, frontend compilé et schéma. Le build copie le JSON Schema source pour éviter des variantes divergentes. Les fichiers de projet/runtime et plans ne font jamais partie de l'archive.

Depuis 0.2.0, une seconde archive `mp-glass-spatial-addon-0.2.0.zip` prépare le worker optionnel à extraire sous `/addons`. Ce n’est pas une intégration HACS. Les dépendances de tests Python sont dans `addons/mp_glass_spatial/requirements.txt`. Le build synchronise les schémas et le validateur géométrique entre l’intégration et le worker.

Préparer localement : `pwsh -File scripts/package.ps1 -Python <chemin-python>`. Ce script exige lint, typecheck, tests unitaires, navigateur, tests de stockage et compilation Python, vérifie l'accord package/manifest puis produit une archive ZIP déterministe sans caches/sourcemaps.

Avant GitHub : confirmer le dépôt produit, aligner ses URLs manifest/README, configurer origin, compléter la validation réelle de VALIDATION.md, exécuter CI et hassfest/HACS, mettre à jour changelog et version package/manifest/const.py, rebuild. Créer ensuite le tag correspondant et la release avec artifact depuis ce dépôt seulement.

Le script du workspace parent `scripts/release_hacs.ps1` suppose un composant sous custom_cards ou integrations. L'appliquer sans adaptation au présent dossier ou au dépôt parent risquerait d'embarquer d'autres composants. Le packaging produit est donc dédié. Aucun déclenchement de publication stable avant les gates. `hacs.json` porte le minimum HA ; la version de téléchargement HACS est le tag GitHub.
