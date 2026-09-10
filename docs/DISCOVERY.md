# Découverte

Reader frontend : listes area/device/entity/floor via WebSocket de la session courante. Les states viennent du hass courant. Cache structurel par connexion pendant 60 secondes ; rescan invalide explicitement. Ce TTL limite les relectures mais ne constitue pas encore une subscription aux événements registry. Un dashboard déjà ouvert nécessite régénération/rechargement pour refléter une modification structurelle.

Refus des registres principaux : erreur explicite, pas de résultat vide silencieux. Floor API inconnue : avertissement et fonctionnement sans floors. Une permission refusée n'est pas traitée comme une API absente.

Le premier classifier couvre light et conserve le reste en fallback. Il ne recherche aucun mot de marque ou de type dans entity_id. Les heuristiques couvrant climate/media/security arrivent avec leurs propres tests. Les services, labels enrichis et config entries sont des extensions prévues, non collectées inutilement au premier incrément.

Les relations `via_device_id` sont conservées, mais pas utilisées pour fusionner. Les entités sans registry portent un ID provisoire signalé. Le rapport « À vérifier » comprend les catégories inconnues et les appareils sans pièce ; le prochain classifier réduira ce volume.
