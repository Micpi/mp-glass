# Validation — incrément lumière 0.1.0

Travail démarré le 10 septembre 2026, vérifications le 11 septembre (Europe/Paris).

## Vérifié localement

| Vérification | Résultat |
| --- | --- |
| ESLint TypeScript | OK |
| TypeScript strict, core/frontend/demo/tests | OK |
| Vitest | 22 tests passés |
| Contrat et stockage Python | 6 tests passés |
| Syntaxe Python | compilation OK |
| Playwright Chromium Windows | 10 scénarios passés lors de la vérification finale |
| Screenshots | 6 dimensions, références créées puis comparaison sans mise à jour |
| Inspection visuelle | téléphone portrait et desktop inspectés ; correction du fond répété |
| Bundle Vite | environ 222 Ko, 60 Ko gzip, sans dépendance CDN |

Scénarios navigateur : cible du service light, état après retour de la fixture, slider conditionnel, more-info, erreur de permission simulée, unavailable, absence de débordement, réglages de pièce, sauvegarde avec override conservé, strategy depuis projet enregistré et editor config-changed. Les réponses réseau de ces tests sont des doubles de contrat explicitement identifiés.

Benchmark local noyau Node (une exécution, pas un percentile ni du temps réseau/rendu) : 20 entités 0,22 ms ; 100 0,96 ms ; 500 3,39 ms ; 1000 3,40 ms. Seuil de garde testé : 500 ms. Aucun budget de rendu mobile ni consommation mémoire n'est encore certifié.

## Porte d'acceptation réelle : NON PASSÉE

Pas de session HA fournie et Docker Desktop échoue au démarrage. Son journal indique une erreur de création/suppression du socket du service d'inférence. Le CLI Docker est installé ; cela ne prouve pas qu'une instance HA fonctionne. Aucun matériel client n'a été commandé.

À exécuter dès disponibilité d'une instance isolée :

1. Lancer HA 2026.9.1 avec `scripts/dev-ha.ps1` ou installer le paquet sur une instance de test autorisée.
2. Terminer le onboarding HA, créer Salon, affecter une lumière réelle HA (la template fournie suffit pour le serveur ; la commande matérielle reste distincte).
3. Ajouter MP Glass par Config Flow, scanner et vérifier ID/area/capabilities.
4. Créer MP Glass Dashboard depuis le dialogue natif ; vérifier la vue Salon.
5. Commander la lumière et vérifier l'état dans HA, puis sur le matériel si disponible.
6. Tester refus non-admin, redémarrage, unload/reload, persistance et édition concurrente.
7. Exécuter la version minimale 2026.6, Safari/iOS et les orientations physiques.

## Release : NON PUBLIÉE

Paquet local dans `artifacts/` après checks. Dépôt Git local autonome, branche `codex/mp-glass-foundation`, aucun remote produit configuré. Manifest et package indiquent 0.1.0 ; changelog unreleased. HACS utilise la version du tag et la version manifest ; `hacs.json` fixe le minimum cible HA sans propriété de version inventée.

La destination `Micpi/mp-glass` du manifest est proposée, pas une URL de dépôt confirmé. Hassfest/HACS et CI distante ne sont pas exécutés. Aucun tag/release stable ne doit annoncer la validation du parcours réel tant que cette porte n'est pas passée. Le script parent de publication est limité à custom_cards/integrations et n'a pas été lancé sur les changements étrangers du workspace.

## Périmètre restant

Climate, Cover, TV/Remote, Alarm, Camera, MP Spatial, wizard complet, draft/publish, rollback, rôles graphiques, subscriptions registry, appareils et templates avancés restent au backlog. Voir ROADMAP.md. Ce rapport ne vaut pas acceptation du MVP 1 complet.
