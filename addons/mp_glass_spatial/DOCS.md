# Installer MP Glass Spatial

**Le plus simple avec Gemini : ne pas installer cet add-on.** Depuis MP Glass 0.2.1, une clé API dans les options de l’intégration suffit. [Parcours en trois étapes](../../docs/GEMINI_QUICKSTART.md).

Les instructions ci-dessous concernent uniquement le mode avancé avec conversion locale. Dans les options MP Glass, choisir **Add-on Spatial — avancé** pour afficher les champs adresse et clé de liaison.

L’add-on traite les documents et appelle Gemini. L’import, la correction et la consultation se trouvent dans MP Glass Studio, sans interface Ingress séparée ni accès du worker à l’API HA.

## Avec Supervisor

1. Copier ce dossier dans `/addons/mp_glass_spatial` sur HA, avec les fichiers Python, le schéma JSON, `requirements.txt`, `Dockerfile` et `config.yaml`.
2. Paramètres → Modules complémentaires / Apps → Boutique → rechercher les mises à jour, puis installer **MP Glass Spatial** dans les add-ons locaux.
3. Renseigner `gemini_api_key` avec une clé créée dans [Google AI Studio](https://aistudio.google.com/api-keys). Choisir un projet Google sans facturation activée pour rester dans les quotas gratuits.
4. Conserver `model: gemini-3.8-flash` (le plus précis), ou `gemini-3.5-flash-lite` (plus rapide) : seuls les modèles Flash sont acceptés. Une installation existante garde sa valeur, à mettre à jour.
5. Choisir `api_token`, clé de liaison aléatoire d’au moins 24 caractères, distincte de la clé Gemini. La recopier dans les options de l’intégration MP Glass.
6. Démarrer. Garder le port hôte vide : l’adresse interne d’une installation locale est `http://local-mp-glass-spatial:8099`.
7. Paramètres → Appareils et services → MP Glass → Configurer : renseigner cette adresse et la clé de liaison.
8. Ouvrir MP Glass Studio → Plan 3D.

Internet est nécessaire pour construire l’image et appeler Google. Aucun modèle local ni GPU requis.

## Home Assistant Container

Utiliser `compose.spatial.yaml`, créer `spatial-options.json` avec les options ci-dessous, puis construire et démarrer le worker. Adapter le réseau pour que HA puisse le joindre. Le Compose de développement expose seulement `127.0.0.1:8099`, inaccessible depuis une autre machine ou un autre conteneur.

```json
{
  "gemini_api_key": "CLE_API_GOOGLE",
  "model": "gemini-3.8-flash",
  "api_token": "CLE_DE_LIAISON_ALEATOIRE_24_CARACTERES_MINIMUM"
}
```

Ce fichier de secrets est exclu de Git.

## Dépannage

- `not_configured` : clé de liaison manquante/trop courte ou options de l’intégration incomplètes.
- `worker_unavailable` : adresse, démarrage ou clé de liaison incorrects.
- `provider_auth` : clé Gemini absente/refusée.
- `quota` : quota Google atteint ; aucun nouvel appel automatique.
- `invalid_file` : format, signature, page, dimensions ou temps de conversion refusés.
- `invalid_geometry` : résultat IA incohérent ; essayer une source plus lisible ou corriger manuellement.

Plans et réponses Gemini ne sont pas journalisés. Seule la géométrie enregistrée dans le Studio persiste côté HA. L’arrêt du worker n’empêche pas d’afficher ce plan.

Paquet préparé localement : installation Supervisor et premier appel Gemini réel restent à valider.
