# Changelog

## 0.19.0 — MP Nexus v2 (aperçu), étape 4 : Plus

- Plus est réorganisé en groupes : la maison (routines, énergie, extérieur, accès, historique), le confort (climat, ouvrants), les alertes et la recherche, puis ce qui est propre à cet écran.
- Routines « Si… alors… » : la liste des automatisations de Home Assistant avec leur interrupteur, et « Nouvelle » pour en créer une en trois choix. Quand (une porte ou fenêtre s’ouvre, le coucher du soleil, quelqu’un arrive, une heure), alors (couper le chauffage, allumer des lumières, fermer les volets, envoyer une notification, lancer une scène), dans quelles pièces. La phrase résume la routine avant de l’enregistrer. Elle devient une automatisation ordinaire de Home Assistant, modifiable ensuite dans Home Assistant (réservé aux administrateurs).
- Énergie : la puissance consommée en ce moment et l’énergie comptée, par capteur, avec un lien vers le tableau Énergie de Home Assistant.
- Extérieur & arrosage : la météo (traduite), le lever et le coucher du soleil, les vannes et zones d’arrosage avec leur interrupteur.
- Accès & caméras : les caméras, les serrures (Verrouiller, Déverrouiller), les portes de garage et portails (Ouvrir, Fermer) et l’alarme.
- Historique : ce qui s’est passé ces dernières 24 heures sur les appareils du tableau de bord et du plan.
- Sauvegarde & partage : exporter la configuration MP Nexus dans un fichier, la restaurer, ou la partager comme modèle sans données privées (ni appareils, ni zones, ni photos, ni nom de la maison).
- Écran de veille : photos, plan 3D ou horloge, avec l’heure, la météo, un minuteur, la musique, les alertes et qui est là. Il démarre après 1 à 30 minutes sans toucher l’écran, s’assombrit la nuit, et peut se réveiller à l’approche avec un capteur de présence. « Aperçu » le montre tout de suite. Réglé pour chaque écran.
- La météo est traduite partout (Ensoleillé, Nuageux, Pluie…), et l’état des vannes aussi.

## 0.18.0 — MP Nexus v2 (aperçu), étape 3 : qui est là, recherche, alertes, confort

- Qui est à la maison : les visages des personnes présentes dans l’en-tête de l’accueil, et sur grand écran « À la maison » avec chacun (présent ou absent) dans « En ce moment ». Se désactive dans Plus → Sur cet écran.
- Recherche : une loupe dans l’en-tête trouve les pièces, les appareils (avec leur interrupteur) et propose « Éteindre : pièce ». Sans accents ni majuscules nécessaires.
- Voix et Assist : le micro dicte la demande (dans les navigateurs qui le permettent) et l’envoie à Assist de Home Assistant ; une question tapée part avec Entrée. La réponse d’Assist s’affiche.
- Centre d’alertes : une cloche avec le nombre d’alertes à voir, regroupées en Alarmes (fumée, gaz, fuite…), Sécurité (portes et fenêtres ouvertes, serrures ouvertes), Maison (batteries faibles, chauffage ou clim en marche avec une fenêtre ouverte dans la pièce, avec « Couper ») et Infos (mises à jour). « Tout marquer comme lu » ; une alerte revient si l’événement se reproduit.
- Nuit silencieuse : de 23:00 à 7:00, seules les alarmes comptent ; un badge le rappelle sur l’accueil.
- Mode confort : texte plus grand et contraste renforcé.
- Ces choix sont propres à chaque écran : une tablette murale et un téléphone peuvent choisir différemment.

## 0.17.0 — MP Nexus v2 (aperçu), étape 2 : multimédia, climat et volets

- Multimédia en quatre onglets : Lecture, Pour vous, Pièces et Télécommande.
- Lecture : grande pochette, titre et artiste, progression avec les durées (toucher la barre pour avancer quand le lecteur le permet), aléatoire, répétition, volume avec coupure du son et mode sonore. « À suivre » s’affiche avec Music Assistant.
- Pour vous : les sources du lecteur (applis et entrées pour un téléviseur) et sa bibliothèque Home Assistant à parcourir (favoris, radios, listes de lecture), lancée d’un toucher.
- Pièces : tous les lecteurs avec leur volume ; « Jouer ensemble » regroupe les enceintes qui le permettent (Sonos, Music Assistant…) ; « Tout mettre en pause ». Le titre de la page indique les pièces qui jouent ensemble, par exemple « Salon + Cuisine ».
- Télécommande du téléviseur : pavé directionnel et OK, Retour, Accueil, Menu, volume, chaînes, lecture et marche/arrêt. Les touches fléchées passent par Apple TV, Android TV, Roku, Samsung, LG webOS, Philips et Sony.
- Climat : toucher un thermostat ouvre son panneau avec le cadran de consigne, les boutons − et +, la mesure de la pièce, les modes, la ventilation et les préréglages traduits. Sur iPhone, le plan zoome sur la pièce avec le calque Climat. Les thermostats à plage (minimum et maximum) sont pris en charge.
- Ouvrants : un panneau avec chaque volet, store et rideau pièce par pièce, une barre pour le régler, Ouvrir, Stop et Fermer, plus « Tout ouvrir », « Mi-ombre » et « Tout fermer ». Il s’ouvre depuis « Voir tout » sur une pièce, ou depuis Plus pour toute la maison.
- Sur tablette et ordinateur, le climat et les ouvrants s’ouvrent dans le panneau de droite à la place du plan, et la touche Échap les referme.

## 0.16.0 — MP Nexus v2 (aperçu), étape 1

- Nouvelle interface MP Nexus v2, à activer dans le Studio (Interface → v2, ou le sélecteur v1/v2 en haut du Studio). La v1 reste l’interface par défaut et on peut y revenir à tout moment ; réglages, plan et équipements sont communs aux deux versions.
- Une seule application sur tous les écrans : iPhone avec barre d’onglets en bas, tablette en portrait (page en haut, carte en dessous), tablette en paysage (rail à gauche, page et panneau côte à côte), ordinateur (onglets dans l’en-tête).
- Cinq onglets : Accueil, Lumières, Pièces, Multimédia et Plus.
- Le plan 3D au centre et sans fond laiteux : la maison flotte sur la photo, avec ses calques Lumières, Climat, Ouvrants et Médias. Sur tablette et ordinateur, le plan reste visible dans un panneau à droite de chaque page.
- Toucher une pièce du plan zoome dessus et ouvre sa carte (feuille en bas sur iPhone) avec ses équipements, « Tout éteindre » et « Ouvrir la pièce ».
- Plan 3D en plein écran, avec niveaux, zoom sur la pièce et carte flottante.
- Accueil : résumé (lumières allumées, température, ouvrants, lecture en cours), scènes Home Assistant, et sur grand écran « En ce moment » (lecture, chauffage ou climatisation en marche, ouvertures, météo).
- Lumières regroupées par pièce avec interrupteur de pièce et « Tout éteindre » ; Pièces avec badges d’état et filtre par niveau ; page de pièce avec zoom du plan, ouvrants (Ouvrir, Mi-ombre, Fermer) et « Quitter la pièce » ; Multimédia avec lecteur, volume, source et liste des lecteurs ; Plus avec langue, Studio, informations et autres équipements.
- Un toucher allume, éteint, ouvre ou lance ; un appui long ou le bouton « … » ouvre la fenêtre de détails MP Nexus.
- Traductions anglais, russe, allemand et italien.

## 0.15.22 — Drapeaux de langue sur le portail de démonstration

- Remplace le menu déroulant textuel des pages de connexion et de sélection par le sélecteur compact à drapeau déjà utilisé dans l’interface MP Nexus.
- Affiche les drapeaux français, britannique, allemand, italien et russe dans un menu accessible avec le nom natif de chaque langue.
- Conserve le choix de langue, avec fermeture du menu au clic extérieur et à la touche Échap.
- Vérifie les drapeaux et le changement de langue sur la connexion et la sélection des démos.

## 0.15.21 — Allemand, italien et langues du portail

- Ajoute un sélecteur de langue sur la connexion et le choix de démonstration : français, anglais, allemand, italien et russe.
- Suit la langue du navigateur au premier passage, conserve ensuite le choix localement, et traduit les messages d’identifiants incorrects.
- Traduit le tableau de bord, les fenêtres de détails d’équipement et les commandes courantes du plan 3D en allemand et en italien ; Home Assistant reconnaît ces langues et les affiche dans son menu.
- Les modules Studio et éditeur dont les textes ne disposent pas encore d’une traduction allemande ou italienne utilisent l’anglais.
- Vérifie les catalogues, les variantes singulier/pluriel, le portail et le menu de langue dans le navigateur.

## 0.15.20 — Mise en valeur d’ICM

- Renforce la présence d’ICM sur la page de connexion avec un logo agrandi, le nom complet « Integrated Components for Media » et une mention dédiée à l’intégration et au déploiement.
- Retire de cette page la mention de MP Programming, sans modifier l’identité MP Nexus ni le parcours de connexion.
- Vérifie le nouveau message, le formulaire et le chargement du logo dans le navigateur.

## 0.15.19 — Identité ICM sur la page de connexion

- Présente le logo ICM et précise que l’entreprise déploie l’interface de démonstration.
- Affiche explicitement que MP Nexus reste la propriété de MP Programming, sans déplacer la marque MP Nexus ni modifier le parcours de connexion.
- Sert le logo depuis les ressources publiques de la page d’accès afin qu’il soit visible avant l’authentification.
- Vérifie le rendu de la page d’accès, les deux identités de marque et le chargement du logo.

## 0.15.18 — Démonstration de bureaux enrichie

- Agrandit nettement l’étage de bureaux et le structure en onze espaces : direction, salles de réunion et de formation, open space, bureaux spécialisés, détente, archives et informatique.
- Étoffe le rez-de-chaussée avec l’accueil, une boutique, la réserve, un espace de pause, des sanitaires, un local de service et un quai de livraison.
- Ajoute 28 stores, volets roulants et un rideau métallique, répartis sur des ouvertures du plan avec des positions et inclinaisons de démonstration variées.
- Complète les pièces avec leurs éclairages, thermostats, capteurs et écrans de démonstration ; conserve le fond professionnel déjà créé.
- Vérifie les deux niveaux, la taille du plan, les ouvertures et le parcours bureau dans le navigateur.

## 0.15.17 — Fonds adaptés aux démos professionnelles et yacht

- Ajoute un fond photographique dédié au scénario Bureau & magasin, avec un intérieur professionnel contemporain.
- Ajoute un fond dédié au scénario Yacht, avec un salon nautique ouvert sur la mer.
- Limite ces fonds aux scénarios correspondants et conserve le fond habituel de la démo résidentielle.
- Vérifie dans le navigateur que chaque scénario charge son image et que les ressources sont disponibles.

## 0.15.16 — Équipements placés contre les cloisons

- Place le lave-linge et le sèche-linge superposé le long d’une cloison de la buanderie du yacht, avec leur façade tournée vers l’intérieur.
- Replace les téléviseurs des salons principal et panoramique près de leur cloison, au lieu du centre des pièces.
- Vérifie que machines et téléviseurs restent dans leur pièce et au contact visuel d’un mur dans le plan 3D.

## 0.15.15 — Rétablissement de l’interface originale de la démo

- Rétablit la démo yacht dans l’interface MP Nexus existante, avec sa navigation Accueil, Lumières, Pièces et Info, son fond, son plan 3D et ses panneaux d’équipements.
- Supprime la page Explorer 37 et son interface de plan aménagé, introduites en 0.15.14 ; le scénario ne remplace plus la vue commune par une page dédiée.
- Conserve uniquement les améliorations du plan : coque affinée, quatre ponts, coursive longitudinale, placement corrigé des hublots et noms nautiques anglais des pièces, niveaux et équipements.
- Rétablit la langue habituelle de l’interface et la présentation originale de la fiche yacht du portail, avec l’indication correcte des quatre ponts.
- Vérifie le retour de la navigation et du plan d’origine sur ordinateur et téléphone, ainsi que l’accès aux informations des pièces.

## 0.15.14 — Démonstration yacht Explorer 37

