# MP Spatial — plan 3D et import Gemini

Implémentation de développement 0.2.7. Le parcours recommandé est [Gemini direct sans add-on](GEMINI_QUICKSTART.md). La référence graphique fournie sert de direction visuelle. La scène actuelle contient sols, cloisons transparentes et étiquettes ; meubles, portes/fenêtres, escaliers et textures ne sont pas encore reconstruits.

## Plan par défaut

Sans plan enregistré, l’accueil affiche un plan schématique construit à partir des registres Home Assistant : un niveau par étage HA (ordonnés par `level`, 2,8 m par niveau), une pièce rectangulaire par zone, proportionnée selon son nom (salon, cuisine, chambre, WC…), reliée à sa zone et à ses lumières/thermostats (12 maximum). Les zones sans étage rejoignent le niveau le plus proche du rez-de-chaussée. Sans aucune zone, le plan d’exemple fictif est affiché. Une mention invite à importer ou dessiner le vrai plan.

Ce plan est recalculé à chaque génération du dashboard et n’est pas enregistré. Dans **Studio → Plan 3D**, il sert de point de départ : toute modification ou tout import Gemini le transforme en plan du projet après **Enregistrer**. L’import d’un niveau reprend automatiquement les associations des pièces de même nom (celles du plan par défaut portent le nom des zones HA). **Repartir du plan par défaut** remplace le plan courant par celui des zones actuelles. Pour revenir à l’accueil sans plan, décocher **Afficher le plan sur l’accueil** puis enregistrer.

## Utiliser depuis Home Assistant

1. Installer MP Glass 0.2.7 ([HACS ou copie manuelle](INSTALL.md)) et redémarrer HA. Si une ressource Lovelace historique pointe vers `mp-glass-r14.js`, la remplacer par `/mp_glass_static/mp-glass-bootstrap.js?v=0.2.7`, puis recharger le navigateur.
2. Ouvrir **MP Glass Studio → Plan 3D**. **Ajouter une pièce** et **Charger un exemple** fonctionnent sans add-on et sans IA. L’exemple est fictif.
3. Pour l’import IA, ouvrir les options de l’intégration, choisir **Gemini direct — sans add-on** et saisir la clé API Gemini. Aucun worker à installer.
4. Uniquement pour le mode avancé **Add-on Spatial**, installer le worker puis renseigner son adresse et la même `api_token` dans l’intégration. Pour un add-on local Supervisor : `http://local-mp-glass-spatial:8099`. Un dépôt d’add-ons peut donner un préfixe différent : utiliser le nom d’hôte indiqué par HA.
5. Choisir un PDF non chiffré (page 1–100), PNG, JPEG ou WebP, maximum 8 Mo. Cocher l’envoi à Google, puis **Générer le brouillon 3D**. Une fenêtre suit l’analyse étape par étape (préparation, envoi, analyse avec chronomètre) et permet de l’annuler ; elle affiche ensuite le brouillon en 3D (pièces, surface, dimensions, avertissements) ou la cause de l’échec avec **Réessayer**. Une seule analyse à la fois, cinq minutes maximum ; quitter le Studio arrête l’analyse en cours.
6. Examiner le brouillon, cliquer **Utiliser pour ce niveau**, corriger noms, contours, hauteur et échelle. Exemple : une longueur affichée de 5 m pour une cote réelle de 6 m nécessite un facteur 1,2. La hauteur des murs reste indépendante.
7. Associer les pièces HA et sélectionner les capteurs/lumières à afficher. L’association de pièce est un repère ; les équipements se sélectionnent explicitement.
8. Cliquer **Enregistrer** dans le Studio puis recharger le dashboard. Le plan remplace le texte d’accueil lorsque **Afficher le plan sur l’accueil** est activé. Une détection des équipements conserve le plan.

L’image d’inspiration n’est pas un plan coté : importer un véritable plan 2D pour reconstruire la maison.

## Interactions

Un geste ne pilote le plan que s’il commence **sur la maison** (sols ou murs d’une pièce, avec 14 px de tolérance au doigt). Commencé à côté, il agit sur la page : sur un téléphone, on fait défiler le dashboard en posant le doigt autour de la maison, sans rester bloqué dans le plan. Un geste garde sa cible jusqu’au bout (un pincement qui déborde de la maison continue de zoomer ; une série de crans de molette commencée sur la page continue de la faire défiler).

- Souris : glisser la maison pour tourner, molette sur la maison pour zoomer, clic droit pour déplacer. Le curseur « main » signale la zone active.
- Tactile : un doigt sur la maison pour tourner, pincement et deux doigts pour zoomer/déplacer ; ailleurs, défilement normal.
- Clavier : focus sur le canevas, flèches pour déplacer, +/− pour zoomer ; boutons et liste de pièces accessibles au clavier.
- Commandes réduites à une barre d’icônes : zoom (masqué sur écran tactile, le pincement suffit), recentrer, vue de dessus, murs. Niveaux en onglets au-dessus du plan quand il y en a plusieurs.
- Liste des pièces sous le plan (défilement horizontal sur téléphone) ; un point doré signale une lumière allumée, aussi visible en 3D (sol teinté).
- Pièce sélectionnée : caméra centrée sur la pièce, fiche avec surface et dimensions, lumières allumées, température et humidité, **Tout allumer / Tout éteindre**, interrupteur et variateur par lumière, capteurs (valeur et dernière mise à jour), thermostats, ouvertures et présence. Toucher un équipement ouvre sa fiche Home Assistant ; **Ouvrir la pièce** mène à la page de la zone associée. Aucune commande via le worker.
- Sur grand écran, la fiche s’affiche à droite du plan ; sur téléphone et tablette en portrait, sous le plan.

