# Changelog

## 0.7.13 — éteindre tout un niveau

Demande utilisateur : un bouton dans la fiche « Vue d’ensemble » pour éteindre tout le niveau.

- **Éteindre tout le niveau** : sous le compteur de lumières, un bouton éteint d’un appui toutes les lumières allumées des pièces du niveau affiché, en une seule commande Home Assistant. Seules les lumières associées aux pièces du plan sont concernées ; volets, thermostats et autres équipements ne sont pas touchés.
- Quand plus rien n’est allumé, le bouton indique **Tout est éteint** et reste inactif. Il n’apparaît pas sur un niveau sans lumière.

## 0.7.12 — version de l’intégration alignée

Retour utilisateur après la mise à jour 0.7.11.

- **Cause** : 0.7.11 n’avait pas mis à jour la version dans `const.py`. Home Assistant continuait donc d’annoncer 0.7.10 et de servir le dashboard sous l’adresse de 0.7.10 : un navigateur pouvait garder l’ancien fichier en cache et chercher le module 3D de 0.7.10, supprimé par la mise à jour (plan 3D indisponible), et le Studio demandait sans fin de recharger la page.
- **Correction** : la même version, 0.7.12, dans le paquet, le manifeste et `const.py`. Un test vérifie désormais que ces versions et le dashboard compilé concordent avant chaque publication.
- Aucune autre modification : la vue enregistrée de 0.7.11 est inchangée.

## 0.7.11 — la vue du plan, enregistrée

Demande utilisateur : pouvoir enregistrer la position actuelle du plan en maintenant le bouton Recentrer appuyé, pour la rappeler ensuite d’un simple appui, avec une fenêtre de validation.

- **Appui long sur Recentrer** : garder le bouton appuyé une demi-seconde (ou faire un clic droit dessus) ouvre une fenêtre qui demande si la maison, telle qu’elle est cadrée à l’écran, doit devenir la vue du niveau. Rien n’est enregistré sans **Enregistrer**.
- **Un appui la rappelle** : une fois la vue enregistrée, le bouton y ramène — angle, zoom et position — au lieu du cadrage par défaut, et un point bleu le signale. Le niveau s’ouvre également sur cette vue.
- **La remplacer ou l’oublier** : un nouvel appui long propose d’enregistrer la vue courante à la place, ou d’**oublier la vue enregistrée** pour revenir au cadrage automatique.
- Chaque niveau garde sa propre vue ; **Vue de dessus** continue de donner le cadrage standard. Les vues sont gardées dans le navigateur, sans rien changer au plan enregistré ni aux autres appareils.

## 0.7.10 — des murs nets

Demande utilisateur : des murs moins brouillons sur le plan 3D.

- **Une cloison entre deux pièces, pas deux murs** : un plan lu sur un dessin garde l’épaisseur du mur entre deux pièces voisines. Chacune avait donc son propre mur, épais et lumineux comme un mur extérieur, d’où les doubles traits. Les côtés distants de moins de 30 cm sont désormais réunis au milieu de cette épaisseur : les voisines partagent une seule cloison, plus fine. Seul l’affichage change ; le plan enregistré, les surfaces et le Studio restent tels quels.
- **Plus de contours de boîtes** : chaque morceau de mur était une boîte dont les 12 arêtes étaient tracées, avec des traits parasites à chaque jonction et à chaque coupure d’un mur. Un mur est maintenant une paroi de verre soulignée en haut et au pied ; ses morceaux et les murs qui se rejoignent se raccordent sans couture. Un trait vertical marque seulement les angles de la maison.
- **Vue de dessus sans perspective** : vus d’au-dessus avec l’objectif du plan 3D, les murs penchaient vers l’extérieur, d’où le haut et le pied de chaque mur décalés et les diagonales aux angles. La vue de dessus utilise un objectif quasi sans perspective : elle se lit comme un plan. Zoom, rotation et recentrage fonctionnent comme avant ; quitter la vue de dessus rend la perspective.
- Un plan qui change pendant la vue de dessus y reste cadré au lieu de revenir à la vue 3D.

## 0.7.9 — étiquettes du plan plus lisibles