- Ajoute une présentation dédiée au yacht dans la démo : silhouette de profil, finitions marine et laiton, choix des quatre ponts et vue de plan aménagé affichée à l’ouverture.
- Dessine un aménagement original avec mobilier, lits, cuisine, tables et fauteuils, jacuzzi, moteurs et annexe ; les équipements et le mobilier restent contenus dans leur pièce et la coque.
- Affine les proportions à 37,5 × 8,1 m, organise une coursive longitudinale au pont inférieur et replace les hublots et l’accès arrière sur les parois correspondantes.
- Utilise les noms nautiques anglais pour les quatre ponts, les pièces et les équipements : Lower Deck, Main Deck, Upper Deck, Sun Deck, Bridge, Skylounge, Owner’s Suite, Tender Garage et Engine Room.
- Rend les pièces du dessin et de la liste sélectionnables pour consulter les états et commander éclairage, température, stores et multimédia ; garde l’accès au rendu 3D et à ses équipements interactifs.
- Adapte les plans et commandes aux téléphones et tablettes, avec défilement du dessin sans débordement de la page ; met à jour la fiche yacht du portail pour annoncer quatre ponts.
- Vérifie les commandes sur ordinateur, le parcours mobile, les quatre ponts, la géométrie et le scénario bureau ; reconstruit la démo Docker et les bundles HACS.

## 0.15.13 — Aménagement yacht sur quatre ponts

- Redessine le scénario yacht de la démo comme un plan d’ensemble nautique : coque longue à proue effilée, plateforme arrière et quatre ponts distincts.
- Aménage les ponts avec des espaces cohérents : garage à annexe, salle des machines, buanderie, cabines bâbord et tribord, carré, timonerie, terrasse et pont soleil avec jacuzzi.
- Ajoute des états interactifs de démonstration pour le bimini, le jacuzzi, le garage et la salle des machines ; conserve les commandes et équipements propres à chaque pièce.
- Étend les tests du plan et du navigateur aux quatre ponts et à leurs espaces.
- Le dessin reste un plan schématique original inspiré de la présentation générale fournie, pas une reproduction du plan constructeur.

## 0.15.12 — Plans de démonstration professionnels

- Donne au yacht une silhouette de coque reconnaissable sur le pont principal et le pont inférieur, avec une étrave resserrée et des formes de poupe arrondies.
- Organise le yacht en espaces nautiques : timonerie, office, carré, cockpit, cabines bâbord et tribord, coursive, salle d’eau, compartiment moteur et lingerie technique.
- Replace le lave-linge et le sèche-linge superposé dans le local technique du pont inférieur ; chaque cabine dispose de ses propres équipements de démonstration.
- Harmonise les noms des pièces et équipements nautiques et ajoute un test navigateur du parcours sur les deux ponts ainsi que des tests de géométrie du plan.
- Vérifications : tests TypeScript et navigateur des plans, construction du bundle de démo et construction HACS.

## 0.15.11 — Connexion au portail de démonstration réparée

- Corrige le retour silencieux au formulaire après une connexion réussie : le bouton de déconnexion était recherché dans le contenu principal alors qu’il se trouve dans l’en-tête. L’erreur JavaScript empêchait l’affichage des trois univers et de l’administration.
- Seule une session absente ou expirée réaffiche désormais la connexion. Les autres erreurs de chargement affichent un message et un bouton Réessayer, au lieu de masquer la panne.
- Ajoute trois tests navigateur couvrant connexion et choix des univers puis déconnexion, accès administrateur à la gestion des utilisateurs, et erreur du serveur. Ces trois tests reproduisent les échecs avant correction et passent après correction.

## 0.15.10 — Mise à jour Synology fiable et diagnostic du service

- Fixe explicitement le nom du projet Compose `mp-nexus-demo` et laisse Compose générer le nom du conteneur, afin que Container Manager suive un conteneur stable au lieu d’une ancienne référence incohérente.
- Ajoute un contrôle de santé HTTP visible dans Container Manager et un script `deploy/synology/update.sh` qui valide Compose, télécharge l’image, recrée le conteneur, supprime les orphelins de ce projet et affiche son état.
- Le volume persistant porte désormais le nom fixe `mp-nexus-demo-data`, indépendamment du nom de dossier choisi dans DSM.
- Remplace dans l’administration la procédure ambiguë « télécharger puis recréer » par le script de mise à jour ; documente l’installation et la planification quotidienne sur Synology.
- Vérifications : `npm run check`, `npm run build:demo` et validation Compose réussis. Compilation .NET indisponible sur le poste, qui ne dispose que du SDK 9 alors que le lanceur cible .NET 10.

## 0.15.9 — Afficher le choix des démos après connexion

- Une ouverture directe de l’adresse du plan redirige désormais vers le portail après connexion, afin que l’utilisateur choisisse d’abord Résidentiel, Bureau / magasin ou Yacht.
- Les liens directs vers les pages d’administration restent préservés pour les administrateurs.
- Vérifications : build HACS, build démo, vérification TypeScript, compilation .NET et configuration Compose.

## 0.15.8 — Trois univers pour la démo Synology

- Après connexion, chaque utilisateur choisit une démo **Résidentiel**, **Bureau / magasin** ou **Yacht**. Chaque choix ouvre un plan 3D adapté, avec des états fictifs interactifs.
- Les trois scénarios montrent toutes les catégories : éclairages, ouvrants et stores, chauffage/climatisation, température et humidité, médias, capteurs de présence et buanderie avec lave-linge et sèche-linge. Le yacht présente deux ponts et des machines superposées ; le scénario professionnel sépare boutique, accueil, lingerie et bureaux.
- Le menu administrateur mène directement à **Utilisateurs**. Cette page explique la création d’un compte individuel, le rôle, le mot de passe provisoire et le changement obligatoire à la première connexion. Le guide Synology reprend les étapes.
- Vérifications : build démo, vérification TypeScript, build HACS, compilation .NET et configuration Compose.

## 0.15.7 — Comptes utilisateurs et espace administrateur Synology

- Ajoute un portail de connexion pour la démo Synology avec rôles administrateur/utilisateur, comptes individuels, mots de passe temporaires à renouveler, révocation des sessions et gestion des comptes depuis l’administration.
- Ajoute des statistiques par compte : connexions, ouvertures du plan, activité sur 14 jours et durée approximative sur 30 jours. Les statistiques expirent après 180 jours ; aucune IP ou localisation n’est enregistrée.
- Protège les pages et fichiers de la démo par authentification, ajoute une barre discrète de session dans le plan et fournit un QR code utilisable sur téléphone et tablette.
- Persiste les comptes et les clés de session dans un volume Compose. L’admin affiche la version installée et les étapes de mise à jour dans Synology Container Manager, sans accès Docker depuis l’application.
- Publie la version dans l’image GHCR via un argument de build et documente la création du premier admin et les comptes utilisateurs.
- Vérifications : `npm run build`, `npm run build:demo`, compilation .NET et validation Compose à consigner après exécution.

## 0.15.6 — Publication multi-architecture simplifiée

- Construit le frontend et le serveur .NET sur l’architecture native du runner, puis assemble des images Synology `linux/amd64` et `linux/arm64` à partir des runtimes correspondants. Cela évite d’émuler Node et .NET pour ARM.
- Publie l’image `latest`, la version de `package.json` et le SHA depuis le seul événement de mise à jour de `main`, évitant un second build lors de la création de la release.
- Vérifications : à compléter après publication.

## 0.15.5 — Correctif de construction Docker Synology

- Désactive explicitement la publication en fichier unique pour le conteneur Linux, qui utilise le runtime .NET partagé, tout en conservant les applications desktop autonomes.
- Utilise la propriété .NET 10 actuelle pour configurer les proxies transférés et supprime l’avertissement de compilation.
- Vérifications : à compléter après reconstruction et publication.

## 0.15.4 — Démo Synology avec Docker

- Ajoute une image Docker multi-architecture (`linux/amd64` et `linux/arm64`) pour exécuter le plan 3D de démonstration sur Synology Container Manager, sans Home Assistant ni installation de Node.js sur le NAS.
- Publie l’image privée `ghcr.io/micpi/mp-glass-demo:latest` à chaque mise à jour de `main`, et une image étiquetée à chaque release.
- Ajoute des fichiers Compose Synology et Cloudflare Tunnel, plus un guide d’installation et d’accès distant. Le tunnel permet d’utiliser un nom de domaine sans redirection de port entrante ; une politique Cloudflare Access peut demander une connexion.
- Le QR code reprend l’hôte et le protocole d’origine transmis par un proxy. La page serveur indique l’adresse utilisée et ne propose pas l’arrêt du conteneur.
- Passe le lanceur de .NET 8 à .NET 10 LTS pour s’aligner sur la version prise en charge jusqu’en novembre 2028.
- Vérifications : `npm run build`, `npm run build:demo`, publication locale du serveur .NET 8 avant le passage ciblé à .NET 10, validation des deux fichiers Compose et `git diff --check`. La compilation locale .NET 10 et la construction Docker restent à confirmer : le SDK .NET 10 n’est pas installé et le moteur Docker Desktop n’était pas démarré. Les workflows GitHub construiront les applications et les images après publication.

## 0.15.3 — Application portable et accès mobile par QR code

- Remplace le lanceur Windows dépendant du dossier source et de Node.js par une application autonome qui intègre le serveur .NET, la fixture de démonstration et toutes ses dépendances. Le téléchargement tient dans un seul `.exe` ; aucun compte Home Assistant n’est nécessaire pour voir le plan de démonstration.
- Ajoute une application `.app` empaquetée pour Mac Apple Silicon et Mac Intel. Les binaires Windows et Mac sont construits automatiquement et joints à chaque nouvelle release.
- Au lancement, ouvre une page claire avec le plan 3D et un QR code généré localement. Un téléphone ou une tablette sur le même Wi-Fi ouvre directement `/?spatial&floors&laundry`. La page permet aussi d’arrêter le serveur.
- Le serveur choisit un port libre et n’écoute que sur l’ordinateur et son adresse IPv4 privée ; il ne contacte aucun service externe pour créer le QR.
- Précise dans les guides d’installation que le dépôt est privé, que HACS ne peut temporairement plus le mettre à jour et comment installer depuis l’archive d’une release.
- Vérifications : compilation de la fixture, contrôle TypeScript, publication autonome Windows, vérification HTTP de la page d’accueil, des assets, du plan et du QR, contrôle visuel du QR carré, et arrêt authentifié du serveur ; reconstruction du bundle HACS. Les binaires macOS sont empaquetés par le workflow GitHub sur les runners Apple Silicon et Intel ; ils ne sont pas signés/notariés faute de secrets Apple Developer.

## 0.15.2 — Lanceur Windows du plan 3D local

- Ajoute `Lancer MP Nexus.exe` à la racine du projet : un double-clic démarre la fixture Vite sur le port 5173 et ouvre directement `http://localhost:5173/?spatial&floors&laundry` dans le navigateur par défaut.
- Le lanceur vérifie la présence de Node.js, installe les dépendances avec `npm ci` si nécessaire, attend que MP Nexus réponde, puis affiche les commandes « Ouvrir le plan » et « Arrêter ». La fermeture du lanceur arrête le serveur qu’il a démarré. Si un serveur MP Nexus répond déjà sur ce port, il ouvre simplement le plan.
- Ajoute le code source C# et un script PowerShell pour reconstruire l’exécutable sous Windows avec le compilateur .NET Framework fourni par le système.
- Vérifications : compilation de l’exécutable, ouverture du serveur depuis le lanceur Windows, réponse HTTP du port 5173, fermeture du lanceur et arrêt du serveur, reconstruction du bundle HACS.

## 0.15.1 — Infobulles du plan plus directes

- Dans une infobulle du plan 3D (Climat, Lumières, Ouvrants, Audio-vidéo), toucher un équipement de la liste ouvre directement sa fenêtre de détail, sans passer par un résumé intermédiaire et son bouton « Détails ». La liste reste ouverte derrière la fenêtre, pour passer d’un équipement à l’autre.
- Même chose pour un équipement touché directement sur le plan 3D (lampe, porte, fenêtre, téléviseur, enceinte) : sa fenêtre de détail s’ouvre aussitôt. Les lave-linge et sèche-linge gardent leur infobulle, qui suit le cycle en cours.
- La croix de fermeture des infobulles est redessinée : une icône fine dans un bouton rond et discret, éclairé au survol et au focus clavier.
- Vérifications : lint, TypeScript, suite frontend, tests navigateur du plan (aucun nouvel échec ; les 9 échecs connus du plan et les 6 captures de la carte lumière échouaient déjà avant ce changement), contrôle dans le navigateur de l’ouverture directe depuis l’infobulle Climat.

## 0.15.0 — Plan de masse du domaine importé d’un DXF

