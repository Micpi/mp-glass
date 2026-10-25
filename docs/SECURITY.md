# Sécurité et confidentialité

Local par défaut, aucun CDN ni télémétrie d'application. JS statique public sans données d'installation. Project Config servi uniquement via le WebSocket HA authentifié ; écritures protégées par require_admin. Les commandes passent par callService dans l'identité courante, sans proxy backend privilégié.

Schéma fermé partagé ; aucune propriété token/PIN/password acceptée dans les structures de configuration. L'utilisateur peut écrire un secret dans un champ texte libre : ce n'est pas détectable de façon fiable ; ces champs ne doivent servir qu'aux noms du chantier. Les diagnostics ne contiennent ni noms, ni états, ni mappings. L'export projet contient les noms/mappings choisis et reste privé.

Lit échappe le contenu des noms. Pas d'innerHTML utilisateur ni d'assets importés au premier incrément. Le support futur SVG/plan/caméra impose un travail de sécurité spécifique avant disponibilité.

Protection de concurrence : révision attendue + verrou serveur + sauvegarde avant remplacement du record en mémoire. Aucune mise à jour du projet lors d'un simple rescan.

Limites de validation : les permissions effectives doivent être testées avec comptes HA réel admin/non-admin ; l'absence de contournement dans l'architecture ne constitue pas une preuve d'exécution.

## Mode kiosque

MP Nexus s’affiche en plein écran, sans la barre ni le menu de Home Assistant. Les utilisateurs non administrateurs sont ramenés sur le tableau de bord MP Nexus depuis toute autre page de l’interface ; la commande `mp_glass/kiosk` leur donne seulement l’adresse de ce tableau de bord (jamais un tableau réservé aux administrateurs). Les administrateurs ne sont jamais redirigés et peuvent quitter le kiosque pour l’onglet en cours.

C’est une règle d’interface, pas une frontière de sécurité : un utilisateur connecté garde l’accès que Home Assistant lui donne par son API (WebSocket, REST). Pour limiter ce qu’une personne peut faire, utilisez ses droits : « Lecture seule » pour un invité, jamais administrateur pour un écran partagé.

## Invités par lien ou QR code

**Plus → Utilisateurs** (administrateurs) crée des invités permanents ou temporaires. Chaque invité est un utilisateur Home Assistant ordinaire, du groupe Lecture seule ou Utilisateurs, jamais administrateur ni propriétaire. Home Assistant n'a pas de droits par appareil : un invité « Peut commander » peut tout commander, y compris ce que MP Nexus masque. Un invité temporaire est en lecture seule et limité au réseau de la maison (`local_only`) par défaut.

- **Invitation** : 256 bits aléatoires (`secrets.token_urlsafe(32)`), dont seule l'empreinte SHA-256 est enregistrée (`.storage/mp_glass_guests`). Usage unique, 15 minutes pour un QR code, 24 heures pour un lien, jamais au-delà de la fin d'un accès temporaire. Une nouvelle invitation remplace la précédente.
- **Transport** : l'invitation est placée après `#` dans l'adresse (`/mp-nexus-invite?to=…#…`) ; les navigateurs n'envoient jamais cette partie au serveur, aux proxys ni au site suivant. La page l'efface de l'adresse dès son ouverture (`history.replaceState`), puis l'envoie en POST à `/api/mp_glass/invite`.
- **Échange** : seule vue sans authentification. Elle vérifie l'empreinte, l'expiration, que l'utilisateur est toujours un invité actif non administrateur, puis la règle `local_only` de Home Assistant (`async_user_not_allowed_do_auth`) et exige HTTPS hors du réseau local. L'invitation est effacée avant la création de la session : un jeton de rafraîchissement normal (90 jours, client « Invitation MP Nexus ») et un jeton d'accès de 30 minutes, déposés dans `hassTokens` du navigateur. 5 échecs par adresse en une minute bloquent cette adresse 10 minutes. Une notification Home Assistant signale chaque connexion par invitation.
- **Page** : HTML autonome avec `Content-Security-Policy` stricte, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Cache-Control: no-store`. La destination `to` n'accepte qu'un chemin de cette instance. Si le navigateur porte déjà une session, la page demande avant de la remplacer.
- **Fin d'accès** : à la date de fin (vérifiée chaque minute et au démarrage) ou sur « Arrêter l'accès », l'utilisateur est désactivé, ce qui supprime toutes ses sessions. « Supprimer » retire l'utilisateur de Home Assistant.
- **Repli** : « Mot de passe » crée un identifiant du fournisseur Home Assistant avec un mot de passe généré (16 caractères), affiché une seule fois, pour la page de connexion normale.
- **Proxy** : derrière un proxy ou un tunnel sans `use_x_forwarded_for` / `trusted_proxies`, Home Assistant voit toutes les connexions comme locales et `local_only` ne protège plus. L'écran Utilisateurs le détecte (`/api/mp_glass/guests/probe`) et l'affiche.
- **Dépendance** : `hassTokens` est le format de stockage du frontend Home Assistant. S'il change, l'échange réussit mais le navigateur n'est pas connecté : le repli par mot de passe reste disponible.
