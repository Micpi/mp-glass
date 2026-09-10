# MP Spatial — spécification de phase suivante

Non implémenté dans l'incrément lumière. La cible est un moteur propre : source → coordonnées normalisées → géométrie de pièces → anchors → couches d'état → interactions → rendu. Pas de dépendance picture-elements.

PNG/JPEG/WebP/SVG, floors, polygons, anchors [0,1], zoom/pan, calques et interactions sont prévus. Avant tout upload, ajouter validation MIME/contenu/taille, protection path traversal et traitement sûr SVG. Les plans sensibles devront être distribués avec authentification ; le chemin public du bundle JS ne doit jamais accueillir des plans.

Le premier test Spatial devra vérifier coordonnées, transformations, touch/scroll, sanitisation et conservation au regenerate. La liste WYSIWYG complète reste dans la roadmap.