- Studio → Plan 3D : nouveau bloc « Plan de masse du domaine » pour importer un fichier DXF (AutoCAD, BricsCAD…). Le fichier est lu dans le navigateur, sans service externe : calques, lignes, polylignes avec arcs, cercles, splines, hachures et textes de l’espace objet.
- Une fenêtre liste les calques du dessin avec leur nombre d’éléments et propose d’office ceux qui décrivent le site : limites et clôtures, allées et voiries, bâtiments, piscines, terrains de sport, ruisseaux, pelouses, murs. La végétation, les cotes, les points topographiques et les équipements (éclairage, audio, caméras, arrosage, réseaux) restent décochés, pour un import ultérieur. Chaque calque peut être coché ou décoché et son type changé, avec un aperçu immédiat.
- L’unité du dessin est vérifiée (un DXF déclaré en millimètres mais dessiné en mètres est reconnu) et peut être corrigée. Les éléments perdus loin du domaine sont ignorés, et le plan est simplifié pour rester léger (40 000 points au plus ; environ 12 500 points et 144 Ko pour le domaine de Saint-Jaume).
- Chaque maison se place sur le plan de masse d’un simple toucher. Si un contour de bâtiment entoure ce point, il est repris et mis en surbrillance.
- Accueil : un onglet « Domaine » montre le plan de masse, nord en haut, avec un repère par maison et ses lumières allumées ; toucher un repère ouvre le plan 3D de la maison. Le plan se déplace au doigt ou à la souris, et se zoome au pincement, avec Ctrl + molette ou avec les boutons.
- Le plan de masse et l’emplacement des maisons sont validés par le navigateur et par Home Assistant avant enregistrement ; les plans sans plan de masse ne changent pas.
- Vérifications : tests du lecteur DXF (arcs de polylignes, hachures, splines, textes, encodages, DXF binaire refusé), de la construction du plan de masse (unité, éléments éloignés, simplification, contour des bâtiments) et de sa validation côté navigateur et côté Home Assistant ; lint, TypeScript, suites frontend et Python, reconstruction du bundle HACS ; import du DXF réel du domaine dans le Studio, placement de deux maisons et affichage de l’onglet Domaine sur ordinateur et sur mobile.

## 0.14.0 — Plusieurs maisons sur un même domaine

- Le plan 3D gère désormais un domaine de plusieurs maisons (maison principale, maison d’amis, pool house…). Chaque maison a ses propres niveaux et pièces ; une seule instance Home Assistant pilote l’ensemble.
- Accueil : quand le plan compte au moins deux maisons, des onglets au-dessus du plan permettent de passer de l’une à l’autre, avec le nombre de lumières allumées dans chaque maison. Le plan, sa vue d’ensemble et la section des équipements en dessous ne montrent que la maison choisie ; le choix est retenu dans le navigateur, et chaque maison garde sa propre vue enregistrée.
- Studio → Plan 3D : nouveau bloc « Maisons du domaine » pour ajouter une maison (créée avec un premier niveau à dessiner ou à importer), la renommer, changer son ordre ou la supprimer après confirmation. Chaque niveau est rattaché à la main à sa maison avec « Maison du niveau » ; la liste des niveaux et l’aperçu 3D suivent la maison modifiée. Un plan importé par Gemini garde la maison du niveau qu’il remplace.
- Les plans existants ne changent pas : sans maison déclarée, le plan reste une maison unique et l’interface est identique. La première maison ajoutée transforme le plan en domaine, ses niveaux devenant la « Maison principale ».
- Limites : 12 maisons, 8 niveaux par maison et 32 niveaux en tout, vérifiés dans le navigateur et par Home Assistant avant enregistrement.
- Vérifications : tests des maisons (répartition des niveaux, maison inconnue ou dupliquée, limites) côté navigateur et côté Home Assistant, lint, TypeScript, suites frontend et Python, reconstruction du bundle HACS, et contrôle dans le navigateur de l’accueil (bureau et mobile) et du Studio.

## 0.13.17 — Logo de l’intégration dans HACS et Home Assistant

- Ajoute le logo MP Nexus dans `custom_components/mp_glass/brand/` : HACS le détecte comme icône de l’intégration, et Home Assistant l’affiche dans ses écrans d’intégration.
- Vérifications : cohérence des versions, TypeScript et reconstruction du bundle HACS.

## 0.13.16 — Icônes des pièces mieux centrées

- Centre les icônes d’équipement dans leur bouton circulaire du plan, avec un alignement indépendant des styles génériques de boutons et de ligne de Home Assistant.
- Vérifications : lint, TypeScript, suite frontend et reconstruction du bundle HACS.

## 0.13.15 — Monogramme de site personnalisable

- Le logo du dashboard reprend automatiquement les initiales du nom de la maison ; « Saint Jaume II » affiche « SJ ».
- Le champ « Monogramme du logo » dans MP Nexus Studio → Identité permet de choisir jusqu’à quatre caractères. Le nouvel emblème à empattements, couleur accent, apparaît aussi dans l’aperçu en direct.
- Le réglage est enregistré avec chaque projet et conservé lors des modifications et des détections d’équipements.
- Vérifications : contrat du schéma, initiales de Saint Jaume, lint, TypeScript, suite frontend et reconstruction du bundle HACS.

## 0.13.14 — Studio du plan 3D plus lisible

- Le bloc « Générer depuis un plan · Gemini » est replié dès qu’un plan existe, pour ne plus occuper le haut de la page ; il reste ouvert tant qu’il n’y a pas de plan ou qu’un fichier est choisi.
- Sur grand écran, le plan 3D reste visible à gauche pendant que l’édition de la pièce (nom, liaison Home Assistant, équipements, ouvertures) s’affiche à droite : plus besoin de faire défiler la page pour voir l’effet d’un réglage.
- L’échelle du niveau, réglage rarement utile, est rangée dans une section « Changer l’échelle du niveau ».
- Vérifications : lint, TypeScript, suite frontend et reconstruction du bundle.

## 0.13.13 — Couleurs des icônes selon le mode Climat actif

- La petite icône Climat de chaque pièce indique le mode en fonctionnement : flamme orange pour le chauffage, flocon cyan pour le refroidissement, ventilateur vert pour la ventilation, goutte violette pour la déshumidification et thermomètre ambre pour l’automatique.
- La couleur et le symbole sont repris dans la liste de la pièce et dans le résumé individuel, avec une mise à jour en direct. La couleur reste visible au survol et au focus clavier.
- L’action réelle rapportée par Home Assistant est prioritaire : un thermostat automatique qui chauffe devient orange, et devient cyan lorsqu’il refroidit. Les équipements arrêtés, indisponibles, en attente ou dont l’action est inconnue restent neutres. Sans information d’action, le mode activé fourni par l’intégration sert de référence.
- Une pièce conserve une icône active même si son premier thermostat est au repos. Plusieurs modes différents actifs simultanément sont représentés par un thermomètre rose et un libellé explicite ; chaque appareil garde sa couleur dans la liste.
- Vérifications visuelles du chauffage et de la climatisation, tests des modes actifs, états neutres et pièces avec plusieurs thermostats, lint, TypeScript, suite frontend et reconstruction du bundle HACS.

## 0.13.12 — Icônes discrètes pour toutes les catégories du plan

- Les catégories Ouvrants, Audio-vidéo et Buanderie adoptent la même petite icône intégrée à l’étiquette de la pièce que les lumières et le climat. Une seule icône suffit, quel que soit le nombre d’équipements.
- Un clic ouvre la collection de la pièce : portes et fenêtres avec leurs capteurs et protections, téléviseurs et enceintes, lave-linge et sèche-linge. Chaque ligne présente les états utiles et ouvre le résumé individuel, avec retour à la catégorie et accès à la fiche détaillée.
- Les capteurs d’un même équipement placé sont regroupés : une fenêtre avec ses volets ne produit pas de lignes en double, et chaque machine reste une seule entrée même lorsqu’elle dispose de plusieurs capteurs. Les machines superposées gardent des entrées distinctes.
- Les ouvrants et appareils audio-vidéo placés sans entité liée restent accessibles ; leurs catégories sont proposées dès qu’un modèle est présent. Les équipements Home Assistant sans modèle placé sont également inclus dans la liste de leur catégorie.
- Toutes les listes partagent la recherche à partir de sept équipements, le défilement limité et le retour avec conservation de la recherche. Les noms de pièces restent compacts, avec la température visible dans l’ambiance Climat ; les autres valeurs sont consultables dans les infobulles.
- Le clic direct sur les modèles 3D reste disponible. Vérifications visuelles des trois catégories, tests de regroupement et de déduplication, lint, TypeScript, suite frontend et reconstruction du bundle HACS.

## 0.13.11 — Repères discrets des lumières et du climat

- Les étiquettes des pièces intègrent une seule petite icône pour l’ambiance Lumières ou Climat, quelle que soit la quantité d’équipements. Les boutons individuels et leurs noms ne sont plus disposés sur le plan.
- Un clic sur l’icône ouvre une liste compacte des équipements de la pièce, avec leurs valeurs utiles en direct. L’éclairage présente aussi le nombre de lumières allumées ; une teinte chaude du repère indique qu’au moins une lumière est active.
- Les listes défilent dans une hauteur limitée. À partir de sept équipements, une recherche par nom, insensible à la casse et aux accents, permet de trouver rapidement un appareil. La hauteur de la liste reste stable pendant la recherche.
- Un équipement de la liste ouvre son résumé individuel. Un bouton de retour permet de retrouver la collection de la pièce en conservant la recherche, et la fiche complète reste accessible avec Détails.
- Dans l’ambiance Climat, les températures restent visibles sur les pièces tandis que les badges détaillés du mode et de la consigne sont remplacés par le repère discret. Les infobulles continuent de suivre la pièce pendant les mouvements de caméra.
- Vérifications : navigation visuelle lumière/climat, tests de collections nombreuses (30 lumières), recherche et déduplication, suite frontend, lint, TypeScript et reconstruction du bundle HACS.

## 0.13.10 — Infobulles utiles, lumières et climat

- Les infobulles du plan 3D présentent un résumé adapté à l’équipement : état et luminosité d’une lumière allumée, mode du thermostat, température mesurée et consigne active, état des ouvrants, contenu en lecture et volume.
- Les machines regroupent leurs capteurs en un résumé du cycle : phase lisible, programme, durée restante et progression pendant le fonctionnement. Une porte ouverte est signalée ; les valeurs de cycle périmées sont masquées après la fin.
- Les dimensions, attributs techniques, consommation instantanée, versions et capteurs sans intérêt pour ce résumé ne sont plus affichés. Un bouton Détails ouvre la fiche complète séparément.
- Dans les ambiances Lumières et Climat, chaque équipement lié à une pièce dispose d’un bouton avec nom et icône sur le plan. Les températures et humidités sont également consultables. Ces repères suivent la pièce pendant les déplacements de caméra sans inventer une position physique non configurée.
- Les états indisponibles restent explicites et les résumés sont actualisés en direct. Les repères restent accessibles au clavier et respectent le placement du Studio et la gestion des collisions des étiquettes.
- Vérifications : tests dédiés aux résumés, lint, TypeScript, suite frontend et reconstruction du bundle HACS.

## 0.13.9 — Infobulles des équipements sur le plan 3D

### Ajouté

- **Clic direct sur les modèles 3D** : portes, fenêtres, portes-fenêtres, volets, stores, rideaux, téléviseurs, enceintes, lave-linge et sèche-linge ouvrent une infobulle avec leur nom, leur pièce, leurs dimensions disponibles et les états des entités Home Assistant associées. Chaque appareil superposé se sélectionne séparément.
- **Informations en direct** : l’infobulle se met à jour avec les états Home Assistant. Les appareils de buanderie regroupent leurs capteurs de cycle, temps restant, programme, progression, puissance, énergie et hublot. Les lecteurs et ouvrants présentent leurs attributs utiles lorsqu’ils sont disponibles.
- **Détails et navigation** : cliquer sur une ligne de l’infobulle ouvre la fiche de l’entité. La bulle suit le point cliqué pendant les mouvements de caméra, reste dans le cadre du plan et se ferme avec sa croix, Échap, un clic sur le sol ou un changement de niveau, d’ambiance ou de plan. Les équipements sans entité liée indiquent cette absence.
- **Clic et gestes** : pointeur dédié au survol, sélection tactile facilitée des équipements, respect du glisser pour tourner la maison et du mode de placement dans le Studio. Les équipements invisibles et les anciens panneaux remplacés lors des mises à jour d’un volet ne restent pas cliquables.

## 0.13.8 — Proportions cohérentes de tous les équipements du plan 3D

