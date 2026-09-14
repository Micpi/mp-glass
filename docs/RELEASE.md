# Release MP Glass

Le dépôt public `Micpi/mp-glass` est la source HACS (catégorie Intégration). HACS installe le dossier `custom_components/mp_glass` de la **dernière release GitHub** : frontend compilé (`www/`), schéma et backend y sont commités. `hacs.json` porte le nom et le minimum HA ; la version proposée est le tag de la release.

## Publier une mise à jour

1. Mettre la même version dans `custom_components/mp_glass/manifest.json`, `const.py`, `package.json` (`npm version X.Y.Z --no-git-tag-version`, qui fixe aussi la version du frontend et la clé de cache du bundle) et, si le worker change, `addons/mp_glass_spatial/config.yaml` et `Dockerfile`.
2. Renseigner le `CHANGELOG.md`.
3. `npm run check`, `npm run test:e2e`, tests Python (`python -m unittest discover -s tests -p 'test_*.py'`) : le build régénère `www/` et synchronise les schémas et le contrat Gemini avec le worker.
4. Commiter sur `main` et pousser.
5. `gh release create vX.Y.Z --target main --title "MP Glass X.Y.Z" --notes-file <notes>` : le tag doit correspondre à la version du manifest. HACS signale la mise à jour dans Home Assistant.

Le CI (`.github/workflows/ci.yml`) exécute les contrôles frontend, Python, hassfest et la validation HACS à chaque push. La vérification `brands` de HACS est ignorée : l’intégration n’est pas référencée dans `home-assistant/brands`.

## Archives

`pwsh -File scripts/package.ps1 -Python <chemin-python>` produit une archive ZIP déterministe sans caches ni sourcemaps, après lint, typecheck, tests unitaires, navigateur, stockage et compilation Python, et vérifie l’accord package/manifest. Utile pour une installation manuelle ; HACS n’en a pas besoin.

Depuis 0.2.0, une seconde archive `mp-glass-spatial-addon-<version>.zip` prépare le worker optionnel à extraire sous `/addons`. Ce n’est pas une intégration HACS. Les dépendances de tests Python sont dans `addons/mp_glass_spatial/requirements.txt`.

Le script du workspace parent `scripts/release_hacs.ps1` suppose un composant sous custom_cards ou integrations : ne pas l’appliquer à ce dépôt, il risquerait d’embarquer d’autres composants.
