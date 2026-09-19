# Guide intégrateur — incrément lumière

Préparer les Floors/Areas et associations dans Home Assistant. MP Nexus exploite ces informations ; les corrections effectuées dans MP Nexus sont des overrides projet et ne modifient pas le registry HA.

Le panneau MP Nexus présente le nombre d'équipements, les classés automatiquement et les éléments sans pièce. Un appareil automatique peut néanmoins figurer dans « Sans pièce » : les compteurs ne sont pas trois catégories disjointes. Passer en **Mode expert** (mémorisé par utilisateur) pour la section Équipements complète : sélection multiple, filtre par type, recherche, pièce ou masquage appliqués à la sélection. Cinquante équipements répartis sur dix pièces se traitent en dix sélections.

Enregistrer avant de créer/recharger le dashboard. « Pourquoi cette carte ? » donne la classification en phrases ; « Données techniques » expose les codes de preuve et bindings. Un fallback signifie que ce build n'a pas encore de présentation spécialisée ; il n'indique pas une intégration HA défectueuse. Une sauvegarde concurrente affiche ce qui diffère et laisse choisir entre la version enregistrée et les modifications locales.

Exporter télécharge seulement le Project Config ; Importer le recharge sur une autre instance avec un résumé des différences avant enregistrement (les identifiants d'entités doivent exister sur l'instance cible pour que les overrides s'appliquent). Traiter l'export comme une donnée privée : il ne contient pas de credentials, mais peut contenir des noms et mappings du chantier. Les rôles graphiques, l'audit exhaustif et les templates viendront ensuite.
