# Validation — incrément lumière 0.1.0

## Associations en un clic 0.7.0 — 14 septembre 2026

Demande utilisateur : simplifier l’association des entités avec le dashboard et le plan. Avant : pièce Home Assistant choisie à part, sans effet sur les équipements, puis jusqu’à 12 cases à cocher par pièce parmi toutes les entités de la maison, et les pièces du dashboard réglées ailleurs. Réponse : une pièce du plan reliée à une pièce Home Assistant en suit les équipements, **Associer automatiquement** relie par le nom, et déplacer ou masquer un équipement depuis le plan écrit la même préférence que la section Équipements.

Validé localement : 45 tests Vitest dont 8 nouveaux (types d’équipements retenus et écartés, diagnostic exclu, ordre de la fiche, 12 au maximum, masqués exclus, plan non modifié par le calcul, déplacement d’une lumière visible à la fois sur le plan et sur la page de pièce ; abréviations SEJOUR/CUIS./S.D.B/W.C./Dgt/CH. 2, chambres ambiguës laissées à l’utilisateur, chambres numérotées, liens existants conservés, étage de même nom), 44 scénarios Playwright dont 3 nouveaux (Studio seul : quatre pièces reliées sur sept, trois nommées à relier, liste automatique, déplacement, ajout d’un capteur sans pièce, masquage, pièce touchée sur le plan ouverte dans l’éditeur, passage à la main et retour ; liste d’avant 0.7.0 passée en automatique quand elle est dans sa pièce, gardée quand elle contient un capteur d’ailleurs ; Studio complet : lumière déplacée dans le plan par défaut, enregistrée comme override, présente dans la pièce Cuisine du plan et sur la page Cuisine du dashboard généré), import d’un niveau reliant « Séjour » à « Salon », six références visuelles du dashboard inchangées, 46 tests Python, lint, types et build. Captures ordinateur et téléphone de l’éditeur inspectées ; un débordement horizontal de la liste d’équipements à 390 px a été corrigé.

Non validé : les noms réels des pièces de l’utilisateur face à ses pièces Home Assistant, et le Studio dans son vrai Home Assistant. Le rapprochement par nom est volontairement prudent : une pièce ambiguë reste à relier à la main.

## Studio en HTTP 0.6.1 — 14 septembre 2026

Retour utilisateur : **Utiliser pour ce niveau** sans effet après une analyse de 13 pièces. Cause reproduite : hors HTTPS, `crypto.randomUUID` n’existe pas et le clic levait `TypeError: crypto.randomUUID is not a function`, fenêtre laissée ouverte. **Ajouter une pièce** et **Ajouter un niveau** échouaient de la même façon.

Validé localement : nouveau scénario Playwright sans `crypto.randomUUID` (échoue sur 0.6.0, réussit sur 0.6.1 : brouillon appliqué, fenêtre fermée, pièce et niveau ajoutés, identifiants au format attendu, aucune erreur de page), 41 scénarios Playwright, 37 tests Vitest, lint, types et build ; bundle reconstruit sans `randomUUID`. Tests Python : `test_project` réussi ; `test_spatial` non exécuté faute d’`aiohttp` dans l’interpréteur local (backend inchangé hors numéro de version). Non validé : le clic dans le vrai Home Assistant de l’utilisateur.

## Précision et ambiances 0.6.0 — 14 septembre 2026

Validé localement : 37 tests Vitest (halos liés aux seules lumières associées, luminosité, indisponibilité, priorité des températures, conversion Fahrenheit, positions et capacités des volets), 46 tests Python (conservation d’un écart de cinq pixels et d’une échelle issue de cotes lors d’une correction manuelle), build TypeScript/Vite et lint. 40 scénarios Playwright réussis, dont : zoom 225 %, déplacement et correction de douze pixels sans aimantation, pincement tactile 240 % sans modification des pièces, contour concave posé sur un mur, fragments superposés, murs gris et traits fins, mode Climat et positions en direct, commandes de volet ciblées, associations conservées après recherche et disparition d’une entité. Six références visuelles actualisées pour les nouvelles commandes du plan, captures ordinateur et téléphone inspectées.

La reconnaissance réelle de Gemini sur le document utilisateur, les commandes sur un volet physique et Safari/iOS restent à vérifier. Les volets sont représentés par des indicateurs dans l’étiquette de pièce ; leur position géographique sur les murs n’est pas détectée. L’échelle thermique est fixe, les couleurs représentent la température mesurée et non une consigne ou une demande de chauffage.