### Corrigé

- **Portes, fenêtres et portes-fenêtres** : suppression de la compression verticale héritée du groupe des équipements. Les ouvrants respectent désormais leur largeur, hauteur et allège configurées, à la même échelle en mètres que les murs et les machines de buanderie, dans les limites de leur mur.
- **Volets, stores et rideaux** : leurs panneaux, lames et déplacements suivent les dimensions de leur ouverture sans aplatissement supplémentaire.
- **Téléviseurs et enceintes** : les écrans retrouvent leurs proportions, les pieds et enceintes leur hauteur, avec une position correcte sur le sol de chaque étage, y compris au sous-sol. La hauteur des murs n’affecte plus celle des équipements.
- **Affichage des niveaux** : les ouvrants, appareils audio et vidéo et appareils de buanderie sont tous attachés directement au niveau, sans transformation verticale intermédiaire. La vue avec les murs abaissés conserve les repères des ouvrants sur le sol.

## 0.13.7 — Placement et superposition des appareils de buanderie

### Ajouté

- **Studio, section Buanderie de chaque pièce** : ajouter un lave-linge ou un sèche-linge, le relier à son appareil Home Assistant, le placer en touchant le sol du plan ou en saisissant ses coordonnées, puis régler son orientation, sa hauteur au-dessus du sol et ses dimensions. Les dimensions par défaut sont 60 × 85 × 65 cm.
- **Superposition** : choisir « Superposer sur » pour installer un appareil au-dessus d’un autre de la même pièce. Il suit automatiquement la position et l’orientation du support, et sa hauteur se recalcule lorsque les dimensions du support changent. Les associations circulaires ou inexistantes sont rejetées côté navigateur et Home Assistant.
- **Sèche-linge sur le plan 3D** : détection des noms français et internationaux, couleur distincte, tambour animé pendant un cycle et témoin lumineux d’activité. Les appareils placés explicitement remplacent leur représentation automatique.
- **Conservation du placement** : positions reprises lors des déplacements et redimensionnements des pièces, des imports et du recalage des niveaux. Démo `/?spatial&floors&laundry` avec un sèche-linge superposé au lave-linge du sous-sol ; ajouter `&studio` pour essayer les réglages dans le Studio de démonstration (changements conservés dans la session uniquement).

### Corrigé

- **Proportions et lisibilité** : les appareils conservent leur hauteur réelle au lieu de subir la compression verticale des murs dans la vue 3D. Largeur, hauteur et profondeur sont réglables individuellement.
- **Regroupement sans registre Home Assistant** : les capteurs de cycle et de temps restant sont rattachés au même appareil ; les suffixes ne tronquent plus le mot « washing ».

## 0.13.6 — Buanderie intégrée au plan 3D

### Ajouté

- **Ambiance Buanderie** : le sélecteur du plan 3D propose les lave-linge détectés dans Home Assistant. Chaque machine apparaît dans sa pièce au niveau choisi ; son tambour tourne pendant un cycle. Les pièces et niveaux indiquent les cycles en cours, et l’étiquette de la pièce donne le temps restant et le programme lorsqu’ils sont disponibles.
- **Démo du plan** : `npm run dev`, puis ouvrir `/?spatial&floors&laundry`, choisir « Sous-sol », puis l’ambiance « Buanderie ». L’aperçu autonome de la carte reste disponible sur `/?laundry`.

## 0.13.5 — Buanderie et lave-linge animés

### Ajouté

- **Carte MP Nexus Lave-linge** : nouvelle carte disponible dans le sélecteur de cartes Home Assistant. Elle regroupe automatiquement les machines et capteurs associés à partir des registres d’appareils et d’entités, sans identifiants ni nombre de machines prédéfinis. Le lave-linge apparaît dans une buanderie illustrée ; le tambour tourne pendant le cycle, et l’affichage présente le temps restant, le programme, la progression, la puissance, l’énergie et l’état du hublot lorsque Home Assistant fournit ces informations.
- **Aperçu de la buanderie** : `npm run dev`, puis ouvrir `/?laundry` pour voir deux machines fictives, dont une en cycle. L’aperçu reste disponible sans connexion Home Assistant ; les machines réelles sont détectées sur le dashboard installé.

## 0.13.4 — Badge climat sous la température

### Modifié

- **Étiquette des pièces dans le plan, ambiance Climat** : la température mesurée s’affiche désormais immédiatement sous le nom de la pièce, suivie du badge de chauffage ou de climatisation et de sa consigne. L’ordre est conservé sur ordinateur et sur téléphone.

## 0.13.3 — Des fenêtres d’équipement plus harmonieuses

### Modifié

- **Présentation commune** : typographie sans empattement, titres et valeurs mieux hiérarchisés, marges régulières, bordures plus fines et couleurs plus sobres dans les fenêtres des lumières, thermostats, volets, lecteurs, capteurs et interrupteurs.
- **Commandes regroupées** : luminosité horizontale plus compacte avec le bouton d’allumage à côté de son libellé ; température de couleur, palette et inclinaison des lames explicitement nommées. Le cadran, les boutons et les sélecteurs partagent les mêmes proportions et la même typographie.
- **Couleurs par équipement** : l’icône et l’indicateur d’état suivent l’activité de l’appareil ; les commandes du volet et du lecteur reprennent leur accent, et le thermostat utilise la couleur de son mode. Un lecteur sans pochette affiche une icône d’équipement.
- **Historique** : périodes présentées dans un sélecteur discret, bande d’états affinée et courbes sans halo. Les détails techniques disposent d’un chevron qui indique leur ouverture ; l’accès aux réglages Home Assistant devient un pied de fenêtre plus discret.
- **Petits écrans** : seul le contenu central défile, avec le titre, la fermeture et l’accès aux réglages toujours visibles. Les noms et attributs longs passent à la ligne et les modes du thermostat restent accessibles par défilement horizontal.

### Corrigé

- **Luminosité sur mobile** : une règle des barres verticales rétablissait deux colonnes sous 430 px. Le contrôle des lumières utilise désormais sa propre disposition, toujours horizontale et sur toute la largeur disponible.

### Vérifié

- **Navigateur** : commandes des appareils, historique, réglage horizontal sur téléphone et maintien des actions accessibles sur un écran de 320 × 640 px, pour six familles d’équipements avec un nom long et les détails ouverts.

## 0.13.2 — Luminosité horizontale dans la fenêtre des lumières

### Modifié

- **Luminosité** : la barre du popup lumière occupe désormais toute la largeur, se remplit de gauche à droite et se règle par glissement horizontal. L’icône et le pourcentage restent lisibles sur la partie éclairée.
- **Disposition des commandes** : le bouton d’allumage et les réglages de couleur se placent sous la barre, ce qui supprime l’espace vide à côté du bouton lorsque la lumière est éteinte.
- **Accessibilité** : le curseur annonce son orientation horizontale ; les flèches du clavier et l’extinction à 0 % continuent de fonctionner. Les barres des volets et ventilateurs restent verticales.

## 0.13.1 — Modes du climat, ventilation et programme

### Modifié

- **Modes du thermostat sur une seule ligne** : les cinq modes tiennent dans la largeur normale du panneau. Sur petit écran, la rangée défile horizontalement pour garder chaque commande accessible.

### Ajouté

- **Vitesse de ventilation** : un sélecteur affiche les vitesses déclarées par le thermostat dans `fan_modes` et appelle `climate.set_fan_mode` sur l’équipement affiché.
- **Programme** : un bouton active le préréglage `schedule`, `program` ou `programme` lorsqu’il est proposé par le thermostat. Il reflète le préréglage actif et utilise `climate.set_preset_mode` ; les autres préréglages restent accessibles. Ce bouton active le programme existant et ne crée pas de planning horaire.
- **Vérifications navigateur** : alignement des modes sur ordinateur et mobile, absence des commandes non prises en charge et vérification des services de ventilation et de programmation.
- **Règle de livraison du projet** : toute modification doit se terminer par une release GitHub/HACS publiée et vérifiée, sauf demande explicite de travailler uniquement en local.

## 0.13.0 — L’historique, et des commandes qui se touchent

### Ajouté

- **Historique dans la fenêtre** : chaque équipement montre ce que Home Assistant a gardé de lui. Une **courbe** pour ce qui se mesure — un capteur, la température d’une pièce, avec la consigne du thermostat en pointillés — et une **bande d’états** colorée pour le reste, avec la durée de chaque état (allumée 11 h 20, éteinte 12 h 40). Trois périodes : 12 h, 24 h, 7 jours. Le survol lit la valeur du moment pointé. L’historique de Home Assistant n’est plus nécessaire pour savoir ce qui s’est passé.
- **Barre tactile** : la luminosité d’une lumière, l’ouverture d’un volet et la vitesse d’un ventilateur se règlent sur une grande barre verticale que l’on glisse du doigt. Elle suit le doigt sans rien envoyer, commande au relâcher, et garde la valeur affichée jusqu’à la réponse de Home Assistant — plus de retour en arrière visuel entre les deux.
- **Cadran du thermostat** : la consigne se tourne sur un cadran qui prend la couleur du mode en cours (orange en chauffage, cyan en climatisation), avec la température mesurée en son centre et les boutons − et + de part et d’autre.
- **Pochette du lecteur** : un téléviseur ou une enceinte affiche ce qu’il joue, avec son image quand il en donne une.

### Modifié

- **Fenêtre plus large** : 600 px, des sections mieux séparées et une ouverture animée ; le clavier commande la barre comme le cadran (flèches, Page, Origine et Fin).
- **Pied de fenêtre** : « Historique et réglages Home Assistant » devient « Réglages Home Assistant », l’historique étant désormais dans la fenêtre.

### Corrigé

- **Dessins invisibles** : les fragments SVG écrits dans un gabarit `html` de Lit n’étaient pas créés dans l’espace de noms SVG et ne s’affichaient jamais. La courbe, son ombre et l’arc du cadran sont maintenant écrits avec le gabarit `svg`.

## 0.12.0 — Les fenêtres de MP Nexus

### Ajouté

- **Fenêtre d'équipement** : toucher « Détails », une tuile du dashboard ou une ligne d'une pièce du plan ouvre désormais une fenêtre MP Nexus — même verre, même accent, même langue que le dashboard — à la place du dialogue *more-info* de Home Assistant, dont la typographie et les couleurs juraient avec l'interface.
- **Commandes réellement offertes** : la fenêtre n'affiche que ce que l'équipement déclare. Une lumière : allumage, luminosité, température de couleur et couleur (sept teintes et un sélecteur libre). Un volet : ouvrir, arrêter, fermer, position et inclinaison des lames. Un thermostat : consigne au demi-degré, modes et préréglages. Un lecteur : lecture, pistes, volume, sourdine et source. Également serrures, interrupteurs, ventilateurs, humidificateurs, scènes et scripts. Un capteur se lit, sans commande inventée.
- **Détails techniques** : chaque fenêtre liste l'`entity_id` et les attributs restants de l'entité, repliés par défaut.
- **Retour à Home Assistant** : « Historique et réglages Home Assistant », en pied de fenêtre, ouvre le dialogue natif — seul porteur de l'historique, du logbook et des réglages d'entité.

### Modifié

- **Cartes d'autres auteurs** : les badges et cartes Home Assistant posés dans une vue MP Nexus ouvrent eux aussi la fenêtre MP Nexus. Leur demande de dialogue est interceptée par la vue ; celle émise par la fenêtre elle-même passe.
- **Carte Light hors dashboard** : utilisée dans un dashboard Home Assistant ordinaire, elle porte sa propre fenêtre, dans le thème réglé sur la carte.
- **Vocabulaire commun** : `frontend/entities.ts` rassemble ce que MP Nexus lit dans une entité (nature, icône, état, attributs) ; le plan 3D, les tuiles et la fenêtre parlent la même langue à partir du même code.

## 0.11.11 — Un flocon pour la climatisation

### Modifié

- **Badge climat** : chaque mode porte enfin son icône. Un flocon pour la **climatisation**, la flamme pour le **chauffage**, un ventilateur pour la **ventilation**, une goutte pour la **déshumidification**, un thermomètre en mode automatique. La flamme s’affichait jusqu’ici quel que soit le mode, sur le plan comme dans la fiche de la pièce et sur les tuiles du dashboard.
- **Couleur de la climatisation** : le badge et la fiche passent d’un bleu proche de celui du plan à un cyan glacé plus soutenu, aussi lisible sur le plan que l’orange du chauffage.

## 0.11.10 — Badge climat réservé à l’ambiance Climat

