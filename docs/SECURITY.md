# Sécurité et confidentialité

Local par défaut, aucun CDN ni télémétrie d'application. JS statique public sans données d'installation. Project Config servi uniquement via le WebSocket HA authentifié ; écritures protégées par require_admin. Les commandes passent par callService dans l'identité courante, sans proxy backend privilégié.

Schéma fermé partagé ; aucune propriété token/PIN/password acceptée dans les structures de configuration. L'utilisateur peut écrire un secret dans un champ texte libre : ce n'est pas détectable de façon fiable ; ces champs ne doivent servir qu'aux noms du chantier. Les diagnostics ne contiennent ni noms, ni états, ni mappings. L'export projet contient les noms/mappings choisis et reste privé.

Lit échappe le contenu des noms. Pas d'innerHTML utilisateur ni d'assets importés au premier incrément. Le support futur SVG/plan/caméra impose un travail de sécurité spécifique avant disponibilité.

Protection de concurrence : révision attendue + verrou serveur + sauvegarde avant remplacement du record en mémoire. Aucune mise à jour du projet lors d'un simple rescan.

Limites de validation : les permissions effectives doivent être testées avec comptes HA réel admin/non-admin ; l'absence de contournement dans l'architecture ne constitue pas une preuve d'exécution.