## Pièces en forme libre 0.5.0 — 14 septembre 2026

Retour sur l’import réel (13 pièces, 140,5 m², 19 × 8,7 m) : pouvoir créer des zones non rectangulaires qui suivent la forme des pièces. Réponse : mode **Forme libre** (points d’angle, ajout par les **+**, retrait), **Tracer un contour** angle par angle, aimantation des points sur chaque axe, contours à angles droits intégrés au découpage sans chevauchement de Home Assistant. Le message d’ajustement aux murs n’apparaissait pas sur ce plan de 654 px de large : les murs y font environ 2 px, sous le seuil de 3 px ; l’image est désormais agrandie avant la recherche.

Validé localement : 45 tests Python (séjour en L tracé dans le Studio et cuisine qui y déborde : pas de surface comptée deux fois, contour gardé exactement, boîte tirée du contour), 34 tests Vitest, 35 scénarios Playwright (pièce en L tracée en six clics imprécis, angles posés sur les murs et côtés d’équerre, point déplacé, ajouté par un +, retiré par double clic, par le bouton et par Suppr, retour au rectangle et annulation, Forme libre sur un rectangle ; murs de 2 px trouvés sur une image de 650 px et trait fin ignoré ; plan immobile au changement de mode ; capture téléphone), build. Non validé : manipulation au doigt des points sur un vrai téléphone, murs du vrai plan après agrandissement.

## Modèle choisi avant l’analyse 0.4.2 — 14 septembre 2026

Demande utilisateur après le quota atteint : pouvoir sélectionner le modèle avant l’analyse. Réponse : sélecteur dans le Studio, alimenté par `mp_glass/spatial/info` (administrateur : mode, modèle des options), dernier choix retenu par le navigateur, envoyé comme `quality` à l’import (seuls les modèles proposés sont acceptés par Home Assistant).

Validé localement : 44 tests Python, 34 tests Vitest, 33 scénarios Playwright (réglage par défaut présélectionné et signalé, Flash-Lite choisi puis envoyé et retenu à la réouverture, modèle personnalisé des options proposé en premier, add-on sans sélecteur ni `quality`, relance avec l’autre modèle qui reste sélectionné ; captures ordinateur et téléphone), build. Non validé : commande `mp_glass/spatial/info` dans un vrai Home Assistant.

## Quota Gemini expliqué 0.4.1 — 14 septembre 2026

Essai réel de la 0.4.0 : `HTTP 429 RESOURCE_EXHAUSTED` avec Gemini 3.8 Flash, après une journée d’imports d’essai. Le détail, limité à 300 caractères, s’arrêtait sur « Quota exceeded for metric: gen » : impossible de savoir s’il fallait attendre une minute ou le lendemain. Réponse : lecture des détails `QuotaFailure` et `RetryInfo` de Google (ou, à défaut, de son message), message précis, heure de renouvellement du quota journalier, autre modèle proposé d’un clic, compte à rebours pour une limite par minute.

Validé localement : 44 tests Python (quota journalier retenu parmi plusieurs dépassements, limite 0 lue dans le message seul, quota de jetons par minute, informations du worker revérifiées, réponse du worker complétée), 34 tests Vitest, 31 scénarios Playwright (Europe/Paris à 17 h 50 : « demain à 9 h », bouton de l’autre modèle mis en avant, rien renvoyé sans clic ; décompte de 2 s puis **Réessayer** actif), build. Non validé : format exact des détails renvoyés par Google pour Gemini 3.8 Flash, à confirmer au prochain dépassement.

## Pièces détectées modifiables 0.4.0 — 14 septembre 2026

Retour utilisateur sur l’import réel de la 0.3.1 (13 pièces, 136 m², 19 × 8,7 m) : améliorer encore la détection, pouvoir modifier les zones détectées, en ajouter et en supprimer. Réponse : éditeur de zones sur le plan d’origine (poignées, déplacement, tracé, suppression, renommage, annulation), murs dessinés repérés dans le navigateur et bords des pièces posés sur leur axe, plan recalculé par Home Assistant (`mp_glass/spatial/normalize`, administrateur) avec la géométrie de l’analyse.