### Modifié

- **Label de pièce** : le badge du mode HVAC et de sa consigne n’apparaît plus que dans l’ambiance **Climat**. Lumières, Ouvrants et Audio-vidéo retrouvent un plan sans indication de chauffage ou de climatisation.

### Ajouté

- **Publication verrouillée** : `npm run release` devient la seule façon supportée de publier. Le script pousse `main`, relit la tête distante, étiquette ce SHA exact puis vérifie le code réellement servi par le tag ; il refuse de publier si les versions divergent, si `www/` n’a pas été reconstruit ou si le CHANGELOG n’a pas sa section.
- **Garde-fou CI** : le workflow `release-guard.yml` échoue si un tag publié ne déclare pas sa propre version ou n’est pas sur `main` — exactement le défaut qui avait livré le code de la 0.11.1 sous les numéros 0.11.2 à 0.11.8.

### Corrigé

- **Suite navigateur** : les 84 tests repassent au vert. Les six images de référence de l’accueil dataient d’avant la 0.11.2 et son résumé supprimé ; l’intervalle de température du rez-de-chaussée ignorait le thermostat de la cuisine ajouté en 0.11.5 ; le tracé d’une pièce en bas du plan échouait depuis que la fenêtre du Studio dépasse la hauteur de l’écran de test. Le CI était rouge à chaque release depuis la 0.11.1.

## 0.11.9 — Publication réparée

### Corrigé

- **Livraison HACS** : les versions 0.11.2 à 0.11.8 étaient publiées sur GitHub avec le code de la 0.11.1, la branche `main` n’ayant jamais été poussée avant la création des étiquettes. Les installations HACS recevaient donc l’ancienne interface malgré le numéro de version affiché.
- **Label de pièce** : le mode HVAC actif et sa consigne (par exemple **Climatisation · 24 °**) sont enfin réellement livrés, avec toutes les corrections climat de la 0.11.2 à la 0.11.8.

## 0.11.8 — Mode et consigne dans les pièces

### Modifié

- **Label de pièce** : le mode HVAC actif affiche désormais aussi la consigne lorsqu’elle est disponible, par exemple **Climatisation · 24 °**.
- **Accessibilité** : le titre du badge précise le mode et la consigne, sans modifier la couleur thermique du halo.

## 0.11.7 — Température et mode séparés

### Corrigé

- **Halo de pièce** : la couleur du halo redevient exclusivement celle de la température mesurée ; l’action HVAC ne la remplace plus.
- **Mode HVAC** : la pièce conserve uniquement un badge discret indiquant le chauffage, la climatisation, la ventilation ou la déshumidification en cours.
- **Carte Climat** : la ligne du thermostat garde son style selon l’action réelle sans modifier la légende thermique du plan.

## 0.11.6 — Climat immédiatement lisible

### Corrigé

- **Carte Climat** : la ligne du thermostat utilise maintenant l’action réelle (`heating`, `cooling`, `fan` ou `drying`) pour choisir son apparence, au lieu du seul mode sélectionné.
- **Légende du plan** : le mode Climat indique explicitement les couleurs de chauffage, climatisation, ventilation et déshumidification en cours.
- **Pièce sur le plan** : le badge de la Cuisine de démonstration conserve la température tout en signalant la climatisation active.

## 0.11.5 — Halo HVAC dans la pièce

### Corrigé

- **Plan 3D** : le halo de chaque pièce reflète maintenant l’action HVAC réellement en cours : chauffage orange, climatisation bleue, ventilation turquoise ou déshumidification violette.
- **Cuisine de démonstration** : la fixture contient désormais une climatisation active afin de rendre le comportement visible immédiatement.

## 0.11.4 — Action HVAC réelle

### Corrigé

- **État du climat dans les pièces** : le plan utilise désormais l’action réelle de Home Assistant (`heating`, `cooling`, `fan` ou `drying`) au lieu de confondre le mode sélectionné avec un équipement effectivement en fonctionnement.
- **Fixture et validation** : le chauffage de démonstration expose son action réelle afin de vérifier le badge visible sur le plan.

## 0.11.3 — Climat visible d’un coup d’œil

### Ajouté

- **État HVAC sur le plan** : chaque pièce indique désormais directement si son chauffage, sa climatisation ou sa ventilation est active, sans ouvrir la carte de détail.
- **Styles des modes climatiques** : les équipements de la section **Climat** adoptent une apparence distincte selon le mode chauffage, climatisation, ventilation, déshumidification ou automatique.

## 0.11.2 — Accueil allégé

### Modifié

- **Accueil** : suppression du résumé redondant de la maison, afin de laisser davantage de place aux équipements et aux actions utiles.

## 0.11.1 — Studio responsive et aligné

### Corrigé

- **Fond du Studio** : le fond couvre désormais toute la hauteur réelle du contenu, y compris lorsque les sections expert dépassent la hauteur du viewport.
- **Barre d’actions** : les actions du Studio restent regroupées et alignées aux largeurs intermédiaires, et le bouton **Importer** ne subit plus la marge des champs de formulaire.

## 0.11.0 — audit UX : rien ne se perd, tout s’explique

### Ajouté

- **Protection des modifications non enregistrées** : quitter ou recharger la page du Studio avec des réglages en cours demande désormais confirmation, et un badge **Modifications non enregistrées** reste visible dans la barre supérieure tant que tout n’est pas enregistré. Le travail en cours ne peut plus être perdu en silence.
- **Bannière de bienvenue** : à la première ouverture, le mode essentiel explique le parcours en une phrase — analyser, ranger, choisir un style — avant de laisser la main. Le message est mémorisé par utilisateur et ne réapparaît pas.
- **États vides guidés** : les pages Accueil, Lumières et Pièces sans équipement, ainsi qu’une pièce vide, expliquent la situation et proposent d’**ouvrir le Studio** (administrateurs) au lieu d’afficher une grille muette.
- **Indicateur de connexion réel** : le point de l’horloge et le statut **Synchronisé avec Home Assistant** suivent les événements de connexion (prête, reconnectée, interrompue) et passent à **Connexion interrompue, reconnexion…** en orange, au lieu d’afficher un état toujours vert.
- **Confirmation après conflit** : **Reprendre la version enregistrée** et **Conserver mes modifications** affichent désormais un message explicite du résultat, au lieu de refermer l’avertissement sans retour.

### Modifié

- **Échec d’action éphémère** : le message **Action impossible. Vérifiez la connexion et vos droits.** d’une carte lumière s’efface automatiquement après six secondes au lieu de rester affiché indéfiniment.
- **Accessibilité des tuiles** : chaque tuile de la section ambiance porte un libellé explicite (**Détails de {nom}**) pour les lecteurs d’écran.
- **Traductions** : quatorze nouveaux messages de l’interface sont disponibles en français, anglais et russe.

## 0.10.0 — Studio guidé : un seul chemin, deux profondeurs

### Ajouté

- **Mode essentiel** : le Studio s’ouvre désormais en trois étapes — **Analyser**, **Pièces**, **Style** — avec une progression visible et le bouton **Voir le dashboard** à chaque étape. Un néophyte obtient un dashboard fonctionnel sans connaître Home Assistant ni lire de documentation ; le plan 3D est présenté comme une option, jamais comme une étape obligatoire.
- **Mode expert** : un bouton de la barre supérieure révèle les huit sections complètes (identité, style, arrière-plan, disposition, contenu, navigation, équipements, plan 3D). Le choix est mémorisé par utilisateur et par navigateur : le professionnel retrouve son Studio complet, le particulier son parcours simple.
- **Sélection multiple des équipements** : « Tout sélectionner », cases par équipement, **Pièce pour la sélection** et **Masquer la sélection** ; au-delà de trois équipements, recherche et filtre par type. Cinquante équipements se rangent en quelques clics au lieu d’une liste déroulante par ligne.
- **Annuler** (↶) : chaque modification non enregistrée peut être reprise, y compris une affectation en masse ; les curseurs regroupent leurs valeurs successives pour ne pas remplir l’historique.
- **Importer un projet** (mode expert) : un fichier exporté remplace la configuration courante après validation du schéma (un projet de schéma 1 est migré) et un résumé lisible indique ce qui change — nom, réglages d’apparence, navigation, équipements, plan 3D, rôles — avant d’enregistrer. Un intégrateur reproduit une configuration d’une instance à l’autre.
- **Conflit de sauvegarde sans perte** : si le projet a été modifié ailleurs depuis l’ouverture de la page, le Studio dit ce qui diffère et propose **Reprendre la version enregistrée** ou **Conserver mes modifications**, au lieu d’exiger un rechargement qui perdait le travail en cours.
- **Indicateur d’analyse** : « Analyse en cours… » s’affiche pendant la lecture des registres.

### Modifié

- **Libellés humains** : « À vérifier » devient **Sans pièce** ; **Pourquoi cette carte ?** explique chaque décision en une phrase (« Home Assistant le déclare comme lumière », « Luminosité · Home Assistant annonce une luminosité réglable »…) ; les codes bruts restent disponibles sous **Données techniques**. Un équipement sans pièce n’est plus présenté comme une erreur.
- **Doctrine produit** : l’[ADR 0006](docs/adr/0006-one-path-two-depths.md) fixe le principe « un seul chemin, deux profondeurs » et deux tests d’acceptation par incrément (néophyte en moins de cinq minutes, professionnel : cinquante équipements en moins de trois minutes, export/import identique). La roadmap insère l’incrément 1.5 correspondant avant l’extension du catalogue.

## 0.9.15 — fond de plan conservé et Studio plein écran

- **Fond de plan** : l’application d’un plan déclenche maintenant automatiquement la sauvegarde du projet, afin que le fond reste présent après rechargement ou réouverture du Studio.
- **Studio** : l’interface utilise la hauteur réelle du viewport, même lorsque Home Assistant fournit un conteneur de hauteur limitée.

## 0.9.14 — fond de plan sauvegardé plus clairement

- **Plan 3D** : les actions d’application du fond de plan restent visibles pendant le défilement, afin de ne pas manquer l’étape **Appliquer au niveau** avant l’enregistrement du projet.

## 0.9.13 — catégories visibles

- **Fiches des pièces** : les titres « Lumières », « Climat » et « Audio-vidéo » disposent maintenant d’une séparation et d’un contraste renforcés pour distinguer immédiatement les groupes d’équipements.

## 0.9.12 — équipements rangés par catégorie

- **Fiches des pièces** : les équipements sont maintenant regroupés dans les catégories « Lumières », « Climat » et « Audio-vidéo », tandis que les appareils non classés restent visibles dans « Équipements ».

## 0.9.11 — informations simplifiées

- **Plan 3D** : la fiche d’une pièce sélectionnée n’affiche plus sa surface ni ses dimensions en m².
- **Page Info** : les libellés distinguent clairement la version de l’intégration Home Assistant et la version du bundle d’interface chargé dans le navigateur.

## 0.9.10 — accueil allégé

- **Accueil** : les surfaces en m² ne sont plus affichées dans les résumés du plan 3D ; les informations de surface restent disponibles dans les outils de conception du plan.

## 0.9.9 — bundle compilé avec le rendu restauré

- Le bundle frontend livré avec l’intégration est maintenant recompilé avec le rendu de plan restauré, afin que la mise à jour HACS affiche réellement les surfaces translucides et les contours précédents.

## 0.9.8 — retour au rendu de plan

- Retour au rendu de plan 3D précédent : surfaces translucides, murs filaires complets et contours lisibles, au lieu de la maquette opaque introduite en 0.9.7.
- Conservation de la vue multi-étages, de la sélection des pièces et des commandes d’équipements validées en 0.9.7.

## 0.9.7 — un plan 3D plus lisible

- Le rendu fil de fer laisse place à une maquette bleu ardoise : sols et murs opaques, éclairage doux et contours supérieurs discrets. Les lignes cachées derrière les surfaces ne traversent plus les pièces.
- La vue « Tous » simplifie les étages en plateaux avec des séparations basses ; les équipements et les cloisons détaillées réapparaissent en ouvrant un étage.
- Les murs sont représentés en coupe à 90 cm maximum sur un étage, avec les équipements adaptés à cette hauteur d’affichage. Les dimensions et les formes enregistrées restent inchangées.
- Le fond sous le plan est assombri et la sélection met en évidence la pièce sans rendre les autres murs transparents.

## 0.9.6 — Info et MP Nexus

