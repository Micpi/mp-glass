# Développement

Node 24 LTS, npm et navigateur Chromium Playwright. `npm ci`, `npm run check`, `npx playwright install chromium`, `npm run test:e2e`. Le lockfile fixe les dépendances réellement résolues.

Les tests Vitest ciblent le core pur et la frontière registry. Les tests Playwright ciblent la fixture `demo/main.ts`, pas un backend HA simulé présenté comme réel. Six images Windows sont versionnées. Après une modification visuelle voulue, `npm run test:e2e -- --update-snapshots`, inspection visuelle, puis exécution sans update. CI frontend Windows évite des comparaisons de polices entre OS.

Backend local : `python -m pip install jsonschema==4.25.1`, `python -m unittest discover -s tests -p 'test_*.py'`, `python -m compileall -q custom_components`. Ces commandes testent le contrat et la syntaxe, pas le chargement HA. Sur ce poste, l'interpréteur disponible est le venv du workspace parent.

Vrai HA : `pwsh -File scripts/dev-ha.ps1` construit le frontend, crée une configuration de test si absente, démarre HA 2026.9.1 sur le port local 8124. Faire le onboarding natif, créer Salon et affecter MP Glass Test Light. Cette lumière template est une vraie entité du serveur HA, sans matériel physique. L'absence de mock backend ne remplace pas la validation matérielle.

`docker compose down` arrête seulement le service de ce projet. `.dev-ha` est ignoré et contient la configuration privée de test ; ne jamais committer ce dossier. Répéter `npm run build` actualise le bundle monté. Le redémarrage HA n'est nécessaire que pour les changements Python.

La CI inclut hassfest et HACS ; elle n'a pas encore été exécutée sur une destination GitHub. Avant release, lancer la matrice HA minimum/stable, vérifier le gate réel et le comportement non-administrateur.