Validé localement : 43 tests Python (pièces renvoyées pour édition puis plan identique, ajout et retrait, échelle estimée conservée pendant les retouches et échelle invalide ignorée, pièces du worker mal formées rejetées), 34 tests Vitest, 29 scénarios Playwright (sur une image de plan dessinée : bord de cuisine décalé de 10 px posé sur son mur, poignée tirée librement puis collée à un mur, annulation, pièce tracée et renommée, suppression par la liste et par la touche Suppr, couleurs conservées, application au niveau ; au doigt : poignée tirée sans faire défiler, défilement de la fenêtre ailleurs), build. Non validé : repérage des murs sur le vrai plan de l’utilisateur (murs gris clair ou hachurés, filigrane), à juger au prochain import.

## Gemini surchargé 0.3.1 — 14 septembre 2026

Premier essai réel de la 0.3.0 : `HTTP 503 UNAVAILABLE This model is currently experiencing high demand` avec Gemini 3.8 Flash. La requête (schéma, réflexion, image) est donc acceptée ; seule la capacité du modèle manquait. Parade : deux nouveaux envois après 4 et 12 s pour les erreurs 5xx, puis choix de l’autre modèle pour l’analyse en cours, depuis la fenêtre d’échec.

Validé localement : 40 tests Python (503 puis succès avec une requête identique, trois 503 signalés avec le détail Google, quota et refus jamais relancés), 34 tests Vitest, 28 scénarios Playwright (message nommant les deux modèles, relance avec `quality=fast`), build. Non validé : disponibilité réelle des modèles au moment de l’essai.

## Analyse du plan refondue 0.3.0 — 14 septembre 2026

Retour utilisateur après 0.2.7 : résultat encore insuffisant. Refonte : détection des pièces par Gemini en boîtes normalisées 0–1000, géométrie calculée localement (proportions de l’image lues dans l’en-tête, alignement des murs, découpage sans chevauchement sur grille, échelle depuis les cotes écrites ou la surface habituelle des pièces), Gemini 3.8 Flash par défaut, PDF dessiné dans le navigateur (PDF.js), superposition du résultat sur le plan analysé avec renommage et exclusion des pièces, murs dessinés une fois avec murs extérieurs distingués.

Essai de bout en bout de la géométrie sur une détection plausible du plan de test utilisateur (13 boîtes relevées sur l’image 654 × 463, cotes en pieds) : 13 pièces, 136,8 m², 18,6 × 8,5 m, échelle calculée à partir de 7 cotes, aucun chevauchement.

Validé localement : 39 tests Python (proportions, échelle depuis les cotes quel que soit leur ordre, cotes contradictoires ignorées, murs alignés, placard qui découpe une chambre en L, contours réparés ou ignorés, taille lue dans les en-têtes PNG, JPEG, WebP avec et sans perte, repli des requêtes), 34 tests Vitest (murs mitoyens dessinés une fois), 27 scénarios Playwright (superposition, renommage, exclusion, onglet 3D ; PDF réel dessiné par PDF.js et envoyé en PNG 2 400 px ; page absente signalée ; six références visuelles régénérées avec les nouveaux murs), build (`mp-glass.js` d’un seul tenant, PDF.js et son worker en morceaux relatifs). Non validé : précision réelle de Gemini 3.8 Flash sur des plans, à juger sur un nouvel import.

## Schéma accepté et interface à jour 0.2.7 — 14 septembre 2026

Deuxième import réel (0.2.6) : 13 pièces nommées en français, échelle calculée à partir des cotes de 7 pièces (chambre 3 : 10,2 m², 3 × 3,4 m, conforme au 10X11 ft du plan), placards fusionnés ; mais message « Plan obtenu avec une requête simplifiée : Gemini a refusé le schéma de réponse », donc sans réflexion `medium`, et interface du Studio antérieure à 0.2.5 (page non rechargée après la mise à jour). Suspect principal du refus : limites de longueur de tableaux imbriqués dans le schéma (60 pièces × 40 sommets × 2 valeurs). Parade : schéma sans limites, repli gardant la réflexion, bandeau de rechargement.

Validé localement : 38 tests Python (schéma sans minItems/maxItems, repli sans schéma avec réflexion puis requête la plus simple, trois refus détaillés, deux pour un modèle 2.x, chevauchement Buanderie / Salle d’eau signalé et pièces disjointes ignorées), 33 tests Vitest, 25 scénarios Playwright (bandeau « MP Nexus 0.0.1 est installé, mais cette page affiche encore la version… » avec Recharger la page ; absent quand les versions concordent), build (`mp-glass.js?v=0.2.7` issu de `package.json`). Non validé : acceptation réelle du schéma allégé par Gemini ; le brouillon indiquera la forme de requête utilisée.

