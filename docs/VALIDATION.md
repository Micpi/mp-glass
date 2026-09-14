# Validation — incrément lumière 0.1.0

## Dashboard créé à l’installation 0.2.4 — 14 septembre 2026

Signalement utilisateur : après installation par HACS sur une autre instance, seul le Studio apparaît, pas le dashboard. Cause : le dashboard devait être ajouté à la main (Paramètres → Tableaux de bord) et le lien du Studio visait une adresse fixe `/mp-glass/home` inexistante.

Validé localement : 33 tests Vitest (dont réutilisation d’un dashboard MP Glass existant quelle que soit son adresse, création avec la strategy `custom:mp-glass`, adresse de repli si `mp-glass` est prise), 22 scénarios Playwright (installation neuve : création du dashboard par le Studio, message affiché, lien vers `/mp-glass/home`), 28 tests Python, build. Non validé : création réelle sur une instance Home Assistant.

## Plan 3D mobile, Gemini 3.5 et HACS 0.2.3 — 14 septembre 2026

Signalements utilisateur : plan 3D difficile à utiliser sur téléphone (le plan capte le défilement) ; import Gemini refusé avec `HTTP 404 NOT_FOUND This model models/gemini-2.5-flash-lite is no longer available to new users`. Modèle de remplacement `gemini-3.5-flash-lite` vérifié sur la documentation Google du jour (stable, PDF et images, sortie JSON structurée, palier gratuit).

Validé localement : ESLint, TypeScript, 30 tests Vitest, build, 22 scénarios Playwright (dont gestes tactiles réels par CDP : défilement de la page à côté de la maison, rotation sans défilement sur la maison ; molette et glisser souris ; fiche de pièce, commandes groupées et variateur ; six références visuelles régénérées) et 28 tests Python (modèle par défaut, température Gemini 3, erreur 404 réelle classée). Les tests tactiles échouent si l’on rétablit l’ancien comportement ou si l’on supprime le blocage du défilement sur la maison.

Non validé : appel Gemini réel avec `gemini-3.5-flash-lite`, installation et mise à jour réelles par HACS, Safari/iOS et matériel tactile réel.

## Plan par défaut et import Gemini 0.2.2 — 14 septembre 2026

Signalement utilisateur : l’import Gemini échoue sur l’instance réelle, message exact non transmis ; instance et navigateur authentifié non accessibles dans cette session. Causes corrigées d’après le code : mots-clés `minLength`/`maxLength` hors du sous-ensemble documenté de `responseJsonSchema`, rejet complet du plan pour une seule pièce mal tracée, erreurs Google mal classées (clé invalide renvoyée en HTTP 400, surcharge 503, Google injoignable présenté comme add-on inaccessible), absence de détail pour diagnostiquer.

Validé localement : ESLint, TypeScript, 30 tests Vitest, 19 scénarios Playwright (plan par défaut dans le Studio, détail d’erreur, service absent, réduction d’image à 3 072 px, six références visuelles régénérées avec le plan par défaut) et 27 tests Python (réparation de géométrie, conversion d’échelle, classification des réponses Google, schéma fournisseur). Archive `artifacts/mp-glass-0.2.2.zip`, 18 fichiers, SHA-256 `1f59b6c8577eaf03dafc34771a81ffd231c57e6e61c6996e79fb6d056fe1791b`.

Restent à valider : installation sur l’instance HA, appel Gemini réel avec la clé de l’utilisateur et rendu du plan par défaut avec ses zones réelles.

## Simplification Gemini 0.2.1 — 14 septembre 2026

Mode direct configuré depuis les options de MP Glass, avec clé conservée uniquement côté backend. Les installations utilisant déjà un worker restent sur le mode add-on. Contrat partagé entre les deux modes ; tests du PDF inline avec numéro de page, signatures/taille, origine Google fixe, clé en header, erreur 429 sans relance et compatibilité des réglages existants. Liens et information d’envoi complet vérifiés dans le navigateur.

Ces validations sont locales avec réponse Gemini simulée. Aucune installation sur l’instance HA ni analyse avec une clé réelle dans cette session.

## MP Spatial 0.2.0 — 14 septembre 2026

Vue 3D, Studio et add-on Gemini implémentés localement. Vérifications : géométrie/contrat projet, pipeline réel PDFium/Pillow avec sous-processus, API worker authentifiée et fournisseur Gemini simulé. Tests navigateur : rotation, zoom, déplacement clavier, lumière, mobile, brouillon avec accord d’envoi, quota, droits non-admin et conservation des autres niveaux. Captures de plans fictifs dans `artifacts/spatial-desktop.png` et `artifacts/spatial-mobile.png`.

Limites : aucun appel réel Gemini ni mesure de précision, aucun build/installation Supervisor (Docker Engine local indisponible). La 3D n’a pas été déployée sur l’instance utilisateur. Les vérifications HA 2026.9.1 ci-dessous concernent l’incrément précédent. Aucun dépôt distant configuré, donc aucune release HACS publiée.

## Navigation et Studio de personnalisation — 13–14 septembre 2026

La révision frontend r14 a été déployée sur l'instance Home Assistant 2026.9.1. Les routes `home`, `lights`, `rooms` et `area-<area_id>` ont été ouvertes depuis l'interface réelle. Les onglets Accueil, Lumières et Pièces changent bien de vue, la liste des pièces détectées est générée, et la page Cuisine affiche uniquement son équipement associé.

Le raccourci Personnaliser ouvre désormais MP Glass Studio. Les rubriques Identité, Style & matière, Arrière-plan, Disposition, Contenu, Navigation et Équipements ont été chargées et parcourues sur l'instance réelle. Les presets, couleurs, transparence, flou, bordures, ombres, typographie, image, cadrage, densité, grille, espacements, dimensions, visibilité des sections et ordre de navigation sont exposés avec un aperçu direct. Aucun réglage du chantier n'a été modifié pendant cette vérification.

Le chargement réel a révélé un conflit avec la propriété `panel` que Home Assistant assigne aux custom panels. La méthode interne du Studio a été renommée `renderSectionPanel` et un test navigateur reproduit désormais ce contexte Home Assistant. La ressource Lovelace active pointe sur `/mp_glass_static/mp-glass-r14.js?v=0.1.0`. Après remplacement du bundle et fin de propagation, le dashboard et le Studio ont été rechargés avec succès ; le lien Personnaliser est visible dans la navigation du dashboard.

Validation locale associée : ESLint, TypeScript, 24 tests Vitest et build Vite réussis ; les 3 scénarios Playwright du Studio réussissent, y compris le conflit de propriété du custom panel. L'architecture reste une intégration Home Assistant unique. Un add-on est réservé à de futurs traitements lourds (par exemple conversion ou optimisation de plans), car la navigation, le stockage, la découverte et la personnalisation n'en ont pas besoin.

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
