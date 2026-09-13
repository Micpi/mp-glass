# Configuration

Le panneau **MP Glass Studio** est accessible dans la barre latérale Home Assistant et depuis le bouton **Personnaliser** du dashboard. Il configure sans YAML l'identité, les presets, les deux accents, la teinte et la transparence du verre, les bordures, les ombres, la typographie, le fond, la grille, les espacements, les dimensions, les icônes, les contrôles visibles, le contenu et l'ordre de navigation. Une image Home Assistant peut être utilisée avec une URL locale `/local/...` ou `/api/image/...`. L'aperçu reste visible et réagit avant la sauvegarde.

La navigation du projet crée des destinations réelles et stables : `home`, `lights`, `rooms`, puis une page `area-<id>` par pièce utile. Le Studio permet d'afficher, masquer et ordonner les trois destinations principales.

La section Installation analyse les registries Home Assistant, affiche les éléments à vérifier et permet d'affecter une pièce, renommer ou masquer un équipement. Enregistrer valide le schéma côté serveur. Seuls les administrateurs peuvent écrire.

Le JSON Schema `shared/project.schema.json` est normatif. La copie Python est produite par le build. Le [contrat projet](../PROJECT_CONFIG.md) détaille l'apparence, les rôles et les overrides. L'éditeur graphique de rôles, l'import graphique et les floorplans ne sont pas encore livrés ; ne pas les déduire de la présence de modèles dans la roadmap.

Une sauvegarde concurrente échoue avec `conflict`. Recharger avant de reprendre l'édition. Rescan et génération lisent les overrides existants. La sortie Lovelace générée n'est jamais la source de configuration.
