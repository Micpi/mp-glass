# MP Nexus — audit initial

Audit du 10 septembre 2026, avant développement.

- Le dossier `dashboards/MP Nexus` est vide : aucun dashboard, backend, build ou test MP Nexus à conserver ou refactoriser.
- Le dépôt parent `HomeAssistant-AI` contient cartes, intégrations, scripts et documentation. Son index et son arbre de travail contiennent de nombreuses modifications étrangères à MP Nexus, notamment Zektor et Naive Flex. Elles ne font pas partie de ce travail.
- Le `.gitignore` parent ignore les dashboards. MP Nexus doit devenir un dépôt produit autonome, avec une racine HACS propre ; ne pas publier la racine du monorepo (son `hacs.json` décrit Zektor).
- Le script parent `scripts/release_hacs.ps1` cible exclusivement `custom_cards/` et `integrations/`. Il n'est pas directement applicable à ce dossier. Une adaptation explicite ou un pipeline produit dédié est nécessaire.
- Aucun remote Git du dépôt parent n'est configuré. La destination de publication MP Nexus reste à définir.
- Node 24.12.0, npm 11.6.2, Docker CLI 29.6.2 disponibles. Python 3.12.7 dans le venv parent ; le raccourci `python` Windows ne fonctionne pas. Docker Engine initialement arrêté.
- Aucun accès à une installation cliente n'a été fourni. Validation visée sur une instance HA isolée ; aucun contrôle de matériel client implicite.

Réutilisation : conventions de release et expérience HA du workspace. Pas de copie de cartes tierces ni de dépendance à leurs assets. État final des vérifications : `docs/VALIDATION.md`.

Suite de l'audit : dépôt local autonome initialisé dans MP Nexus sur `codex/mp-glass-foundation`, sans remote. Aucun fichier source des cartes/intégrations voisines modifié. Le venv parent a servi aux tests Python et a reçu jsonschema et ses dépendances ; Node utilise les dépendances locales du produit.
