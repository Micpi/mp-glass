# Dépannage

- **`Timeout waiting for strategy element ll-strategy-dashboard-mp-glass to be registered`** : Home Assistant attend 5 s que la stratégie MP Nexus soit déclarée, puis abandonne. Le bootstrap de 2 Ko qui la déclare est ajouté à chaque page par l’intégration, sans ressource Lovelace. Déclaré en retard, il remplace de lui-même l’erreur par le dashboard à la mise à jour d’état suivante (depuis 0.7.5). Cause trouvée sur une installation réelle et corrigée en 0.7.6 : un module HACS chargeait le polyfill `scoped-custom-element-registry`, qui remplace `window.customElements` par un registre ignorant les éléments déclarés avant lui ; Home Assistant attendait la stratégie dans ce nouveau registre. MP Nexus y déclare désormais à nouveau ses éléments (console : `stratégie enregistrée à nouveau : un module a remplacé le registre des éléments`). L’erreur reste quand le bootstrap n’arrive jamais :
  - page ouverte pendant le démarrage de Home Assistant, avant le chargement de MP Nexus (tablette murale qui se recharge seule, application ouverte juste après un redémarrage) : Home Assistant n’ajoute le bootstrap qu’aux pages servies ensuite. Recharger la page une fois Home Assistant démarré ;
  - navigateur incapable de le lire ou de le télécharger.

  **Diagnostic d’un appareil, sans console** : ouvrir sur l’appareil concerné, dans le même navigateur ou la même application, `http://<adresse de Home Assistant>:8123/mp_glass_static/diagnostic.html` (même adresse que pour Home Assistant, en `https://` si c’est le cas). La page indique le navigateur, le téléchargement et le temps de déclaration de la stratégie, et si l’interface peut s’exécuter. Dans la console JS (débogage à distance), MP Nexus écrit aussi :
  - `[MP Nexus x.y.z] stratégie du dashboard enregistrée (… ms après l’ouverture de la page)`, puis `dashboard demandé par Home Assistant` quand Home Assistant l’utilise ;
  - aucune ligne `[MP Nexus …]` : page ouverte avant le chargement de MP Nexus, ou bootstrap non téléchargé (Home Assistant écrit alors `Failed to load extra module /mp_glass_static/mp-glass-bootstrap.js…`) ;
  - `interface injoignable, nouvel essai dans … s` : le bundle principal n’a pas pu être téléchargé ; MP Nexus réessaie seul pendant une quinzaine de secondes ;
  - `dashboard resté en erreur, nouvelle génération` : bootstrap déclaré après l’abandon de Home Assistant, dashboard régénéré.
- **`Ce navigateur est trop ancien pour l’interface MP Nexus`** : l’interface demande au minimum Chrome 107, Safari 16 (iOS/iPadOS 16) ou Firefox 104. Sur une tablette Android, mettre à jour Chrome et Android System WebView ; un iPad bloqué sous iOS 15 ou avant ne peut pas l’afficher.
  
  Une ressource Lovelace ajoutée à la main pour MP Nexus (anciennes versions ou tests) n’est plus nécessaire : la supprimer dans Paramètres → Tableaux de bord → ⋮ → Ressources. Les adresses chargées portent déjà la version (`?v=…`), le cache du navigateur ne sert donc pas une ancienne version après une mise à jour.
- **MP Nexus absent du sélecteur** : intégration chargée, bundle présent, rafraîchissement complet ; vérifier les logs de setup et la console JS.
- **Analyse impossible** : vérifier les droits de lecture registry. Ne pas utiliser un token administrateur stocké pour contourner une restriction.
- **Entité sans pièce** : l'area de l'entité gagne sur celle du device ; l'override projet gagne sur les deux.
- **Pas de slider** : vérifier supported_color_modes. L'attribut brightness seul ne prouve pas DIM.
- **Sauvegarde refusée** : schéma invalide, droits insuffisants ou édition concurrente ; recharger le projet avant nouvelle tentative.
- **Changement structurel absent** : Home Assistant régénère le dashboard quand ses registres (entités, appareils, pièces, étages) changent. Sinon : rescan, sauvegarde si correction, puis recharger le dashboard.
- **Docker indisponible sur ce poste** : le CLI existe mais Docker Desktop a échoué au démarrage du service d'inférence. Aucun fichier système Docker n'a été supprimé pour le contourner.

Diagnostics HA : versions, schéma et compteurs seulement. Le projet complet n'est pas joint automatiquement.