## Plans importés plus fidèles 0.2.6 — 14 septembre 2026

Premier import réel réussi (plan de maison coté en pieds, image avec filigrane) : 16 pièces pour 31 m² au lieu d’environ 150 m², pièces chevauchantes à gauche du plan, noms restés en anglais, placards comptés comme pièces. Corrections : prompt réécrit (murs extérieurs puis cotes puis pièces jointives, conversion pieds/pouces, placards rattachés, noms en français, filigranes ignorés), réflexion `medium`, échelle recalculée à partir des cotes écrites, murs proches alignés, surfaces invraisemblables signalées.

Validé localement : 36 tests Python (calibrage à partir de cotes lues au double de la taille dessinée, cotes contradictoires ignorées, murs décalés de 5 à 8 cm alignés, surface moyenne de 1 m² signalée, contenu du prompt, niveau de réflexion absent de la requête simplifiée et des modèles 2.x), 33 tests Vitest, 24 scénarios Playwright, build. Non validé : qualité réelle du nouveau prompt, qui dépend du modèle ; à juger sur un nouvel import.

## Import fiabilisé et fenêtre d’analyse 0.2.5 — 14 septembre 2026

Signalement utilisateur : `HTTP 400 INVALID_ARGUMENT Request contains an invalid argument.` avec `gemini-3.5-flash-lite`, sans détail de champ. Cause non déterminable sans appel réel (aucune clé dans cette session) ; suspects dans la requête : budget de sortie porté à 65 536 en 0.2.3, schéma de réponse imposé ; sinon le document lui-même. Parade : budget ramené à 32 768, un seul renvoi sans schéma de réponse sur un 400 invalide, détail des `fieldViolations` de Google, message orientant vers une image si les deux requêtes sont refusées.

Validé localement : 33 tests Vitest, 24 scénarios Playwright (fenêtre de progression avec étapes et chronomètre, Échap sans effet pendant l’analyse, annulation envoyée au serveur, fenêtre de résultat avec aperçu 3D, résumé 104 m² · 13 × 8 m et avertissements, Ignorer ; fermeture de la fenêtre d’erreur avant nouvel essai), 31 tests Python (renvoi unique sans schéma après un 400, double refus détaillé, 429 / clé invalide / précondition jamais renvoyés), build. Non validé : appel Gemini réel, commande d’annulation sur une instance Home Assistant réelle.

## Dashboard créé à l’installation 0.2.4 — 14 septembre 2026

Signalement utilisateur : après installation par HACS sur une autre instance, seul le Studio apparaît, pas le dashboard. Cause : le dashboard devait être ajouté à la main (Paramètres → Tableaux de bord) et le lien du Studio visait une adresse fixe `/mp-glass/home` inexistante.

Validé localement : 33 tests Vitest (dont réutilisation d’un dashboard MP Nexus existant quelle que soit son adresse, création avec la strategy `custom:mp-glass`, adresse de repli si `mp-glass` est prise), 22 scénarios Playwright (installation neuve : création du dashboard par le Studio, message affiché, lien vers `/mp-glass/home`), 28 tests Python, build. Non validé : création réelle sur une instance Home Assistant.

## Plan 3D mobile, Gemini 3.5 et HACS 0.2.3 — 14 septembre 2026

Signalements utilisateur : plan 3D difficile à utiliser sur téléphone (le plan capte le défilement) ; import Gemini refusé avec `HTTP 404 NOT_FOUND This model models/gemini-2.5-flash-lite is no longer available to new users`. Modèle de remplacement `gemini-3.5-flash-lite` vérifié sur la documentation Google du jour (stable, PDF et images, sortie JSON structurée, palier gratuit).

Validé localement : ESLint, TypeScript, 30 tests Vitest, build, 22 scénarios Playwright (dont gestes tactiles réels par CDP : défilement de la page à côté de la maison, rotation sans défilement sur la maison ; molette et glisser souris ; fiche de pièce, commandes groupées et variateur ; six références visuelles régénérées) et 28 tests Python (modèle par défaut, température Gemini 3, erreur 404 réelle classée). Les tests tactiles échouent si l’on rétablit l’ancien comportement ou si l’on supprime le blocage du défilement sur la maison.

