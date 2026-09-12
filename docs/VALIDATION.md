# Validation — incrément lumière 0.1.0

## Reprise sur instance utilisateur — 11 septembre 2026

Session navigateur authentifiée accessible. Version constatée dans l'interface : Core 2026.9.1, Supervisor 2026.09.0, frontend 20260826.6, installation Supervised. Le vertical slice lumière a été validé sur cette instance réelle.

Archive initiale transférée via File editor, SHA-256 local/serveur identique : `feb53592ab6eb3954c0edd0ffa5ce85d6e3795d8e44874f3ac5e051f4e36d113`. Absence préalable de `custom_components/mp_glass` vérifiée, 12 fichiers extraits avec refus d'écrasement. `ha core check` a réussi, puis le redémarrage autorisé par l'utilisateur a réussi. Le Config Flow, le panneau administrateur, le stockage du projet et la lecture des registries ont ensuite fonctionné.

Découverte réelle : 642 entités analysées, 9 lumières reconnues et 5 lumières sans pièce à vérifier. Les 633 entités génériques sont conservées dans une vue Inventaire repliée et paginée, sans encombrer la revue. Le dashboard `MP Glass Test` a été créé par le dialogue natif. Les vues Accueil, Cuisine, Entrée, Salle de bains et Inventaire ont été générées.

Le premier chargement direct a révélé deux défauts corrigés : largeur de custom view réduite par le conteneur flex HA, puis course entre le chargement du bundle et le délai de 5 secondes de la strategy. La vue occupe désormais le conteneur ; un bootstrap de 0,59 Ko enregistre immédiatement `ll-strategy-dashboard-mp-glass` et charge le bundle à la demande. Une ressource bootstrap a été ajoutée à Lovelace sur l'instance de test pour valider le correctif sans second redémarrage.

Commande réelle autorisée : la première carte `Cuisine`, initialement éteinte, a été allumée. Le retour HA a indiqué `Allumée`, luminosité 51 %. La même carte a ensuite été éteinte et les deux rendus Cuisine reflétant cet équipement ont confirmé `Éteinte` et 0 %. L'état initial a donc été restauré.

Les anciennes instructions AGENTS.md de publication automatique ont été révoquées par l'utilisateur. Le développement et la validation restent autorisés ; aucune release n'est déclenchée implicitement par cette reprise.

Travail démarré le 10 septembre 2026, vérifications le 11 septembre (Europe/Paris).

## Vérifié localement

| Vérification | Résultat |
| --- | --- |
| ESLint TypeScript | OK |
| TypeScript strict, core/frontend/demo/tests | OK |
| Vitest | 23 tests passés |
| Contrat et stockage Python | 6 tests passés |
| Syntaxe Python | compilation OK |
| Playwright Chromium Windows | 11 scénarios passés lors de la vérification finale |
| Screenshots | 6 dimensions, références créées puis comparaison sans mise à jour |
| Inspection visuelle | téléphone portrait et desktop inspectés ; correction du fond répété |
| Bundle Vite | environ 222 Ko, 60 Ko gzip, sans dépendance CDN |

Scénarios navigateur : cible du service light, état après retour de la fixture, slider conditionnel, more-info, erreur de permission simulée, unavailable, absence de débordement, réglages de pièce, sauvegarde avec override conservé, strategy depuis projet enregistré et editor config-changed. Les réponses réseau de ces tests sont des doubles de contrat explicitement identifiés.

Benchmark local noyau Node (une exécution, pas un percentile ni du temps réseau/rendu) : 20 entités 0,22 ms ; 100 0,96 ms ; 500 3,39 ms ; 1000 3,40 ms. Seuil de garde testé : 500 ms. Aucun budget de rendu mobile ni consommation mémoire n'est encore certifié.

## Porte du premier vertical slice lumière : PASSÉE

Le chemin install → Config Flow → découverte → capability POWER/DIM → résolution MP Glass Light → génération du dashboard → commande → retour d'état a fonctionné sur Home Assistant 2026.9.1. Cette validation couvre le serveur et son état Home Assistant ; aucun constat physique visuel de l'ampoule n'a été revendiqué.

Restent à valider avant une release stable : refus non-admin, unload/reload après installation définitive du bootstrap, édition concurrente sur HA réel, version minimale 2026.6, Safari/iOS et orientations physiques.

## Release : NON PUBLIÉE

Paquet local corrigé dans `artifacts/mp-glass-0.1.0.zip` après checks : 13 fichiers, SHA-256 `70ecf8cfdd17de498d9151b4eb66ecc4b7390038a045df001dcbdbf8b7cfb8ae`. Dépôt Git local autonome, branche `codex/mp-glass-foundation`, aucun remote produit configuré. Manifest et package indiquent 0.1.0 ; changelog unreleased. HACS utilise la version du tag et la version manifest ; `hacs.json` fixe le minimum cible HA sans propriété de version inventée.

La destination `Micpi/mp-glass` du manifest est proposée, pas une URL de dépôt confirmé. Hassfest/HACS et CI distante ne sont pas exécutés. Aucun tag/release stable ne doit annoncer la validation du parcours réel tant que cette porte n'est pas passée. Le script parent de publication est limité à custom_cards/integrations et n'a pas été lancé sur les changements étrangers du workspace.

## Périmètre restant

Climate, Cover, TV/Remote, Alarm, Camera, MP Spatial, wizard complet, draft/publish, rollback, rôles graphiques, subscriptions registry, appareils et templates avancés restent au backlog. Voir ROADMAP.md. Ce rapport ne vaut pas acceptation du MVP 1 complet.