Demande utilisateur : améliorer l’affichage des noms de pièce sur le plan 3D et ne plus proposer de température vide quand aucune entité n’est liée.

- **Température seulement là où elle se mesure** : en mode Climat, une pièce sans capteur de température ni thermostat qui mesure la pièce n’affiche plus « 🌡 — », seulement son nom. « — » reste pour un capteur lié mais hors ligne, avec l’infobulle « Température indisponible ».
- **Pas de mode Climat vide** : si aucune pièce du niveau ne mesure sa température, les boutons Lumières / Climat et la légende ne sont plus affichés ; le plan montre les lumières.
- **Étiquettes plus nettes** : le nom tient sur une ligne dans une pastille de verre compacte, un peu plus grande et plus contrastée. Une deuxième ligne n’apparaît que s’il y a une valeur à lire (température, volets). Le point bleu présent sur chaque pièce disparaît : seul reste le point doré d’une lumière allumée, et seulement en mode Lumières, où il ne se confond plus avec la légende des températures. Un nom trop long se termine par « … », en entier au survol, et une étiquette près du bord du plan garde sa largeur.
- Sur l’étiquette de la pièce sélectionnée, la température garde un fond sombre : un bleu sous 18 °C reste lisible.

## 0.7.8 — bandeau noir, suite

Retour utilisateur : après 0.7.7, la flèche retour et le titre ont disparu mais le bandeau noir reste en haut des sous-vues.

- **Cause** : 0.7.7 rendait la barre de Home Assistant transparente. Sur l’installation réelle, une autre règle continue de la peindre (un thème ou un module peut le faire, y compris en `!important`, sur la barre ou sa toolbar), alors que Home Assistant seul la laisserait transparente.
- **Correction** : sur les vues MP Glass, la barre est désormais masquée, pas seulement transparente. Seules ses actions (recherche, Assist, modification) et, sur téléphone, le bouton du menu latéral restent visibles. Ce qui la peindrait ne s’affiche plus, et les clics au-dessus du contenu défilé atteignent MP Glass.
- Mode édition et autres dashboards : inchangés.

## 0.7.7 — plus de bandeau noir sur les sous-vues

Demande utilisateur : retirer le bandeau noir affiché en haut des pages Lumières, Pièces, des pièces et de l’Inventaire.

- Ce bandeau était la barre de Home Assistant, opaque sur une sous-vue avec sa flèche retour et le titre de la vue. Sur les vues MP Glass, elle est désormais transparente comme sur l’accueil : le fond passe dessous et seules restent ses actions (recherche, Assist, modification). La flèche retour et le titre, redondants avec l’en-tête MP Glass, ne sont plus affichés ; le retour du navigateur ramène toujours à la page précédente.
- En mode édition, la barre de Home Assistant reprend son aspect habituel. Les autres dashboards ne sont pas concernés.

## 0.7.6 — cause trouvée : le registre des éléments remplacé

Retour utilisateur : après 0.7.5, `Timeout waiting for strategy element ll-strategy-dashboard-mp-glass to be registered` aussi sur ordinateur.

- **Cause, observée sur l’installation réelle** : un module HACS charge le polyfill `scoped-custom-element-registry`, qui remplace le registre des éléments du navigateur (`window.customElements`) par un nouveau registre ignorant tout ce qui a été déclaré avant lui. MP Glass, chargé très tôt, s’y trouvait donc absent, et Home Assistant l’y attendait en vain. L’erreur dépendait de l’ordre de chargement, d’où son côté aléatoire, surtout sur tablette et téléphone.
- **Correction** : MP Glass déclare à nouveau sa stratégie, ses vues, ses cartes et son plan dans tout registre qui remplace le précédent. Même si c’est après les 5 s d’attente, le dashboard remplace l’erreur de lui-même. Aucune ressource ni réglage à ajouter.
- Téléchargement de l’interface : une nouvelle génération du dashboard sur la même page ne réessaie plus des adresses déjà en échec.
- Page de diagnostic : message explicite quand elle est ouverte comme fichier local plutôt que depuis Home Assistant.

## 0.7.5 — le dashboard se rattrape seul

