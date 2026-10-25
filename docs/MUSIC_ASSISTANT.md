# Music Assistant dans MP Nexus

MP Nexus utilise directement l'intégration officielle Music Assistant de Home Assistant. Il n'y a ni adresse de serveur ni jeton à saisir dans MP Nexus.

## Fonctions

- albums, artistes, morceaux, playlists, radios et podcasts de la bibliothèque ;
- recherche dans la bibliothèque et les fournisseurs connectés ;
- vraies pochettes servies par un proxy authentifié MP Nexus ;
- lecture immédiate, ajout en suivant ou en fin de file ;
- file complète, choix d'un morceau, suppression et vidage ;
- commandes de lecture et groupes multiroom via les entités Music Assistant de Home Assistant.

## Configuration

1. Installer et configurer Music Assistant ainsi que son intégration officielle dans Home Assistant.
2. Dans Home Assistant, ouvrir **Paramètres → Appareils et services**. Music Assistant est normalement proposé dans les découvertes : toucher **Configurer**. Sinon, choisir **Ajouter une intégration**, rechercher Music Assistant et indiquer l'adresse locale du serveur.
3. Ouvrir MP Nexus : les lecteurs et la bibliothèque apparaissent automatiquement dans **Multimédia**.

## Sécurité

MP Nexus ne stocke plus aucun jeton Music Assistant. Les requêtes passent par les actions authentifiées de Home Assistant et les pochettes par une route Home Assistant authentifiée. Un invité MP Nexus en lecture seule peut consulter les médias, mais les commandes sont aussi refusées côté serveur.
