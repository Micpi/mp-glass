# Démo MP Nexus sur Synology

Ce projet installe uniquement la démonstration du plan 3D. Il ne se connecte pas à Home Assistant et ne contient aucune donnée de maison.

## Installation

1. Dans Container Manager, ajoutez `ghcr.io` comme registre et connectez-vous avec votre compte GitHub et un jeton personnel classique limité à `read:packages`. Le dépôt étant privé, l’image GHCR est privée elle aussi.
2. Créez un projet Container Manager nommé `mp-nexus-demo` et choisissez le fichier `deploy/synology/compose.yaml` de ce dépôt (ou collez son contenu dans l’éditeur du projet). Le projet fixe lui-même son nom Compose et laisse Compose générer le nom du conteneur ; cela évite les noms de conteneur imposés qui ont provoqué des entrées DSM incohérentes.
3. Avant le premier déploiement, définissez `MP_NEXUS_ADMIN_PASSWORD` avec au moins 12 caractères dans les variables du projet Container Manager. Le compte administrateur initial s’appelle `admin` (modifiable avec `MP_NEXUS_ADMIN_USERNAME`). Déployez le projet puis ouvrez `http://ADRESSE-IP-DU-SYNOLOGY:8080/__mpnexus/login`. Après la création du compte, vous pouvez retirer le mot de passe initial des variables : les comptes restent dans le volume `mp-nexus-demo-data`.
4. Connectez-vous avec `admin` et le mot de passe choisi. Dans le menu en haut, ouvrez **Utilisateurs** puis **Créer un utilisateur**. Renseignez un nom, un mot de passe provisoire d’au moins 12 caractères et le rôle **Utilisateur**. Transmettez ces identifiants à la personne ; elle devra choisir son propre mot de passe à la première connexion. La page **Utilisateurs** permet aussi de changer un rôle, réinitialiser un mot de passe ou supprimer un compte.

Après connexion, chacun choisit l’une des trois démos : **Résidentiel**, **Bureau / magasin** ou **Yacht**. Elles présentent toutes les catégories d’équipements dans un plan 3D fictif : éclairages, ouvrants, climatisation/chauffage, température et humidité, médias, présence et buanderie. Le choix ouvre directement le plan correspondant ; revenir à l’accueil permet d’en sélectionner un autre.

Chaque compte permet de suivre les connexions, ouvertures du plan et une durée de session approximative. Ces statistiques sont conservées 180 jours. Le portail ne stocke pas les adresses IP ni la localisation. Les mots de passe sont hachés ; les comptes et les clés de session restent dans le volume persistant.

Les images `linux/amd64` et `linux/arm64` sont publiées pour les Synology Intel/AMD et ARM compatibles avec Container Manager. L’application redémarre automatiquement si le NAS redémarre.

## Garder la démo à jour

GitHub publie `:latest` à chaque mise à jour de `main` et une image versionnée à chaque release. Une mise à jour demande deux opérations : télécharger l’image, puis recréer le conteneur. Un simple redémarrage ne récupère pas la nouvelle image. Le script `deploy/synology/update.sh` fait les deux opérations, retire les anciens conteneurs orphelins de ce projet, puis affiche l’état du service. Il ne touche pas aux autres projets du NAS. Le volume `mp-nexus-demo-data` conserve les comptes pendant la mise à jour.

Pour l’utiliser, placez `compose.yaml` et `update.sh` dans le dossier du projet sur le NAS, par exemple `/volume1/docker/mp-nexus-demo`. Dans Planificateur de tâches, créez une tâche planifiée de type **Script défini par l’utilisateur**, exécutée avec un compte qui peut utiliser Docker, et mettez comme commande :

```sh
/bin/sh /volume1/docker/mp-nexus-demo/update.sh
```

Vous pouvez lancer cette même commande manuellement après chaque publication. Pour automatiser, programmez la tâche une fois par nuit. Le script vérifie la syntaxe Compose avant de télécharger l’image, puis force la recréation pour éviter que DSM conserve un ancien conteneur référencé sous un nom invalide.

Si le projet existe déjà dans Container Manager, remplacez d’abord son YAML par le contenu actuel de `compose.yaml`, en gardant le nom du projet `mp-nexus-demo`. Ensuite, exécutez `update.sh` une première fois. Comme vous n’avez pas de comptes ni de statistiques à préserver, la migration vers le volume persistant est sans risque pour vos données.

Si l’authentification GHCR est enregistrée sur le NAS, Docker réutilise ses identifiants pour les téléchargements ultérieurs.

## Accès avec une adresse facile à retenir

Le port `8080` est publié sur le réseau local du NAS. Pour un accès distant, le plus simple est un domaine à toi géré par Cloudflare et un Cloudflare Tunnel. Le tunnel établit une connexion sortante depuis le NAS ; aucun port entrant n’est à ouvrir sur la box. Dans Cloudflare, créez un tunnel, ajoutez un nom public (par exemple `demo.votredomaine.fr`) qui pointe vers `http://mp-nexus:8080`, puis copiez son jeton dans `TUNNEL_TOKEN`.

Pour démarrer le tunnel depuis ce projet, ajoutez `TUNNEL_TOKEN` aux variables d’environnement du projet Container Manager, puis ajoutez `deploy/synology/compose.cloudflare.yaml` comme second fichier Compose. En ligne de commande, depuis la racine du dépôt, cela revient à :

```sh
docker compose -f deploy/synology/compose.yaml -f deploy/synology/compose.cloudflare.yaml up -d
```

Le QR code utilisera le nom d’hôte et le protocole transmis à l’application par le tunnel. `MP_NEXUS_PUBLIC_URL` peut être défini dans le projet si une adresse fixe est préférée.

Un nom de domaine doit être acheté ou déjà possédé ; le dépôt ne peut pas en créer un à votre place. Une page publiée par Tunnel est accessible aux visiteurs de ce nom. Si la démo doit rester privée, ajoutez une politique Cloudflare Access qui demande une connexion avant de choisir le nom public.

N’exposez pas le port 8080 en redirection directe sur Internet. Gardez-le limité au réseau local et passez par le tunnel pour l’accès distant.