Retour utilisateur : l’erreur `Timeout waiting for strategy element ll-strategy-dashboard-mp-glass to be registered` persiste après 0.7.4.

- **Rattrapage automatique** : si la stratégie est déclarée après l’abandon de Home Assistant (5 s), MP Glass remplace l’erreur par le dashboard à la mise à jour d’état suivante, sans recharger la page. Home Assistant interroge pour cela la stratégie à chaque mise à jour.
- **Anciennes tablettes** : le bootstrap utilisait une syntaxe (`??=`) illisible par iOS 12 et 13 ou les vieilles WebView Android. La stratégie n’était alors jamais déclarée, d’où l’erreur de délai. Il est désormais compilé pour ES2017. Si l’interface elle-même ne peut pas s’exécuter (il faut au minimum Chrome 107, Safari 16 ou Firefox 104), le dashboard l’indique avec le nom du navigateur au lieu de l’erreur de délai.
- **Page de diagnostic** : `/mp_glass_static/diagnostic.html`, à ouvrir sur l’appareil concerné, affiche sans console le navigateur, le téléchargement et la déclaration de la stratégie, et le chargement de l’interface ([dépannage](docs/TROUBLESHOOTING.md)).

## 0.7.4 — chargement fiable sur tablette et téléphone

Retour utilisateur : `Timeout waiting for strategy element ll-strategy-dashboard-mp-glass to be registered`, par moments, sur tablette et téléphone.

La stratégie était déjà déclarée par un bootstrap sans import, avant le chargement du bundle principal. L’erreur venait du moment où ce bootstrap est ajouté aux pages, et de la reprise après un échec réseau :

- Home Assistant sert les pages avant d’avoir chargé les intégrations personnalisées et n’ajoute le bootstrap qu’aux pages servies ensuite. MP Glass l’ajoutait à la fin de son démarrage, après la lecture de son schéma et de son projet : il l’ajoute désormais en tout premier, ce qui réduit fortement la période pendant laquelle une page ouverte au démarrage de Home Assistant n’a pas la stratégie.
- Changer les options de MP Glass recharge l’intégration : le bootstrap était retiré puis remis, et une page ouverte entre-temps affichait l’erreur. Il reste désormais en place ; il n’est retiré qu’à la suppression de l’intégration.
- Un échec de téléchargement du bundle principal (réseau qui revient après la veille, connexion lente) laissait le dashboard en erreur jusqu’au rechargement de la page. MP Glass réessaie seul, sous une nouvelle adresse, pendant une quinzaine de secondes.
- Pendant un démarrage ou un rechargement de l’intégration, le dashboard attend MP Glass (jusqu’à 20 s) au lieu d’échouer. Home Assistant garde son écran de chargement pendant ce temps.
- Diagnostic dans la console JS : `[MP Glass x.y.z] stratégie du dashboard enregistrée (… ms après l’ouverture de la page)`, puis `dashboard demandé par Home Assistant`. Leur absence sur un appareil indique que la page a été ouverte avant le chargement de MP Glass ([dépannage](docs/TROUBLESHOOTING.md)).

## 0.7.3 — pièces sous le plan

Demande utilisateur : toujours afficher les pièces sous le plan, sur une seule ligne.

- Sur grand écran, la liste des pièces quitte la colonne de droite, où elle s’étalait sur plusieurs lignes au-dessus de la fiche. Elle se place sous le plan, à sa largeur, et la fiche de la pièce ou du niveau remonte en haut de la colonne de droite. Sur téléphone, l’ordre ne change pas : plan, pièces, fiche.
- La liste reste sur une seule ligne quel que soit l’écran. Un fondu signale de chaque côté les pièces cachées ; à la souris, des flèches font défiler la liste, au doigt on la fait glisser. Une pièce choisie sur le plan est ramenée dans la partie visible de la liste.

## 0.7.2 — sans barre d’onglets

Demande utilisateur : retirer la barre de navigation affichée en bas de l’écran.

