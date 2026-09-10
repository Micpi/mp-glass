# Dépannage

- **MP Glass absent du sélecteur** : intégration chargée, bundle présent, rafraîchissement complet ; vérifier les logs de setup et la console JS.
- **Analyse impossible** : vérifier les droits de lecture registry. Ne pas utiliser un token administrateur stocké pour contourner une restriction.
- **Entité sans pièce** : l'area de l'entité gagne sur celle du device ; l'override projet gagne sur les deux.
- **Pas de slider** : vérifier supported_color_modes. L'attribut brightness seul ne prouve pas DIM.
- **Sauvegarde refusée** : schéma invalide, droits insuffisants ou édition concurrente ; recharger le projet avant nouvelle tentative.
- **Changement structurel absent** : rescan, sauvegarde si correction, puis recharger le dashboard. Les abonnements registry et auto-regenerate sont au backlog.
- **Docker indisponible sur ce poste** : le CLI existe mais Docker Desktop a échoué au démarrage du service d'inférence. Aucun fichier système Docker n'a été supprimé pour le contourner.

Diagnostics HA : versions, schéma et compteurs seulement. Le projet complet n'est pas joint automatiquement.
