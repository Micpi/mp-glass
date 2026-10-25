# Musique dans MP Nexus

MP Nexus s'appuie sur Music Assistant, mais l'utilisateur n'a jamais à le configurer : tout se fait depuis **Multimédia → Pour vous**.

## Activer la musique (administrateur, une seule fois)

1. Toucher **Activer la musique**.
2. MP Nexus ajoute si besoin le dépôt Music Assistant au Superviseur, installe l'application, la démarre et confirme la découverte de l'intégration Home Assistant. Compter environ une minute ; l'écran peut être quitté.
3. Les enceintes Sonos, Google Cast, AirPlay et DLNA sont trouvées automatiquement.

Sur une installation sans Superviseur (Docker, Core), installer Music Assistant à part et ajouter son intégration : MP Nexus la reprend automatiquement.

## Connecter un service

Toucher le service dans la grille :

| Service | Connexion |
| --- | --- |
| Spotify (Premium), Apple Music, Tidal, Plex | page de connexion officielle, ouverte par un bouton |
| Qobuz, SoundCloud | identifiants dans un formulaire MP Nexus |
| Deezer, YouTube Music | clé à copier depuis le site, guide affiché |
| Radios | aucune |

La page de connexion revient vers Music Assistant sur le réseau local : connecter les services depuis la maison. « Mes services » signale un compte à reconnecter et le relance en une touche.

## Écouter

La recherche et « Ma bibliothèque » (albums, artistes, morceaux, playlists, radios, podcasts) apparaissent dès que la musique est prête : lecture immédiate, à la suite ou en fin de file, vraies pochettes, file complète.

## Sécurité

- MP Nexus ne stocke aucune adresse ni aucun jeton Music Assistant. L'installation passe par le Superviseur avec des commandes réservées aux administrateurs.
- La connexion des services utilise, comme le panneau officiel de Music Assistant, une session d'ingress Home Assistant : Music Assistant reconnaît l'administrateur Home Assistant. Les mots de passe des services ne transitent pas par MP Nexus pour les connexions par page officielle.
- Les invités MP Nexus en lecture seule peuvent consulter les médias ; les commandes leur sont refusées côté serveur.