- Cette barre était celle des onglets de vues de Home Assistant (Accueil, Lumières, Pièces, une par pièce, Inventaire). Hormis l’accueil, toutes les vues du dashboard sont désormais des sous-vues : Home Assistant ne dessine plus sa barre d’onglets. On navigue avec l’en-tête MP Glass (Accueil, Lumières, Pièces). Sur une sous-vue, la flèche retour de Home Assistant ramène à la page précédente.
- L’Inventaire, qui n’était accessible que par cette barre, s’ouvre depuis une tuile à la fin de la page Pièces.

## 0.7.1 — halo plus doux

- Halo du plan 3D : diffusion plus douce, cœur légèrement éclairci et fondu progressif à proximité de chaque mur, y compris dans les pièces concaves. Le centre lumineux reste dans la pièce et la teinte uniforme du sol allumé est plus discrète.

## 0.7.0 — associations en un clic

Demande utilisateur : simplifier l’association des entités avec le dashboard et le plan. Une seule règle désormais : **chaque pièce du plan est reliée à une pièce Home Assistant, et ses équipements suivent**.

- **Équipements automatiques** : une pièce du plan reliée à une pièce Home Assistant affiche d’elle-même ses lumières, volets, thermostats, capteurs de température et d’humidité, ouvertures et présences (12 au maximum), recalculés à chaque ouverture du dashboard. Un équipement ajouté ensuite à la pièce Home Assistant apparaît sans passer par le Studio. Les entités de diagnostic et de réglage, l’énergie et les autres capteurs restent hors du plan.
- **Associer automatiquement** (Studio → Plan 3D → Pièces Home Assistant) : relie les pièces par leur nom, accents, abréviations des plans (SDB, CH., W.C., Dgt, Cuis., Séj.) et noms anglais compris, puis rapproche les pièces de même nature restées seules (« Séjour » et « Salon », « Entrée » et « Couloir »). Une pièce n’est reliée que si elle et la pièce Home Assistant sont chacune le seul choix de l’autre ; un niveau nommé comme un étage Home Assistant ne regarde que ses pièces. Les listes choisies à la main passent en automatique seulement si aucun équipement ne s’en retire. Chaque pièce non reliée propose aussi **Relier à « … »** d’un clic.
- **Import d’un niveau** : les pièces importées sont reliées de la même façon, après la reprise des pièces de même nom.
- **Un seul endroit pour les deux** : dans la fiche d’une pièce, chaque équipement peut être déplacé vers une autre pièce ou masqué, et **Ajouter un équipement** propose d’abord ceux qui n’ont pas de pièce. Ces choix sont ceux de la section Équipements : ils changent aussi les pages de pièce du dashboard, et s’affichent avant l’enregistrement.
- **Choisir à la main** fige la liste d’une pièce ; **Suivre la pièce Home Assistant** y revient. Les plans enregistrés gardent leurs listes, rien n’est retiré sans action.
- **Plan par défaut** : ses pièces suivent leur zone, capteurs compris ; aucune liste n’y est plus enregistrée.
- Toucher une pièce sur le plan 3D du Studio l’ouvre dans l’éditeur, placé désormais juste sous le plan.
- Studio → Équipements : la liste « À vérifier » inclut les volets, thermostats et capteurs du plan sans pièce, et une pièce choisie s’applique aussitôt.

## 0.6.1 — Studio utilisable en HTTP

Retour utilisateur : **Utiliser pour ce niveau** restait sans effet dans la fenêtre de résultat.

- Home Assistant ouvert en `http://` (adresse IP, `homeassistant.local`) n’est pas un contexte sécurisé : le navigateur n’y fournit pas `crypto.randomUUID`, utilisé pour identifier les pièces importées. Le clic échouait donc en silence. Les identifiants de pièces et de niveaux sont désormais tirés de `crypto.getRandomValues`, disponible partout.
- Même correction pour **Ajouter une pièce** et **Ajouter un niveau**, qui échouaient de la même façon en HTTP.

## 0.6.0 — précision du plan et ambiances interactives