- Le bouton « Info » remplace « Personnaliser » dans la navigation. La nouvelle page présente les versions, le résumé de l’installation et des conseils d’utilisation pour tous ; les administrateurs y retrouvent « Personnaliser » vers le Studio.
- Remplacement de la marque visible MP Glass par MP Nexus dans l'interface, la documentation, les traductions, les métadonnées, les messages utilisateur et les artefacts concernés.
- Conservation des identifiants techniques (mp_glass, custom:mp-glass) et des noms liés au style Glass afin de préserver la compatibilité Home Assistant.
- Versions du frontend et de l’intégration alignées sur 0.9.6 ; artefacts compilés inclus dans le commit de la release.
- Vérifications : lint, typecheck, 88 tests unitaires frontend, 83 tests navigateur et 55 tests Python.

## 0.9.5 — publication sans le code prévu

Le tag GitHub v0.9.5 pointait encore sur le commit 0.9.4. Le renommage MP Nexus et les versions correspondantes étaient restés locaux ; la release 0.9.6 les publie avec la page Info.

## 0.9.4 — groupes de pièces repliables

- **Pièces repliables** : chaque groupe d’équipements sous le plan peut être réduit ou rouvert en un clic, au clavier ou sur écran tactile. L’état de chaque pièce est indépendant et son contenu reste accessible avec un contrôle correctement annoncé aux technologies d’assistance.

## 0.9.3 — la section sous le plan suit l’ambiance, pièce par pièce

Demande utilisateur : « comme je suis en Audio-vidéo sur le plan, je devrais avoir tout l’audio-vidéo de l’étage rangé par pièce ; en Climat pareil, et en Lumières aussi : ça doit être rangé par pièce pour une lecture plus simple ».

- **La section suit le plan** : choisir **Lumières**, **Climat**, **Ouvrants** ou **Audio-vidéo** sur le plan 3D change la section en dessous — son titre, son icône et son contenu. Changer de niveau aussi : la section ne montre que le niveau affiché ; sur la vue empilée, toute la maison.
- **Rangé pièce par pièce** : les équipements sont regroupés sous le nom de leur pièce, avec son icône, dans l’ordre des pièces du plan. Quand plusieurs niveaux sont affichés, chaque pièce dit son niveau. En Lumières, les lampes hors du plan restent visibles dans un groupe **Hors du plan**.
- **Climat, Ouvrants et Audio-vidéo en un coup d’œil** : chaque appareil a sa tuile — le thermostat dit son mode et sa consigne à côté de la température mesurée, les sondes leur mesure, une porte **Ouverte** ou **Fermée**, un volet son pourcentage d’ouverture, un téléviseur ou une enceinte ce qui est lu. Un appui ouvre la fenêtre de détails de Home Assistant.
- Si aucune pièce du niveau n’a d’équipement de l’ambiance choisie, la section le dit simplement au lieu de rester vide.

## 0.9.2 — affichage corrigé sur iPhone

Retour utilisateur, captures d’un iPhone à l’appui : « l’affichage n’est pas correct sur certaines parties ».

- **En-tête** : la navigation débordait de sa carte et coupait le drapeau (les libellés « Accueil », « Lumières », « Pièces » sont plus larges avec les polices de l’iPhone). Sur téléphone, le drapeau passe sur la ligne du nom de la maison, où il y a de la place. Si les libellés ne tiennent toujours pas (petit écran, langue aux mots longs), seule la page affichée garde le sien, les autres gardent leur icône : c’est mesuré, pas fixé à une largeur.
- **Toute la maison** : les lignes des niveaux dépassaient à droite de la carte dès qu’un nom ou une température était long. Elles restent dans la carte ; le détail (« 14 pièces · lumières éteintes ») passe à la ligne au lieu d’être coupé.
- **Plan à plusieurs niveaux sur téléphone** : avec cinq niveaux, l’étiquette du niveau du haut disparaissait, cachée sous les onglets des niveaux. Le plan grandit avec le nombre de niveaux, la maison se place entre les onglets en haut et les ambiances en bas, et les étiquettes se rangent l’une sous l’autre dans l’ordre des niveaux, sans se chevaucher : toutes restent visibles.
- Nouveau test navigateur reproduisant la maison des captures (iPhone, cinq niveaux aux noms longs) ; captures de référence téléphone et tablette en portrait mises à jour.

## 0.9.1 — la langue se choisit sur le dashboard

Retour utilisateur sur 0.9.0 : « le choix de la langue doit être sur le dashboard, pas dans le Studio, pour que chaque utilisateur puisse choisir sa langue, et ça ne doit pas être un gros bouton, un bouton avec le drapeau de la langue suffira ».

- **Un petit drapeau** dans l’en-tête du dashboard montre la langue de l’interface : à côté de l’horloge sur grand écran, au bout de la navigation sur tablette et téléphone. Un clic ouvre les trois drapeaux, **Français**, **English**, **Русский** ; Échap ou un clic ailleurs le referme.
- **Chaque utilisateur choisit la sienne**, administrateur ou non : Home Assistant la garde pour lui, sur tous ses appareils. Tant qu’il n’a rien choisi, MP Nexus suit la langue de son profil Home Assistant. Le Studio, réservé aux administrateurs, n’a plus de menu de langue : il parle celle choisie sur le dashboard.
- Les drapeaux sont dessinés par MP Nexus : Windows affiche des lettres à la place des emoji de drapeau.
- Captures de référence de l’accueil mises à jour avec le drapeau.

## 0.9.0 — français, anglais et russe

Demande utilisateur : « est-ce qu’on peut ajouter un sélecteur de langue à cette interface, j’aimerais pouvoir choisir entre français, anglais et russe ».

- **Menu de langue** en haut du Studio, à côté de **Voir le dashboard** : **Automatique**, **Français**, **English**, **Русский**. Le changement est immédiat, sans recharger la page, et vaut pour tout MP Nexus : Studio, dashboard, cartes lumière, plan 3D, import Gemini et édition des niveaux.
- **Pour l’utilisateur, sur tous ses appareils** : Home Assistant garde le choix dans les données de l’utilisateur ; le navigateur en garde une copie pour s’ouvrir directement dans la bonne langue. **Automatique** (par défaut) suit la langue du profil Home Assistant : français et russe tels quels, anglais pour toute autre langue. Jusqu’ici, un profil en anglais voyait le plan 3D et le Studio en français.
- **Les noms restent les vôtres** : nom de la maison, pièces, niveaux et équipements ne sont jamais traduits. Les textes par défaut de l’accueil (accroche, sous-titre, citation, titre de section) suivent la langue tant qu’ils n’ont pas été modifiés ; le plan d’exemple et le « Niveau principal » du plan déduit des pièces aussi.
- **Nombres et dates** au format de la langue : horloge, surfaces (m² / м²), pourcentages. Les pluriels sont justes dans chaque langue, russe compris (1 комната, 3 комнаты, 5 комнат) ; « 1 pièces » devient « 1 pièce ».
- La fenêtre de configuration de l’intégration dans Home Assistant existe aussi en russe. Les noms de pièces proposés par Gemini restent en français, comme les remarques qu’il rédige lui-même ; celles de MP Nexus sont traduites.
- Les six captures de référence de l’accueil sont mises à jour (horloge au format français, « 1 pièce »).

## 0.8.4 — ambiances Ouvrants et Audio-vidéo sur le plan

Demande utilisateur : « en plus de Lumières et Climat il faudrait des boutons pour ouvrants et audio vidéo ».

- **Ouvrants** : une pièce dont une porte ou une fenêtre est ouverte (capteur d’ouverture, porte de garage, portail) passe au vert ; sinon, son halo bleu ciel est d’autant plus vif que ses volets, stores et rideaux laissent entrer le jour. Son étiquette dit **Ouverte** et la position de chaque volet. Sur toute la maison, chaque niveau dit ses ouvertures et ses volets ouverts (« 3 / 4 »), ou **Tout est fermé**.
- **Audio-vidéo** : une pièce dont le téléviseur ou l’enceinte joue a un halo violet, plus discret s’il est seulement allumé ou en pause. Son étiquette dit ce qui est lu, sinon **En pause** ou **Allumé** ; chaque niveau dit combien de lecteurs sont en lecture.
- **Une ambiance à la fois** : chaque étiquette ne lit plus que l’ambiance choisie. La position des volets et ce qui est lu, jusque-là toujours affichés, passent dans Ouvrants et Audio-vidéo ; Lumières ne garde que le point doré et Climat que la température. Une légende explique les couleurs de chaque ambiance.
- Chaque ambiance n’apparaît que si une pièce des niveaux affichés a de quoi la montrer ; Lumières reste toujours proposée. Sur téléphone, seule l’ambiance affichée garde son nom, les autres leur icône, pour que les quatre boutons tiennent sur le plan.

## 0.8.3 — le plan d’architecte reste sous le niveau

Retour utilisateur sur 0.8.2 : « je perds mon fond de plan ! ». **Modifier le plan** montrait les pièces sur une simple grille : l’image analysée par Gemini n’était gardée nulle part une fois le brouillon utilisé.

- **Gardé à l’import** : **Utiliser pour ce niveau** envoie l’image analysée à Home Assistant, avec sa place exacte sous les pièces. **Modifier le plan** l’affiche sous le niveau, comme dans le brouillon, et ses murs attirent les côtés des pièces.
- **Retrouvé pour un niveau déjà importé** : rangée **Fond de plan**, **Choisir le plan (PDF ou image)**. MP Nexus repère les murs dessinés et cale l’image seul, en cherchant l’échelle et la place qui posent le plus de côtés des pièces sur ces murs ; le message dit la part retrouvée.
- **Caler le fond** à la main si besoin : glisser le plan, **−5 %** à **+5 %** pour sa taille, Échap pour finir ; **Recaler automatiquement**, **Changer de plan**, **Afficher** et **Retirer le fond** complètent la rangée. **Appliquer au niveau** garde le fond avec les pièces, puis **Enregistrer**.
- **Confidentialité** : l’image est rangée dans `.storage/mp_glass_backdrops/` de Home Assistant, jamais sous `www`, rendue aux seuls administrateurs, et supprimée une fois qu’aucun niveau enregistré ne la montre plus. Le plan ne garde qu’un identifiant et la place de l’image (`backdrop`, champ facultatif du contrat).

## 0.8.2 — modifier le plan d’un niveau enregistré

Retour utilisateur : « je ne trouve pas de bouton modifier sur cette page pour modifier mon plan d’étage ». L’éditeur sur plan (déplacer, redimensionner, tracer, courber…) n’existait que dans la fenêtre du brouillon Gemini ; un plan enregistré, ou le plan par défaut, ne se corrigeait qu’en saisissant les sommets en mètres, repliés au bas de la pièce.

- **Modifier le plan** : à côté de **Niveau à modifier**, le bouton ouvre le niveau dans le même éditeur que le brouillon, en grand, sur une grille d’un mètre (trait plus marqué tous les 5 m) avec de la place autour de la maison pour dessiner. Tous les outils y sont : déplacer et redimensionner, **Forme libre**, déplacer un côté parallèlement, tourner, **Courber le côté**, **Arrondir l’angle**, **Ajouter une pièce**, **Tracer un contour**, supprimer, renommer, **Annuler**, zoom et **Aimantation**. Les côtés s’aimantent aux murs des autres pièces : une chambre élargie vient se coller exactement contre le mur de sa voisine. Un onglet **En 3D** montre le niveau tel qu’il sera.
- **Rien ne se perd** : chaque pièce garde son identifiant, sa pièce Home Assistant et ses équipements ; une pièce laissée telle quelle garde exactement sa forme. Portes et fenêtres restent sur leurs murs quand la pièce bouge ou change de taille, téléviseurs et enceintes suivent leur pièce. Ils apparaissent comme des marques : les glisser les déplace sans perdre leur nom, leur taille ni leurs volets, capteurs ou lecteur ; **Placer** en ajoute.
- **Appliquer au niveau** remplace les pièces du niveau, puis **Enregistrer** dans le Studio. Fermée avant, la fenêtre garde les modifications dans une carte (**Reprendre**, **Appliquer au niveau**, **Abandonner**).
- **Modifier sa forme sur le plan**, dans la pièce à modifier sous le plan 3D, ouvre l’éditeur sur cette pièce, déjà sélectionnée.

## 0.8.1 — portes, fenêtres et appareils placés sur le brouillon

Retour utilisateur sur 0.8.0 : « il est plus facile pour moi de placer les fenêtres, portes, etc. depuis le brouillon avec le plan visible ». Jusqu’ici, ils ne se plaçaient qu’après **Utiliser pour ce niveau**, pièce par pièce sous le plan 3D, loin du plan d’architecte qui les montre.

