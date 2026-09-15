# Dépannage

- **`Timeout waiting for strategy element ll-strategy-dashboard-mp-glass to be registered`** : Home Assistant attend 5 s que la stratégie MP Glass soit déclarée, puis abandonne. Le bootstrap de 1 Ko qui la déclare est ajouté à chaque page par l’intégration, sans ressource Lovelace. Home Assistant ne l’ajoute qu’aux pages ouvertes *après* le chargement de MP Glass : une page ouverte pendant le démarrage de Home Assistant (tablette murale qui se recharge seule, application ouverte juste après un redémarrage) ne l’a pas et affiche cette erreur jusqu’à son rechargement. Recharger la page, une fois Home Assistant démarré, suffit. Pour diagnostiquer un appareil, ouvrir sa console JS (débogage à distance pour une tablette ou un téléphone) :
  - `[MP Glass x.y.z] stratégie du dashboard enregistrée (… ms après l’ouverture de la page)` : le bootstrap est chargé, avec son heure ; `dashboard demandé par Home Assistant` suit quand Home Assistant l’utilise ;
  - aucune ligne `[MP Glass …]` : la page a été ouverte avant le chargement de MP Glass, ou le navigateur n’a pas pu télécharger le bootstrap (Home Assistant écrit alors `Failed to load extra module /mp_glass_static/mp-glass-bootstrap.js…`) ;
  - `interface injoignable, nouvel essai dans … s` : le bundle principal n’a pas pu être téléchargé ; MP Glass réessaie seul pendant une quinzaine de secondes.
  
  Une ressource Lovelace ajoutée à la main pour MP Glass (anciennes versions ou tests) n’est plus nécessaire : la supprimer dans Paramètres → Tableaux de bord → ⋮ → Ressources. Les adresses chargées portent déjà la version (`?v=…`), le cache du navigateur ne sert donc pas une ancienne version après une mise à jour.
- **MP Glass absent du sélecteur** : intégration chargée, bundle présent, rafraîchissement complet ; vérifier les logs de setup et la console JS.
- **Analyse impossible** : vérifier les droits de lecture registry. Ne pas utiliser un token administrateur stocké pour contourner une restriction.
- **Entité sans pièce** : l'area de l'entité gagne sur celle du device ; l'override projet gagne sur les deux.
- **Pas de slider** : vérifier supported_color_modes. L'attribut brightness seul ne prouve pas DIM.
- **Sauvegarde refusée** : schéma invalide, droits insuffisants ou édition concurrente ; recharger le projet avant nouvelle tentative.
- **Changement structurel absent** : rescan, sauvegarde si correction, puis recharger le dashboard. Les abonnements registry et auto-regenerate sont au backlog.
- **Docker indisponible sur ce poste** : le CLI existe mais Docker Desktop a échoué au démarrage du service d'inférence. Aucun fichier système Docker n'a été supprimé pour le contourner.

Diagnostics HA : versions, schéma et compteurs seulement. Le projet complet n'est pas joint automatiquement.