- Zoom du plan d’origine de 100 à 800 % : boutons, molette centrée sous le pointeur, pincement, déplacement et retour à la vue entière. Les poignées restent à taille constante ; l’aimantation se désactive pour les corrections fines.
- Les corrections manuelles conservent leurs coordonnées et l’échelle de l’analyse. Le serveur n’aligne plus à nouveau les petits écarts après une retouche.
- Ajustement aux murs étendu aux contours concaves. Seuil de contraste adapté aux plans gris ; les fragments superposés d’un mur ne comptent plus plusieurs fois dans la détection. Consignes Gemini renforcées pour les décrochements, couloirs et limites ambiguës.
- Halos lumineux doux contenus dans les contours des pièces, intensité liée à la luminosité des éclairages associés.
- Mode Climat : températures sur le plan et halos selon une échelle commune. Capteur dédié prioritaire, thermostat en repli ; valeurs indisponibles exclues, conversion °F/°C pour les couleurs.
- Volets : symbole de tablier et pourcentage ouvert sur le plan, ouverture/arrêt/fermeture et réglage de position dans la fiche, selon les fonctions disponibles. Une position inconnue reste signalée comme inconnue.
- Associations par cases à cocher et recherche, 12 équipements maximum, capteur de température principal sélectionnable, associations indisponibles conservées. Volets inclus dans les plans par défaut.

## 0.5.0 — pièces en forme libre

Retour sur l’import réel : les zones rectangulaires ne suivent pas les pièces en L ni les découpes du plan.

- **Forme libre** : sur une pièce sélectionnée, un point à chaque angle du contour affiché. Glisser un point, ajouter un point avec le **+** au milieu d’un côté, retirer un point (double toucher, dépôt sur son voisin, **Supprimer le point** ou Suppr). **Rectangle** revient au rectangle.
- **Tracer un contour** : nouvelle pièce dessinée angle par angle ; fermer sur le premier point, par un double toucher ou **Terminer le contour** ; Retour arrière retire le dernier point.
- **Aimantation des points** : sur chaque axe, vers les murs du plan, les bords et angles des autres pièces et les points voisins, pour des côtés d’équerre sans précision au pixel.
- **Géométrie** : les contours aux côtés horizontaux et verticaux (L, T, U) partagent la grille de découpage des rectangles, sans chevauchement ; la boîte d’une pièce suit son contour.
- **Murs sur les petits plans** : l’image est agrandie jusqu’à 1 200 px avant la recherche des murs, pour trouver les murs de 2 px d’épaisseur (les traits fins restent ignorés).
- Barre d’outils de taille constante : le plan ne bouge plus sous le pointeur quand on change de mode ; noms placés dans la partie la plus large de chaque pièce.

## 0.4.2 — modèle choisi avant l’analyse

- Studio → Plan 3D : sélecteur **Modèle d’analyse** à côté du fichier et de la page, en mode direct : Gemini 3.8 Flash (le plus précis) ou Gemini 3.5 Flash-Lite (le plus rapide). Le réglage des options de l’intégration est présélectionné et signalé « réglage par défaut » ; le navigateur retient ensuite le dernier choix.
- **Réessayer avec** l’autre modèle, après une surcharge ou un quota, le laisse sélectionné pour les analyses suivantes.
- Un modèle personnalisé des options reste proposé en premier ; en mode add-on, le Studio indique que le modèle est celui de l’add-on.
- Option de l’intégration renommée « Modèle d’analyse des plans par défaut ».

## 0.4.1 — quota Gemini expliqué

Retour d’essai de la 0.4.0 : `HTTP 429 RESOURCE_EXHAUSTED You exceeded your current quota…`, détail coupé avant de dire quel quota était atteint.

- Le détail Google du quota est lu (quota par minute ou par jour, en requêtes ou en jetons, limite, modèle, délai conseillé) et affiché en une ligne courte au lieu du message tronqué.
- Quota du jour épuisé : la fenêtre d’échec donne l’heure locale de son renouvellement (minuit en Californie, par exemple « demain à 9 h ») et met en avant **Réessayer avec** l’autre modèle, qui a son propre quota. Toujours d’un clic, jamais automatiquement.
- Limite par minute : **Réessayer** décompte le délai conseillé par Google.
- Modèle sans quota gratuit dans le projet (limite 0) signalé comme tel.
- Lien **Voir vos quotas Gemini** vers la page de consommation de Google.