- **Placer** : dans la fenêtre du brouillon, onglet **Sur le plan d’origine**, une nouvelle rangée propose **Porte**, **Fenêtre**, **Porte-fenêtre**, **Téléviseur** et **Enceinte**. Une porte ou une fenêtre se trace le long d’un mur, d’un bord à l’autre de l’ouverture dessinée : elle se pose sur le côté de la pièce le plus proche, à la largeur tracée. Touché sans glisser, le mur la reçoit à sa largeur usuelle. Un téléviseur ou une enceinte se pose d’un toucher dans sa pièce. Le mode reste actif pour la suivante ; Échap le termine sans fermer la fenêtre.
- **Corriger** : chaque élément garde une marque de sa couleur, à glisser pour le déplacer (une ouverture se recale sur le mur le plus proche). Suppr ou **Retirer** l’enlève, **Annuler** revient sur les placements comme sur les pièces. La liste sous le plan donne la pièce de chacun et la largeur des ouvertures ; un élément hors des pièces est signalé **à replacer**. L’onglet **En 3D** les montre déjà.
- **Utiliser pour ce niveau** les reprend dans leurs pièces et relie d’office ce qui est sans ambiguïté : la seule fenêtre d’une pièce à son seul volet et à son seul capteur de fenêtre, sa seule porte à son seul capteur de porte, son seul téléviseur et sa seule enceinte à leur lecteur. Le message dit combien ont été repris et reliés ; les autres se relient toujours dans la pièce, sous le plan 3D.
- Placer depuis la pièce, sous le plan 3D du Studio, reste possible pour un plan déjà enregistré.

## 0.8.0 — portes, fenêtres, volets et audio-vidéo sur le plan

Demande utilisateur : pouvoir ajouter les ouvrants (portes, fenêtres, portes-fenêtres) pour gérer volets roulants, stores et rideaux, ainsi que les téléviseurs et haut-parleurs pour l’audio-vidéo, le tout harmonisé avec le reste de MP Nexus.

- **Portes, fenêtres, portes-fenêtres** : dans **Studio → Plan 3D**, chaque pièce reçoit ses ouvertures. **Porte**, **Fenêtre** ou **Porte-fenêtre** l’ajoute à sa taille usuelle, puis on touche sur le plan 3D le mur qui la reçoit. Mur, position le long du mur, largeur, hauteur et allège se règlent aussi dans la liste ; les murs y sont décrits par leur orientation sur le plan et leur longueur (« Mur 2 · à droite · 4 m »).
- **Volets roulants, stores, rideaux** : chaque ouverture se relie à ses volets, stores et rideaux et à ses capteurs d’ouverture. Sur le plan, la porte ou la fenêtre est dessinée dans son mur avec ses vantaux, qui pivotent vers la pièce quand le capteur la dit ouverte. Le volet roulant descend dehors avec ses lames, le store dedans, les rideaux se ferment des deux côtés, chacun à sa position réelle. Murs abaissés, les ouvertures deviennent des traits au sol, avec l’arc de chaque vantail de porte.
- **Fiche de la pièce** : une section **Portes et fenêtres** donne l’état de chacune (Ouverte, Fermée) et, en dessous, ouvrir, arrêter, fermer, la position et l’inclinaison des lames d’un store orientable. **Tout ouvrir / Tout fermer** commande en une fois les volets de la pièce, du niveau (Vue d’ensemble, avec le nombre de volets ouverts) ou de la maison. Portes de garage, portails, portes motorisées et clapets n’en font jamais partie : ils restent commandés un par un.
- **Téléviseurs et enceintes** : ils se placent dans la pièce d’un toucher sur le plan, reliés à leur lecteur Home Assistant (le premier de la pièce de même nature est proposé). Le plan dessine un écran sur pied ou une colonne d’enceinte, allumés ou en lecture ; ce qui est lu s’affiche sous le nom de la pièce. La fiche permet d’allumer et éteindre, lecture/pause, pistes précédente et suivante, volume, sourdine et source, chacune seulement si le lecteur la propose.
- **Pièces reliées** : les lecteurs multimédias d’une pièce Home Assistant s’affichent d’eux-mêmes dans sa pièce du plan, comme lumières et volets. Une fenêtre ouverte s’affiche sur l’étiquette de sa pièce.
- **Modifier une pièce** : ajouter ou retirer un sommet garde les ouvertures sur leurs murs ; une ouverture qui n’est plus près d’un mur est retirée, avec un message. Un niveau réimporté par Gemini reprend les ouvertures des pièces de même nom.
- Une modification du Studio qui ne change pas les contours (nom, association, ouverture placée) ne recadre plus la caméra du plan.
- **Contrat** : une pièce peut porter `openings` et `media`, vérifiés côté navigateur, intégration et worker. Les plans enregistrés avant cette version restent valides et inchangés. Gemini ne reconnaît pas encore les ouvertures sur un plan importé : elles se placent à la main.

## 0.7.21 — plan plus grand, pièces arrondies en deux gestes

Demande utilisateur : « je voudrais cette fenêtre plus grande pour avoir le plan en plus grand », et « le bouton [Courber le côté] est présent mais inactif ». Le bouton ne s’activait que sur une pièce déjà passée en **Forme libre** et dont on avait touché un côté. Or la plupart des pièces sont des rectangles : il restait donc grisé.

- **Fenêtre plus grande** : quand le brouillon se corrige sur son plan, la fenêtre de résultat prend toute la largeur de l’écran (1 800 px au plus) au lieu de 920 px. Le plan occupe presque toute la hauteur au lieu de la moitié. L’onglet **En 3D** profite de la même place. La fenêtre de progression et celle d’erreur ne changent pas.
- **Courber le côté** : actif dès qu’une pièce est sélectionnée, rectangle compris. Sans côté sélectionné, il attend le côté à courber : les côtés s’éclairent, et le côté touché se bombe vers l’extérieur en quart de cercle. Un rectangle reçoit d’abord son contour. Échap abandonne sans fermer la fenêtre. Un côté déjà sélectionné est courbé aussitôt, comme avant.
- **Arrondir l’angle** : nouveau bouton, sur le même principe. L’angle touché est remplacé par un arc tangent à ses deux murs, à partir d’un tiers du plus court des deux. Le rond au milieu de l’arc règle ensuite le rayon. La surface perd seulement le coin au-delà de l’arc.
- Les aides sous la barre d’outils indiquent ces deux boutons dès qu’une pièce est sélectionnée.

## 0.7.20 — en-tête lisible sur téléphone en paysage

Sur un écran d’environ 844 px de large (téléphone tenu en paysage), le nom de la maison passait sous les boutons de navigation : **Accueil** en cachait la fin. Le défaut existait déjà en 0.7.3.

- **Nom de la maison** : il ne déborde plus de sa place, à aucune largeur. S’il est trop long pour la ligne, il se termine par « … », comme la ligne « Home Assistant · MP Nexus » en dessous, au lieu de passer sous la navigation ou hors de l’en-tête.
- **Personnaliser** : jusqu’à 960 px de large, le bouton ne montre plus que son icône, comme il le faisait déjà jusqu’à 820 px. Sur téléphone en paysage, « Maison de démonstration » tient ainsi en entier à côté de la navigation, toujours sur une seule ligne. Le bouton garde son info-bulle « Personnaliser MP Nexus ».
- Téléphone en portrait, tablette, bureau et écran mural ne changent pas : leurs captures de référence restent identiques au pixel près. Seule celle du téléphone en paysage a été régénérée, et le test visuel vérifie maintenant aussi que le nom est entier et ne touche pas la navigation, aux six largeurs.

## 0.7.19 — captures de référence à jour

Maintenance : le dashboard ne change pas. Les six tests visuels de l’accueil (`tests/browser/light.spec.ts`) échouaient : leurs captures de référence dataient de 0.7.3.

- **Page plus haute de 56 px** sur téléphone (portrait et paysage) et tablette en portrait : c’est le bouton **Tout est éteint** ajouté en 0.7.13 à la fiche « Vue d’ensemble » (44 px de haut, 12 px de marge). Sur tablette en paysage, bureau et écran mural, la fiche est à côté du plan et s’allonge sans changer la hauteur de la page. La barre Home Assistant transparente (0.7.7) n’y est pour rien : la page de démonstration n’en a pas.
- **Plan** : les autres écarts viennent des murs en vitre (0.7.10) et des étiquettes sans point bleu, sans sélecteur Lumières / Climat quand aucune pièce ne mesure la température (0.7.9).
- Les captures ont été régénérées puis vérifiées une à une : le rendu est celui voulu par ces versions, et les tests passent de nouveau d’un lancement à l’autre.

## 0.7.18 — niveaux alignés sur leur centre

Demande utilisateur : « ce serait mieux d’aligner les plans par leur point central, l’affichage en cas de superficie différente aura un meilleur rendu ». Sur une maison dont les niveaux n’ont ni la même superficie ni la même origine, la pile partait en escalier : chaque niveau restait là où il avait été dessiné.

- **Tous les niveaux** : chaque niveau est maintenant amené sur le milieu de la maison avant d’être empilé. Un sous-sol plus petit que le rez-de-chaussée, ou un étage importé depuis son propre plan, se pose au centre de la pile au lieu de déborder d’un côté.
- Le milieu d’un niveau est celui de son emprise, murs courbes compris ; les pièces d’un même niveau gardent leurs positions les unes par rapport aux autres, et l’écart entre niveaux suit l’emprise ainsi recentrée.
- Seul l’affichage de **Tous** est concerné : le plan enregistré, les coordonnées des pièces et la vue d’un niveau seul ne changent pas.

## 0.7.17 — supprimer un plan, supprimer un niveau

Demande utilisateur : « une fois les plans enregistrés, je ne sais pas comment le modifier ou le supprimer ». Le Studio savait ajouter un niveau et supprimer une pièce, mais rien ne retirait un niveau ni le plan lui-même : décocher **Afficher le plan sur l’accueil** ne faisait que le masquer.

- **Supprimer le plan** : dans **Plan 3D**, à côté de **Repartir du plan par défaut**, un bouton retire le plan enregistré après confirmation. MP Nexus repart alors du plan déduit de vos pièces Home Assistant, celui qui s’affiche quand rien n’est enregistré.
- **Supprimer ce niveau** : à côté de **Ajouter un niveau**, retire le niveau affiché avec ses pièces, après confirmation. Le bouton reste grisé sur un plan d’un seul niveau : un plan garde toujours un niveau.
- Les deux suppressions passent par une fenêtre de confirmation qui dit ce qui est perdu, et rien n’est retiré tant que **Enregistrer** n’a pas été cliqué dans le Studio : quitter le Studio sans enregistrer laisse le plan intact.

## 0.7.16 — revenir sur un brouillon

Demande utilisateur : « je ne sais pas comment modifier le brouillon ». La fenêtre de résultat fermée par mégarde (touche Échap), le brouillon restait à l’écran mais plus rien ne permettait de le corriger.

- **Modifier le brouillon** : sur la carte « Brouillon IA · non enregistré », un bouton rouvre la fenêtre de résultat directement sur **Sur le plan d’origine**, là où les pièces se déplacent, se redimensionnent, se renomment, s’ajoutent et se suppriment. Aucune nouvelle analyse n’est lancée : ni quota Gemini consommé, ni plan renvoyé à Google, et les corrections déjà faites restent en place avec leur historique d’annulation.
- Quand l’image analysée n’est plus disponible, le bouton s’appelle **Revoir le brouillon** et rouvre l’aperçu 3D seul.
- **Ignorer**, depuis la carte, libère maintenant l’image analysée et affiche le même message que dans la fenêtre.

## 0.7.15 — murs courbes et pièces en biais

Demande utilisateur : sur un vrai plan, certaines pièces sont arrondies ou dessinées dans une autre orientation ; il faut pouvoir les reproduire pour que la 3D soit fidèle.

