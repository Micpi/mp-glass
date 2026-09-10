# Configuration

Le panneau MP Glass permet actuellement de nommer la maison, choisir un preset, analyser, affecter une pièce aux éléments à vérifier et les masquer. Enregistrer valide le schéma côté serveur. Seuls les administrateurs peuvent écrire.

Le JSON Schema `shared/project.schema.json` est normatif. La copie Python est produite par le build. Le [contrat projet](../PROJECT_CONFIG.md) détaille roles et overrides. L'éditeur graphique de rôles, l'import graphique et les floorplans ne sont pas encore livrés ; ne pas les déduire de la présence de modèles dans la roadmap.

Une sauvegarde concurrente échoue avec `conflict`. Recharger avant de reprendre l'édition. Rescan et génération lisent les overrides existants. La sortie Lovelace générée n'est jamais la source de configuration.