Non validé : appel Gemini réel avec `gemini-3.5-flash-lite`, installation et mise à jour réelles par HACS, Safari/iOS et matériel tactile réel.

## Plan par défaut et import Gemini 0.2.2 — 14 septembre 2026

Signalement utilisateur : l’import Gemini échoue sur l’instance réelle, message exact non transmis ; instance et navigateur authentifié non accessibles dans cette session. Causes corrigées d’après le code : mots-clés `minLength`/`maxLength` hors du sous-ensemble documenté de `responseJsonSchema`, rejet complet du plan pour une seule pièce mal tracée, erreurs Google mal classées (clé invalide renvoyée en HTTP 400, surcharge 503, Google injoignable présenté comme add-on inaccessible), absence de détail pour diagnostiquer.

Validé localement : ESLint, TypeScript, 30 tests Vitest, 19 scénarios Playwright (plan par défaut dans le Studio, détail d’erreur, service absent, réduction d’image à 3 072 px, six références visuelles régénérées avec le plan par défaut) et 27 tests Python (réparation de géométrie, conversion d’échelle, classification des réponses Google, schéma fournisseur). Archive `artifacts/mp-glass-0.2.2.zip`, 18 fichiers, SHA-256 `1f59b6c8577eaf03dafc34771a81ffd231c57e6e61c6996e79fb6d056fe1791b`.

Restent à valider : installation sur l’instance HA, appel Gemini réel avec la clé de l’utilisateur et rendu du plan par défaut avec ses zones réelles.

## Simplification Gemini 0.2.1 — 14 septembre 2026

Mode direct configuré depuis les options de MP Nexus, avec clé conservée uniquement côté backend. Les installations utilisant déjà un worker restent sur le mode add-on. Contrat partagé entre les deux modes ; tests du PDF inline avec numéro de page, signatures/taille, origine Google fixe, clé en header, erreur 429 sans relance et compatibilité des réglages existants. Liens et information d’envoi complet vérifiés dans le navigateur.

Ces validations sont locales avec réponse Gemini simulée. Aucune installation sur l’instance HA ni analyse avec une clé réelle dans cette session.

## MP Spatial 0.2.0 — 14 septembre 2026

Vue 3D, Studio et add-on Gemini implémentés localement. Vérifications : géométrie/contrat projet, pipeline réel PDFium/Pillow avec sous-processus, API worker authentifiée et fournisseur Gemini simulé. Tests navigateur : rotation, zoom, déplacement clavier, lumière, mobile, brouillon avec accord d’envoi, quota, droits non-admin et conservation des autres niveaux. Captures de plans fictifs dans `artifacts/spatial-desktop.png` et `artifacts/spatial-mobile.png`.

Limites : aucun appel réel Gemini ni mesure de précision, aucun build/installation Supervisor (Docker Engine local indisponible). La 3D n’a pas été déployée sur l’instance utilisateur. Les vérifications HA 2026.9.1 ci-dessous concernent l’incrément précédent. Aucun dépôt distant configuré, donc aucune release HACS publiée.

## Navigation et Studio de personnalisation — 13–14 septembre 2026

La révision frontend r14 a été déployée sur l'instance Home Assistant 2026.9.1. Les routes `home`, `lights`, `rooms` et `area-<area_id>` ont été ouvertes depuis l'interface réelle. Les onglets Accueil, Lumières et Pièces changent bien de vue, la liste des pièces détectées est générée, et la page Cuisine affiche uniquement son équipement associé.

Le raccourci Personnaliser ouvre désormais MP Nexus Studio. Les rubriques Identité, Style & matière, Arrière-plan, Disposition, Contenu, Navigation et Équipements ont été chargées et parcourues sur l'instance réelle. Les presets, couleurs, transparence, flou, bordures, ombres, typographie, image, cadrage, densité, grille, espacements, dimensions, visibilité des sections et ordre de navigation sont exposés avec un aperçu direct. Aucun réglage du chantier n'a été modifié pendant cette vérification.

Le chargement réel a révélé un conflit avec la propriété `panel` que Home Assistant assigne aux custom panels. La méthode interne du Studio a été renommée `renderSectionPanel` et un test navigateur reproduit désormais ce contexte Home Assistant. La ressource Lovelace active pointe sur `/mp_glass_static/mp-glass-r14.js?v=0.1.0`. Après remplacement du bundle et fin de propagation, le dashboard et le Studio ont été rechargés avec succès ; le lien Personnaliser est visible dans la navigation du dashboard.