- **Murs courbes** : chaque côté d’une pièce peut être courbé, du mur légèrement bombé au demi-cercle. Dans la fenêtre de résultat, toucher un côté puis **Courber le côté** le bombe vers l’extérieur en quart de cercle ; le rond au milieu du côté règle ensuite la courbure au doigt, en s’aimantant sur le mur droit, le quart de cercle, le demi-cercle et les raccords tangents aux murs voisins (couloir aux bouts arrondis, angle arrondi). **Redresser le côté** revient au mur droit.
- **En 3D** : un mur courbe est une paroi d’un seul tenant qui suit sa courbe, sans facettes, ses lignes du haut et du pied comprises ; partagé par deux pièces, il n’est dessiné qu’une fois. Sols, halos, surfaces et cotes suivent la courbe exacte.
- **Pièces en biais** : la marque **⟳** à côté de la pièce sélectionnée la fait tourner autour de son milieu. L’angle s’affiche pendant le geste et s’aimante sur les axes de l’image comme sur **les directions des murs du plan** : un corps de bâtiment dessiné de travers se met exactement dans son axe. Une pièce au bord du plan rentre dedans en tournant.
- **Déplacer un côté** : glisser un côté du contour le déplace parallèlement à lui-même, ses angles suivant les murs voisins, qui gardent leur direction. Une pièce inclinée garde ses angles droits pendant qu’on ajuste sa largeur ou sa profondeur.
- **Aimantation en biais** : MP Nexus repère aussi les murs du plan qui ne suivent pas les bords de l’image, en tournant l’image dans les directions où ses traits sont les plus nombreux. Un point se pose sur le croisement des deux repères les plus proches — murs droits ou en biais, bords et angles des autres pièces, directions du plan — au lieu d’être rabattu sur les axes.
- **Analyse** : Gemini rend désormais un contour dès qu’une pièce n’est pas un rectangle droit (forme en L, pièce inclinée, mur courbe suivi point par point). Une suite de points qui tournent régulièrement le long d’un même cercle devient un arc ; les angles francs et les pans coupés d’un bow-window restent des angles. L’alignement automatique des murs ne rabat plus sur les axes un mur en biais ou une courbe.
- **Murs partagés en biais** : deux pièces séparées par l’épaisseur d’un mur partagent une seule cloison quelle que soit sa direction ; les angles suivent leurs deux murs et restent droits. Seul l’affichage change.
- **Studio** : sous **Corriger les sommets**, une colonne donne la courbure du côté qui part de chaque sommet (0 pour un mur droit, 1 pour un demi-cercle, négatif de l’autre côté).
- **Contrat** : une pièce peut porter `arcs`, une valeur par côté, bornée au demi-cercle et vérifiée côté navigateur, intégration et worker. Les plans enregistrés avant cette version restent valides et inchangés.

## 0.7.14 — tous les niveaux d’un coup d’œil

Demande utilisateur : voir les niveaux de la maison superposés dans la vue plan pour connaître d’un coup d’œil l’état de chacun, puis arriver sur la vue actuelle en choisissant un niveau.

- **Tous les niveaux** : une maison de plusieurs niveaux s’ouvre sur tous ses niveaux en 3D, superposés du plus bas au plus haut et assez écartés pour voir l’intérieur de chacun. Les halos restent visibles sur chaque niveau : lumières allumées, ou températures en mode Climat. Seul l’affichage les écarte ; les hauteurs du plan enregistré ne changent pas.
- **L’état de chaque niveau à côté de lui** : son nom, un point doré si une lumière y est allumée, le nombre de lumières allumées (« Tout est éteint » sinon) et, en mode Climat, la température de sa pièce la plus fraîche à sa plus chaude.
- **Choisir un niveau** : le toucher sur le plan, toucher son étiquette, son onglet ou sa ligne dans la fiche : la caméra plonge sur ce niveau et la vue habituelle du niveau prend le relais, avec ses pièces et leurs commandes. L’onglet **Tous**, en tête des niveaux, y ramène en reculant depuis le niveau quitté. Survoler un niveau l’éclaire et estompe les autres.
- **Fiche Toute la maison** : nombre de niveaux et de pièces, surface, lumières allumées, **Éteindre toute la maison** en une commande (lumières des pièces du plan uniquement), puis chaque niveau du plus haut au plus bas avec ses pièces, ses lumières et ses températures.
- La vue de tous les niveaux a sa propre vue enregistrée (appui long sur **Recentrer**), distincte de celle de chaque niveau. La vue de dessus n’y est pas proposée : les niveaux s’y cacheraient. Sur téléphone, la maison se décale pour laisser la place aux étiquettes.
- **Studio** : le niveau ouvert sur le plan devient le **Niveau à modifier**.
- Une maison d’un seul niveau et l’aperçu d’un import restent inchangés.

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
- **Correction** : sur les vues MP Nexus, la barre est désormais masquée, pas seulement transparente. Seules ses actions (recherche, Assist, modification) et, sur téléphone, le bouton du menu latéral restent visibles. Ce qui la peindrait ne s’affiche plus, et les clics au-dessus du contenu défilé atteignent MP Nexus.
- Mode édition et autres dashboards : inchangés.

## 0.7.7 — plus de bandeau noir sur les sous-vues

Demande utilisateur : retirer le bandeau noir affiché en haut des pages Lumières, Pièces, des pièces et de l’Inventaire.

- Ce bandeau était la barre de Home Assistant, opaque sur une sous-vue avec sa flèche retour et le titre de la vue. Sur les vues MP Nexus, elle est désormais transparente comme sur l’accueil : le fond passe dessous et seules restent ses actions (recherche, Assist, modification). La flèche retour et le titre, redondants avec l’en-tête MP Nexus, ne sont plus affichés ; le retour du navigateur ramène toujours à la page précédente.
- En mode édition, la barre de Home Assistant reprend son aspect habituel. Les autres dashboards ne sont pas concernés.

## 0.7.6 — cause trouvée : le registre des éléments remplacé

Retour utilisateur : après 0.7.5, `Timeout waiting for strategy element ll-strategy-dashboard-mp-glass to be registered` aussi sur ordinateur.

- **Cause, observée sur l’installation réelle** : un module HACS charge le polyfill `scoped-custom-element-registry`, qui remplace le registre des éléments du navigateur (`window.customElements`) par un nouveau registre ignorant tout ce qui a été déclaré avant lui. MP Nexus, chargé très tôt, s’y trouvait donc absent, et Home Assistant l’y attendait en vain. L’erreur dépendait de l’ordre de chargement, d’où son côté aléatoire, surtout sur tablette et téléphone.
- **Correction** : MP Nexus déclare à nouveau sa stratégie, ses vues, ses cartes et son plan dans tout registre qui remplace le précédent. Même si c’est après les 5 s d’attente, le dashboard remplace l’erreur de lui-même. Aucune ressource ni réglage à ajouter.
- Téléchargement de l’interface : une nouvelle génération du dashboard sur la même page ne réessaie plus des adresses déjà en échec.
- Page de diagnostic : message explicite quand elle est ouverte comme fichier local plutôt que depuis Home Assistant.

## 0.7.5 — le dashboard se rattrape seul

Retour utilisateur : l’erreur `Timeout waiting for strategy element ll-strategy-dashboard-mp-glass to be registered` persiste après 0.7.4.

- **Rattrapage automatique** : si la stratégie est déclarée après l’abandon de Home Assistant (5 s), MP Nexus remplace l’erreur par le dashboard à la mise à jour d’état suivante, sans recharger la page. Home Assistant interroge pour cela la stratégie à chaque mise à jour.
- **Anciennes tablettes** : le bootstrap utilisait une syntaxe (`??=`) illisible par iOS 12 et 13 ou les vieilles WebView Android. La stratégie n’était alors jamais déclarée, d’où l’erreur de délai. Il est désormais compilé pour ES2017. Si l’interface elle-même ne peut pas s’exécuter (il faut au minimum Chrome 107, Safari 16 ou Firefox 104), le dashboard l’indique avec le nom du navigateur au lieu de l’erreur de délai.
- **Page de diagnostic** : `/mp_glass_static/diagnostic.html`, à ouvrir sur l’appareil concerné, affiche sans console le navigateur, le téléchargement et la déclaration de la stratégie, et le chargement de l’interface ([dépannage](docs/TROUBLESHOOTING.md)).

## 0.7.4 — chargement fiable sur tablette et téléphone

Retour utilisateur : `Timeout waiting for strategy element ll-strategy-dashboard-mp-glass to be registered`, par moments, sur tablette et téléphone.

La stratégie était déjà déclarée par un bootstrap sans import, avant le chargement du bundle principal. L’erreur venait du moment où ce bootstrap est ajouté aux pages, et de la reprise après un échec réseau :

- Home Assistant sert les pages avant d’avoir chargé les intégrations personnalisées et n’ajoute le bootstrap qu’aux pages servies ensuite. MP Nexus l’ajoutait à la fin de son démarrage, après la lecture de son schéma et de son projet : il l’ajoute désormais en tout premier, ce qui réduit fortement la période pendant laquelle une page ouverte au démarrage de Home Assistant n’a pas la stratégie.
- Changer les options de MP Nexus recharge l’intégration : le bootstrap était retiré puis remis, et une page ouverte entre-temps affichait l’erreur. Il reste désormais en place ; il n’est retiré qu’à la suppression de l’intégration.
- Un échec de téléchargement du bundle principal (réseau qui revient après la veille, connexion lente) laissait le dashboard en erreur jusqu’au rechargement de la page. MP Nexus réessaie seul, sous une nouvelle adresse, pendant une quinzaine de secondes.
- Pendant un démarrage ou un rechargement de l’intégration, le dashboard attend MP Nexus (jusqu’à 20 s) au lieu d’échouer. Home Assistant garde son écran de chargement pendant ce temps.
- Diagnostic dans la console JS : `[MP Nexus x.y.z] stratégie du dashboard enregistrée (… ms après l’ouverture de la page)`, puis `dashboard demandé par Home Assistant`. Leur absence sur un appareil indique que la page a été ouverte avant le chargement de MP Nexus ([dépannage](docs/TROUBLESHOOTING.md)).

## 0.7.3 — pièces sous le plan

Demande utilisateur : toujours afficher les pièces sous le plan, sur une seule ligne.

- Sur grand écran, la liste des pièces quitte la colonne de droite, où elle s’étalait sur plusieurs lignes au-dessus de la fiche. Elle se place sous le plan, à sa largeur, et la fiche de la pièce ou du niveau remonte en haut de la colonne de droite. Sur téléphone, l’ordre ne change pas : plan, pièces, fiche.
- La liste reste sur une seule ligne quel que soit l’écran. Un fondu signale de chaque côté les pièces cachées ; à la souris, des flèches font défiler la liste, au doigt on la fait glisser. Une pièce choisie sur le plan est ramenée dans la partie visible de la liste.

## 0.7.2 — sans barre d’onglets

Demande utilisateur : retirer la barre de navigation affichée en bas de l’écran.

- Cette barre était celle des onglets de vues de Home Assistant (Accueil, Lumières, Pièces, une par pièce, Inventaire). Hormis l’accueil, toutes les vues du dashboard sont désormais des sous-vues : Home Assistant ne dessine plus sa barre d’onglets. On navigue avec l’en-tête MP Nexus (Accueil, Lumières, Pièces). Sur une sous-vue, la flèche retour de Home Assistant ramène à la page précédente.
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
- **Géométrie calculée par MP Nexus** : proportions tirées de la taille réelle de l’image (lue dans son en-tête), murs alignés, découpage sans chevauchement sur une grille (un placard dans une chambre la découpe en L), échelle tirée des cotes écrites (ordre largeur × profondeur vérifié) ou, à défaut, de la surface habituelle des pièces.
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

- Le dashboard n’était pas créé après une installation par HACS : seul le Studio apparaissait. Le Studio ajoute désormais le dashboard **MP Nexus** dans la barre latérale dès sa première ouverture (commandes WebSocket publiques de Home Assistant, administrateurs uniquement). Un dashboard MP Nexus existant est réutilisé, quelle que soit son adresse ; en cas d’échec, le Studio indique la marche manuelle.
- Le bouton **Voir le dashboard** du Studio pointe vers le dashboard réel au lieu d’une adresse fixe.
- Le Studio s’appelle **MP Nexus Studio** dans la barre latérale, pour ne plus se confondre avec le dashboard.

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

- Mode Gemini direct par défaut : une clé API dans les options MP Nexus, sans add-on, adresse serveur ni clé de liaison à configurer.
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
- MP Nexus Studio avec personnalisation de l'identité, du verre, du fond, de la disposition, du contenu, de la navigation et des équipements, plus aperçu direct.
- Migration explicite du schéma projet v1 vers v2 et conservation des overrides.
- Compatibilité du custom panel Home Assistant renforcée contre le conflit de propriété `panel`.
- Tests du core, fixture navigateur, screenshots multi-format et procédure HA isolée.

Cette version de développement n'est pas une release HACS validée. Porte réelle HA et validation distante de publication consignées dans `docs/VALIDATION.md`.