## 0.4.0 — pièces détectées modifiables

Retour sur l’import réel de la 0.3.1 (13 pièces, 136 m², 19 × 8,7 m) : bon résultat, mais des bords de pièces à côté des murs, sans moyen de les reprendre avant l’import.

- **Poignées** sur le plan d’origine, dans la fenêtre de résultat : déplacer une pièce, tirer ses bords ou ses coins ; les murs du plan attirent les bords.
- **Ajouter** une pièce en la traçant sur le plan, **supprimer** une pièce (bouton, touche Suppr ou liste), renommer, **Annuler** (30 étapes).
- **Détection affinée** : les murs dessinés (traits sombres, épais et longs, portes comprises) sont repérés dans le navigateur, et les bords des pièces proposés par Gemini sont posés sur leur axe dès la fin de l’analyse (réglage annulable).
- Chaque modification est recalculée par Home Assistant avec la géométrie de l’analyse, sans nouvel appel à Gemini ; l’échelle estimée est conservée pendant les retouches.
- Sur téléphone : poignées agrandies au doigt, un doigt sur une pièce la modifie, ailleurs la fenêtre défile.
- Mode add-on : pièces détectées transmises au Studio seulement si elles sont bien formées.

## 0.3.1 — Gemini surchargé

Premier essai de la 0.3.0 : `HTTP 503 UNAVAILABLE This model is currently experiencing high demand` (Gemini 3.8 Flash momentanément saturé).

- Surcharge ou panne de Google (HTTP 500, 503, 504 ; non facturée) : la même requête est renvoyée deux fois, après 4 puis 12 secondes. Le quota (429) n’est toujours jamais relancé.
- Si la surcharge persiste, la fenêtre d’échec nomme le modèle saturé et propose **Réessayer avec** l’autre modèle proposé (Gemini 3.5 Flash-Lite ou 3.8 Flash), pour cette analyse seulement ; le réglage des options ne change pas.
- La fenêtre d’analyse affiche le modèle utilisé.

## 0.3.0 — analyse du plan refondue

Les imports réels restaient approximatifs : Gemini devait écrire lui-même des coordonnées en mètres, ce que les modèles font mal.

- **Détection** : Gemini repère chaque pièce sur l’image avec une boîte normalisée 0–1000 (son format de détection d’objets), un contour pour les seules pièces non rectangulaires, le texte de la pièce et ses cotes écrites converties en mètres.
- **Géométrie calculée par MP Glass** : proportions tirées de la taille réelle de l’image (lue dans son en-tête), murs alignés, découpage sans chevauchement sur une grille (un placard dans une chambre la découpe en L), échelle tirée des cotes écrites (ordre largeur × profondeur vérifié) ou, à défaut, de la surface habituelle des pièces.
- **Gemini 3.8 Flash par défaut**, nettement meilleur en lecture de plan ; Gemini 3.5 Flash-Lite reste disponible (option « Modèle d’analyse des plans »), les deux au palier gratuit.
- **PDF dessiné dans le navigateur** (PDF.js, chargé à la demande) : seule la page choisie est envoyée, en image, sans métadonnées ; PDF protégé ou page absente signalés avant l’envoi.
- **Fenêtre de résultat** : pièces détectées superposées en couleur au plan analysé, onglet 3D, pièces renommables ou à écarter avant de les utiliser.
- **3D** : chaque mur dessiné une seule fois, murs extérieurs plus épais et plus lumineux que les cloisons.

## 0.2.7 — schéma accepté par Gemini, interface à jour après mise à jour

Deuxième import réel : plan bien plus fidèle (13 pièces nommées en français, échelle calculée à partir de 7 cotes), mais obtenu par la requête de secours — Gemini refusait encore la requête structurée — et affiché par une interface restée à une version antérieure.

