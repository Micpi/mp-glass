# Installation de développement

1. `npm ci` puis `npm run build`.
2. Copier le dossier `custom_components/mp_glass` dans le dossier `custom_components` de la configuration HA de test. Conserver `www/mp-glass.js` et `project.schema.json` avec le backend.
3. Redémarrer HA, puis Paramètres → Appareils et services → Ajouter une intégration → MP Glass.
4. Nommage de la maison, puis ouverture du panneau MP Glass réservé aux administrateurs.
5. Analyser, corriger les pièces si nécessaire, enregistrer.
6. Paramètres → Tableaux de bord → Ajouter → dashboards communautaires → MP Glass Dashboard.

Si le module n'apparaît pas après installation : recharger complètement le navigateur. Le module s'enregistre via le backend ; les ressources manuelles en double sont inutiles. Pour utiliser seulement la carte en mode MANUAL, charger `/mp_glass_static/mp-glass.js?v=0.1.0` comme ressource module dans l'UI Lovelace après installation du composant.

Le paquet HACS unique est préparé structurellement. Aucune URL d'installation HACS fonctionnelle n'est encore promise : dépôt de publication, hassfest et HACS validation doivent être vérifiés avant release. Le `documentation` du manifest indique la destination proposée `Micpi/mp-glass`, à confirmer avant publication.
