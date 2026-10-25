# Music Assistant dans MP Nexus

MP Nexus peut maintenant dialoguer directement avec le serveur Music Assistant tout en gardant l'intégration officielle Home Assistant pour les lecteurs, les volumes et le multiroom.

## Fonctions

- albums, artistes, morceaux, playlists, radios et podcasts de la bibliothèque ;
- recherche dans la bibliothèque et les fournisseurs connectés ;
- vraies pochettes servies par un proxy authentifié MP Nexus ;
- lecture immédiate, ajout en suivant ou en fin de file ;
- file complète, choix d'un morceau, suppression et vidage ;
- commandes de lecture et groupes multiroom via les entités Music Assistant de Home Assistant.

## Configuration

1. Installer et configurer Music Assistant ainsi que son intégration officielle dans Home Assistant.
2. Dans Music Assistant, ouvrir le profil utilisateur et créer un jeton longue durée.
3. Dans Home Assistant, ouvrir **Paramètres → Appareils et services → MP Nexus → Configurer**.
4. Activer **Moteur Music Assistant intégré**.
5. Indiquer l'adresse directe du serveur Music Assistant, par exemple `http://homeassistant.local:8095`, puis coller le jeton.

L'adresse de la page latérale Home Assistant ou une adresse `ingress` ne convient pas : MP Nexus doit joindre l'API Music Assistant depuis Home Assistant.

## Sécurité

Le jeton reste dans les options de l'intégration et n'est jamais envoyé au navigateur. Les pochettes passent par une route Home Assistant authentifiée. Un invité MP Nexus en lecture seule peut consulter les médias, mais les commandes de lecture et de file sont aussi refusées côté serveur.