Sans WebGL 2, les pièces et leurs fiches restent accessibles depuis la liste. Rendu à la demande, ressources GPU libérées en quittant la vue.

## Gemini et gratuité

Le modèle par défaut est `gemini-3.5-flash-lite` (configurable en mode add-on), qui accepte PDF, images et sortie JSON structurée. `gemini-2.5-flash-lite`, l’ancien défaut, est refusé aux nouveaux projets Google (HTTP 404). Les entrées/sorties standard de `gemini-3.5-flash-lite` sont proposées au palier gratuit lors de la vérification du 14 septembre 2026, sous quotas et disponibilité du projet Google ; au-delà, il coûte plus cher que la génération 2.5. La température reste à la valeur par défaut recommandée par Google pour Gemini 3 ; la réflexion du modèle est demandée au niveau `medium` (Flash-Lite réfléchit au minimum par défaut, trop peu pour agencer les pièces) et comptée dans le budget de 32 768 jetons de sortie. Utiliser un projet API **sans facturation activée** pour éviter les frais ; l’application ne peut pas vérifier le statut de facturation via la clé. Un abonnement Gemini grand public ne remplace pas une clé API.

Lecture du plan : le prompt fait d’abord repérer les murs extérieurs, puis lire les cotes écrites (« 12X16 », « 12'-6" x 10' », « 3,50 x 4,20 », pieds et pouces convertis en mètres), puis tracer des pièces rectangulaires jointives, sans chevauchement, nommées en français (BED 2 → Chambre 2, W.I.C. → Dressing…). Les placards de moins de 1,5 m² sont rattachés à la pièce voisine ; filigranes, mobilier et aménagements extérieurs sont ignorés. MP Glass vérifie ensuite localement : l’échelle est recalculée à partir des cotes écrites d’au moins deux pièces quand elles concordent avec le dessin, les murs distants de moins de 15 cm sont alignés, une surface moyenne invraisemblable (moins de 3 m² ou plus de 60 m² par pièce) est signalée, ainsi que les pièces rectangulaires qui se chevauchent de plus de 0,5 m².

En mode direct, le fichier complet (métadonnées et autres pages PDF incluses) est envoyé à Google ; le numéro de page guide le modèle sans extraction locale. En mode add-on, seule la page rasterisée est envoyée. Ni les entités ni les états HA ne sont joints. Selon Google, les données du palier gratuit peuvent servir à améliorer leurs produits. L’accord d’envoi est présenté pour chaque fichier. Une erreur 429 est affichée sans relance, changement de modèle ni basculement payant. Seule exception : une requête refusée comme invalide (HTTP 400 `INVALID_ARGUMENT`, ni traitée ni facturée) est renvoyée, au même modèle et avec le même document, sous une forme allégée : d’abord sans schéma de réponse imposé (réflexion `medium` conservée), puis en dernier recours sans schéma ni réflexion approfondie ; le brouillon indique la forme utilisée et le résultat reste validé localement. Le schéma envoyé ne porte aucune limite de longueur de tableau : avec des limites imbriquées, `gemini-3.5-flash-lite` le refusait.

[Tarification officielle](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite) · [Sortie JSON structurée](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

## Contrat et confidentialité

`project.spatial` est optionnel dans le schéma projet v2, avec sa propre `version: 1`. Coordonnées X/Y en mètres, origine commune par niveau. Maximum 8 niveaux, 60 pièces par niveau, 40 sommets par pièce, coordonnées ±200 m. IDs uniques ; polygones croisés, dégénérés ou avec arêtes nulles rejetés côté client, intégration et worker.

En mode direct : HTTP authentifié → vérification taille/type/signature → Google → JSON validé. Aucun décodeur PDF/image dans Core et aucune sauvegarde du fichier.

En mode add-on, les sources ne sont jamais sauvegardées par MP Glass : HTTP authentifié → mémoire du worker → sous-processus PDFium/Pillow → PNG sans métadonnées → Gemini → JSON validé. Pas de SVG/HTML, d’instructions exécutées depuis le document, de fichier sous `www`, de chemin utilisateur ni de lien public. Sous-processus limité à 30 secondes, 768 Mo d’espace mémoire virtuel et 25 secondes CPU sous Linux. Images limitées à 24 mégapixels, PDF à 100 pages, raster à 2048 pixels de côté.

En mode direct, clé Gemini dans les options de l’intégration HA. En mode add-on, clé Gemini dans les options du worker et clé de liaison dans les options HA. Les sauvegardes HA peuvent contenir ces secrets, exclus des exports MP Glass et des diagnostics.

Une seule tâche éphémère reste en mémoire. Fermer le Studio ou recharger l’intégration peut nécessiter une nouvelle analyse. Aucun résultat IA n’est automatiquement enregistré. L’import remplace seulement le niveau choisi ; les autres niveaux sont préservés. Les associations des pièces de même nom sont reprises et doivent être vérifiées.

## Limites de validation

Aucun appel Gemini réel avec une clé dans cette session : les tests simulent le fournisseur et ne mesurent pas la précision de reconnaissance. Build et installation Linux Supervisor, Safari/iOS et matériel tactile restent à valider. Chevauchements entre pièces, trous internes, mobilier, ouvertures, undo/redo et déplacement graphique direct des sommets restent à développer.

Le mode Gemini direct, le rendu et les commandes HA fonctionnent sans add-on. HA Container peut utiliser le même worker en conteneur séparé ; l’usage quotidien reste dans le Studio.
