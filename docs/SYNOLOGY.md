# Démo MP Nexus sur Synology

Ce projet installe uniquement la démonstration du plan 3D. Il ne se connecte pas à Home Assistant et ne contient aucune donnée de maison.

## Installation

1. Dans Container Manager, ajoutez `ghcr.io` comme registre et connectez-vous avec votre compte GitHub et un jeton personnel classique limité à `read:packages`. Le dépôt étant privé, l’image GHCR est privée elle aussi.
2. Créez un projet Container Manager nommé `mp-nexus` et choisissez le fichier `deploy/synology/compose.yaml` de ce dépôt (ou collez son contenu dans l’éditeur du projet).
3. Avant le premier déploiement, définissez `MP_NEXUS_ADMIN_PASSWORD` avec au moins 12 caractères dans les variables du projet Container Manager. Le compte administrateur initial s’appelle `admin` (modifiable avec `MP_NEXUS_ADMIN_USERNAME`). Déployez le projet puis ouvrez `http://ADRESSE-IP-DU-SYNOLOGY:8080/__mpnexus/login`. Après la création du compte, vous pouvez retirer le mot de passe initial des variables : les comptes restent dans le volume `mp-nexus-data`.
4. Connectez-vous avec `admin` et le mot de passe choisi. Dans le menu en haut, ouvrez **Utilisateurs** puis **Créer un utilisateur**. Renseignez un nom, un mot de passe provisoire d’au moins 12 caractères et le rôle **Utilisateur**. Transmettez ces identifiants à la personne ; elle devra choisir son propre mot de passe à la première connexion. La page **Utilisateurs** permet aussi de changer un rôle, réinitialiser un mot de passe ou supprimer un compte.

Après connexion, chacun choisit l’une des trois démos : **Résidentiel**, **Bureau / magasin** ou **Yacht**. Elles présentent toutes les catégories d’équipements dans un plan 3D fictif : éclairages, ouvrants, climatisation/chauffage, température et humidité, médias, présence et buanderie. Le choix ouvre directement le plan correspondant ; revenir à l’accueil permet d’en sélectionner un autre.

Chaque compte permet de suivre les connexions, ouvertures du plan et une durée de session approximative. Ces statistiques sont conservées 180 jours. Le portail ne stocke pas les adresses IP ni la localisation. Les mots de passe sont hachés ; les comptes et les clés de session restent dans le volume persistant.

Les images `linux/amd64` et `linux/arm64` sont publiées pour les Synology Intel/AMD et ARM compatibles avec Container Manager. L’application redémarre automatiquement si le NAS redémarre.

## Garder la démo à jour

GitHub publie `:latest` à chaque mise à jour de `main` et une image versionnée à chaque release. Pour appliquer une version dans Container Manager, ouvrez le projet MP Nexus, téléchargez l’image la plus récente, puis recréez le conteneur. Le portail affiche la version installée et rappelle cette procédure. Il ne reçoit aucun accès au moteur Docker du NAS. Le volume `mp-nexus-data` conserve les comptes pendant la mise à jour.

Pour que le NAS vérifie et applique automatiquement la version chaque nuit, créez dans **Panneau de configuration → Planificateur de tâches → Créer → Tâche planifiée → Script défini par l’utilisateur** une tâche exécutée quotidiennement, avec les droits permettant d’utiliser Docker. Enregistrez le fichier Compose principal dans le dossier de projet `/volume1/docker/mp-nexus`, puis utilisez ce script :

```sh
cd /volume1/docker/mp-nexus
docker compose pull
docker compose up -d
```

La première ligne doit désigner le dossier réellement choisi dans Container Manager. Si la connexion GHCR du NAS est conservée, Docker peut réutiliser ses identifiants lors des prochains téléchargements.

Cette mise à jour ne contrôle que le projet MP Nexus ; elle ne redémarre pas les autres conteneurs du NAS.

## Accès avec une adresse facile à retenir

Le port `8080` est publié sur le réseau local du NAS. Pour un accès distant, le plus simple est un domaine à toi géré par Cloudflare et un Cloudflare Tunnel. Le tunnel établit une connexion sortante depuis le NAS ; aucun port entrant n’est à ouvrir sur la box. Dans Cloudflare, créez un tunnel, ajoutez un nom public (par exemple `demo.votredomaine.fr`) qui pointe vers `http://mp-nexus:8080`, puis copiez son jeton dans `TUNNEL_TOKEN`.

Pour démarrer le tunnel depuis ce projet, ajoutez `TUNNEL_TOKEN` aux variables d’environnement du projet Container Manager, puis ajoutez `deploy/synology/compose.cloudflare.yaml` comme second fichier Compose. En ligne de commande, depuis la racine du dépôt, cela revient à :

```sh
docker compose -f deploy/synology/compose.yaml -f deploy/synology/compose.cloudflare.yaml up -d
```

Le QR code utilisera le nom d’hôte et le protocole transmis à l’application par le tunnel. `MP_NEXUS_PUBLIC_URL` peut être défini dans le projet si une adresse fixe est préférée.

Un nom de domaine doit être acheté ou déjà possédé ; le dépôt ne peut pas en créer un à votre place. Une page publiée par Tunnel est accessible aux visiteurs de ce nom. Si la démo doit rester privée, ajoutez une politique Cloudflare Access qui demande une connexion avant de choisir le nom public.

N’exposez pas le port 8080 en redirection directe sur Internet. Gardez-le limité au réseau local et passez par le tunnel pour l’accès distant.