- Schéma de réponse sans limites de longueur de tableau (les limites imbriquées font refuser le schéma) ; nombres de pièces, de sommets et de coordonnées toujours contrôlés localement.
- Repli en deux temps après un refus invalide : sans schéma de réponse mais avec la réflexion `medium`, puis seulement en dernier recours sans schéma ni réflexion approfondie. Le brouillon indique la forme utilisée.
- Pièces rectangulaires qui se chevauchent signalées dans le brouillon.
- Studio : si l’intégration a été mise à jour pendant que la page était ouverte, un bandeau propose de recharger la page (l’ancienne interface reste sinon en mémoire). La version du frontend vient de `package.json`.

## 0.2.6 — plans importés plus fidèles

Retour d’un premier import réel : plan coté en pieds rendu à 31 m² au lieu d’environ 150 m², pièces qui se chevauchent, noms restés en anglais, placards comptés comme pièces.

- Prompt Gemini réécrit : murs extérieurs d’abord, lecture des cotes écrites (pieds, pouces et mètres convertis), pièces rectangulaires jointives sans chevauchement, origine au coin du bâtiment, placards de moins de 1,5 m² rattachés à la pièce voisine, noms traduits en français, filigranes et mobilier ignorés.
- Réflexion du modèle au niveau `medium` pour Gemini 3 (minimal par défaut sur Flash-Lite).
- Vérifications locales : échelle recalculée à partir des cotes écrites de deux pièces ou plus quand elles concordent avec le dessin, murs distants de moins de 15 cm alignés, surface moyenne invraisemblable signalée dans le brouillon.

## 0.2.5 — import de plan fiabilisé, fenêtre d’analyse

- Import Gemini refusé avec `HTTP 400 INVALID_ARGUMENT` : la requête structurée revient à 32 768 jetons de sortie, et si Google la refuse comme invalide (refus ni traité ni facturé), elle est renvoyée une fois au même modèle, sans schéma de réponse imposé ; le résultat reste validé localement et le brouillon le signale. Un double refus pointe vers le document (PDF protégé, corrompu ou atypique) et conseille une image PNG ou JPEG.
- Détail technique enrichi des champs refusés quand Google les précise.
- Fenêtre d’analyse : étapes (préparation, envoi, analyse avec chronomètre), annulation réelle de l’analyse côté Home Assistant, puis fenêtre de résultat avec aperçu 3D du brouillon (pièces, surface, dimensions, avertissements, Utiliser / Ignorer) ou de l’échec (cause, détail, Réessayer). Quitter le Studio arrête l’analyse en cours au lieu de bloquer la suivante.

## 0.2.4 — dashboard créé à l’installation

- Le dashboard n’était pas créé après une installation par HACS : seul le Studio apparaissait. Le Studio ajoute désormais le dashboard **MP Glass** dans la barre latérale dès sa première ouverture (commandes WebSocket publiques de Home Assistant, administrateurs uniquement). Un dashboard MP Glass existant est réutilisé, quelle que soit son adresse ; en cas d’échec, le Studio indique la marche manuelle.
- Le bouton **Voir le dashboard** du Studio pointe vers le dashboard réel au lieu d’une adresse fixe.
- Le Studio s’appelle **MP Glass Studio** dans la barre latérale, pour ne plus se confondre avec le dashboard.

## 0.2.3 — plan 3D pensé pour le téléphone, Gemini 3.5 et mises à jour HACS

- Installation et mises à jour depuis HACS (dépôt personnalisé `Micpi/mp-glass`, catégorie Intégration) : chaque release GitHub apparaît comme mise à jour dans Home Assistant.
- Le plan ne capte un geste (doigt, souris, molette) que s’il commence sur la maison ; à côté, la page défile normalement. Fini le plan qui bloque le défilement sur téléphone.
- Commandes du plan réduites à une barre d’icônes flottante (zoom masqué sur écran tactile), niveaux en onglets, étiquettes de pièces compactes, indication d’usage discrète qui disparaît au premier geste.
- Fiche de pièce enrichie : caméra centrée sur la pièce, surface et dimensions, lumières allumées, température, humidité, Tout allumer / Tout éteindre, interrupteurs et variateurs, capteurs, thermostats, ouvertures et présence, accès à la fiche HA et à la page de la pièce.
- Liste des pièces toujours visible et vue d’ensemble du niveau ; pièces éclairées signalées dans la liste et dans la 3D. Fiche à droite du plan sur grand écran.
- Import Gemini : modèle par défaut `gemini-3.5-flash-lite`, `gemini-2.5-flash-lite` étant refusé aux nouveaux projets Google (HTTP 404). Température par défaut conservée pour Gemini 3 (Google déconseille de la baisser), budget de sortie porté à 65 536 jetons pour la réflexion du modèle, message d’erreur « modèle refusé » plus explicite.