Validation locale associée : ESLint, TypeScript, 24 tests Vitest et build Vite réussis ; les 3 scénarios Playwright du Studio réussissent, y compris le conflit de propriété du custom panel. L'architecture reste une intégration Home Assistant unique. Un add-on est réservé à de futurs traitements lourds (par exemple conversion ou optimisation de plans), car la navigation, le stockage, la découverte et la personnalisation n'en ont pas besoin.

## Reprise sur instance utilisateur — 11 septembre 2026

Session navigateur authentifiée accessible. Version constatée dans l'interface : Core 2026.9.1, Supervisor 2026.09.0, frontend 20260826.6, installation Supervised. Le vertical slice lumière a été validé sur cette instance réelle.

Archive initiale transférée via File editor, SHA-256 local/serveur identique : `feb53592ab6eb3954c0edd0ffa5ce85d6e3795d8e44874f3ac5e051f4e36d113`. Absence préalable de `custom_components/mp_glass` vérifiée, 12 fichiers extraits avec refus d'écrasement. `ha core check` a réussi, puis le redémarrage autorisé par l'utilisateur a réussi. Le Config Flow, le panneau administrateur, le stockage du projet et la lecture des registries ont ensuite fonctionné.

Découverte réelle : 642 entités analysées, 9 lumières reconnues et 5 lumières sans pièce à vérifier. Les 633 entités génériques sont conservées dans une vue Inventaire repliée et paginée, sans encombrer la revue. Le dashboard `MP Nexus Test` a été créé par le dialogue natif. Les vues Accueil, Cuisine, Entrée, Salle de bains et Inventaire ont été générées.

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

Scénarios navigateur : cible du service light, état après retour de la fixture, slider conditionnel, fenêtre Détails à la place du more-info natif, barre et cadran tactiles, historique lu chez l’enregistreur, erreur de permission simulée, unavailable, absence de débordement, réglages de pièce, sauvegarde avec override conservé, strategy depuis projet enregistré et editor config-changed. Les réponses réseau de ces tests sont des doubles de contrat explicitement identifiés.

Benchmark local noyau Node (une exécution, pas un percentile ni du temps réseau/rendu) : 20 entités 0,22 ms ; 100 0,96 ms ; 500 3,39 ms ; 1000 3,40 ms. Seuil de garde testé : 500 ms. Aucun budget de rendu mobile ni consommation mémoire n'est encore certifié.

## Porte du premier vertical slice lumière : PASSÉE

Le chemin install → Config Flow → découverte → capability POWER/DIM → résolution MP Nexus Light → génération du dashboard → commande → retour d'état a fonctionné sur Home Assistant 2026.9.1. Cette validation couvre le serveur et son état Home Assistant ; aucun constat physique visuel de l'ampoule n'a été revendiqué.

Restent à valider avant une release stable : refus non-admin, unload/reload après installation définitive du bootstrap, édition concurrente sur HA réel, version minimale 2026.6, Safari/iOS et orientations physiques.

## Release : NON PUBLIÉE

Paquet local corrigé dans `artifacts/mp-glass-0.1.0.zip` après checks : 13 fichiers, SHA-256 `70ecf8cfdd17de498d9151b4eb66ecc4b7390038a045df001dcbdbf8b7cfb8ae`. Dépôt Git local autonome, branche `codex/mp-glass-foundation`, aucun remote produit configuré. Manifest et package indiquent 0.1.0 ; changelog unreleased. HACS utilise la version du tag et la version manifest ; `hacs.json` fixe le minimum cible HA sans propriété de version inventée.

La destination `Micpi/mp-glass` du manifest est proposée, pas une URL de dépôt confirmé. Hassfest/HACS et CI distante ne sont pas exécutés. Aucun tag/release stable ne doit annoncer la validation du parcours réel tant que cette porte n'est pas passée. Le script parent de publication est limité à custom_cards/integrations et n'a pas été lancé sur les changements étrangers du workspace.

## Périmètre restant

Climate, Cover, TV/Remote, Alarm, Camera, MP Spatial, wizard complet, draft/publish, rollback, rôles graphiques, subscriptions registry, appareils et templates avancés restent au backlog. Voir ROADMAP.md. Ce rapport ne vaut pas acceptation du MVP 1 complet.
