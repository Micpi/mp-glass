# Installation

## Avec HACS (mises à jour depuis Home Assistant)

Faisable à distance depuis l’application Home Assistant.

1. HACS → menu ⋮ en haut à droite → **Dépôts personnalisés**.
2. Dépôt : `https://github.com/Micpi/mp-glass`, type : **Intégration** → **Ajouter**.
3. Rechercher **MP Glass** dans HACS → **Télécharger** → choisir la dernière version.
4. Redémarrer Home Assistant (Paramètres → Système → Redémarrer, ou la réparation proposée par HACS).
5. Première installation uniquement : Paramètres → Appareils et services → Ajouter une intégration → MP Glass.
6. Ouvrir **MP Glass Studio** dans la barre latérale : à sa première ouverture, il crée le dashboard **MP Glass** (barre latérale) s’il n’existe pas encore. Un dashboard MP Glass déjà créé à la main est réutilisé.

Si le dashboard n’apparaît pas (droits insuffisants, adresse `mp-glass` déjà prise…), le Studio l’indique : l’ajouter depuis Paramètres → Tableaux de bord → Ajouter un tableau de bord → **MP Glass Dashboard**.

Une installation copiée à la main est reprise telle quelle : HACS remplace les fichiers de `custom_components/mp_glass`, l’intégration, ses options (clé Gemini comprise) et le projet enregistré sont conservés.

Chaque nouvelle release apparaît ensuite dans **Paramètres → Mises à jour** : **Installer**, redémarrer Home Assistant, puis recharger la page du navigateur ou de l’application pour obtenir le nouveau frontend.

L’add-on facultatif MP Glass Spatial n’est pas distribué par HACS : voir [sa documentation](../addons/mp_glass_spatial/DOCS.md).

## Installation de développement

1. `npm ci` puis `npm run build`.
2. Copier le dossier `custom_components/mp_glass` dans le dossier `custom_components` de la configuration HA de test. Conserver `www/` et `project.schema.json` avec le backend.
3. Redémarrer HA, puis Paramètres → Appareils et services → Ajouter une intégration → MP Glass.
4. Nommage de la maison, puis ouverture du panneau MP Glass Studio réservé aux administrateurs : il crée le dashboard MP Glass s’il manque.
5. Analyser, corriger les pièces si nécessaire, enregistrer.

Si le module n'apparaît pas après installation : recharger complètement le navigateur. Le backend charge le bootstrap de strategy avant Lovelace, puis le bundle principal à la demande. Pour utiliser seulement la carte en mode MANUAL, charger `/mp_glass_static/mp-glass.js?v=0.7.0` (version installée) comme ressource module dans l'UI Lovelace après installation du composant.
