# Règles du projet MP Nexus

## Toute modification se termine par une release

- Instruction permanente de l’utilisateur : après chaque modification de ce projet, publier une nouvelle release GitHub pour HACS, sans attendre une demande supplémentaire. Cette règle concerne aussi `frontend/`, `shared/`, les dashboards et `custom_components/`.
- Seule une demande explicite de l’utilisateur (`pas de release`, `local only`, `no push`) suspend cette publication.
- Aligner `package.json`, les versions racines de `package-lock.json`, `custom_components/mp_glass/manifest.json` et `custom_components/mp_glass/const.py` ; ajouter une entrée détaillée au `CHANGELOG.md`.
- Exécuter les vérifications adaptées et reconstruire `www/` après le changement de version avec `npm run build`.
- Commiter les modifications sur `main`, puis publier avec `npm run release`. Ce script pousse la branche, crée la release sur le commit exact et vérifie le tag et la version réellement servis par GitHub.
- Ne pas déclarer le travail terminé au stade du build, du commit ou d’une release seulement préparée. La réponse finale doit fournir le lien de la release publiée, ou expliquer le blocage concret si la publication a échoué.