## 0.2.2 — plan par défaut et import Gemini fiabilisé

- Plan par défaut : tant qu’aucun plan n’est enregistré, l’accueil affiche un plan 3D schématique généré depuis les pièces Home Assistant (un étage par niveau HA, une pièce par zone, lumières associées). Plan d’exemple si aucune pièce n’existe. Le Studio part de ce plan et propose d’y revenir.
- Schéma envoyé à Gemini limité aux mots-clés JSON Schema documentés (suppression de `minLength`/`maxLength`), sortie jusqu’à 32 768 jetons.
- Géométrie réparée au lieu d’un rejet global : sommets répétés, alignés ou de fermeture supprimés, contours croisés remplacés par leur enveloppe, contours inexploitables ignorés avec avertissement, coordonnées en pixels ou centimètres converties avec échelle à calibrer.
- Erreurs Google classées (clé refusée, région/facturation, surcharge, blocage, réponse tronquée, aucune pièce, Google injoignable) avec le détail technique de Google affiché dans le Studio et journalisé dans HA, sans document ni clé.
- Clé API nettoyée des espaces ; images réduites dans le navigateur (3 072 px) et formats décodables convertis avant envoi ; service d’import absent signalé comme mise à jour à terminer.

## 0.2.1 — installation Gemini simplifiée

- Mode Gemini direct par défaut : une clé API dans les options MP Glass, sans add-on, adresse serveur ni clé de liaison à configurer.
- Liens Configurer Gemini / Obtenir une clé API dans le Studio. Information explicite sur l’envoi du fichier complet.
- PDF et images envoyés directement au fournisseur, avec limites de taille et validation du résultat ; aucun décodeur ajouté à HA Core.
- Mode add-on conservé en configuration avancée, sélection existante préservée. Contrat Gemini partagé et testé entre les deux modes.

## 0.2.0 — développement local, 14 septembre 2026

- MP Spatial : plan 3D Three.js chargé à la demande, murs transparents, rotation, zoom, déplacement, vue de dessus et niveaux.
- Studio Plan 3D : import PDF/image, brouillon IA distinct du projet, calibration, édition des sommets, pièces, niveaux et associations Home Assistant.
- Add-on optionnel Gemini Flash-Lite : conversion isolée, API avec clé de liaison, limites de taille/temps, validation de géométrie et erreurs de quota sans relance.
- Import et sauvegarde réservés aux administrateurs. Aucun secret ni fichier source dans le projet ou les assets publics.
- États et commandes des lumières avec la session Home Assistant courante.
- Tests locaux du moteur, PDF/image, worker et navigateur. Installation Supervisor et appel Gemini réel restant à valider.

## 0.1.0 — unreleased

- Architecture, modèle de graphe, capabilities, schéma projet et ADR initiaux.
- Premier parcours lumière : registres HA → graph → résolution → strategy → carte → service natif.
- Backend Config Flow/Options Flow, projet validé, contrôle de concurrence, diagnostic minimal.
- Carte lumière POWER/DIM, fallback, editor graphique, panneau intégrateur et six presets.
- Navigation fonctionnelle Accueil, Lumières, Pièces et pages de pièce générées automatiquement.
- MP Glass Studio avec personnalisation de l'identité, du verre, du fond, de la disposition, du contenu, de la navigation et des équipements, plus aperçu direct.
- Migration explicite du schéma projet v1 vers v2 et conservation des overrides.
- Compatibilité du custom panel Home Assistant renforcée contre le conflit de propriété `panel`.
- Tests du core, fixture navigateur, screenshots multi-format et procédure HA isolée.

Cette version de développement n'est pas une release HACS validée. Porte réelle HA et validation distante de publication consignées dans `docs/VALIDATION.md`.
