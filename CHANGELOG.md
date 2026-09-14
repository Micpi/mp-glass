# Changelog

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
