# Configuration

Le panneau **MP Glass Studio** permet de personnaliser le dashboard sans YAML. La colonne Apparence propose le nom de la maison, le preset, la couleur d'accent, la transparence du verre, le flou, les arrondis, l'assombrissement et la position du fond, la densité, les animations et les textes du bandeau. Une image Home Assistant peut être utilisée avec une URL locale `/local/...` ou `/api/image/...`. L'aperçu reste visible pendant les réglages et reflète immédiatement les changements.

La section Installation analyse les registries Home Assistant, affiche les éléments à vérifier et permet d'affecter une pièce, renommer ou masquer un équipement. Enregistrer valide le schéma côté serveur. Seuls les administrateurs peuvent écrire.

Le JSON Schema `shared/project.schema.json` est normatif. La copie Python est produite par le build. Le [contrat projet](../PROJECT_CONFIG.md) détaille l'apparence, les rôles et les overrides. L'éditeur graphique de rôles, l'import graphique et les floorplans ne sont pas encore livrés ; ne pas les déduire de la présence de modèles dans la roadmap.

Une sauvegarde concurrente échoue avec `conflict`. Recharger avant de reprendre l'édition. Rescan et génération lisent les overrides existants. La sortie Lovelace générée n'est jamais la source de configuration.
