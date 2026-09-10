# Project Config Schema

Schéma initial version 1, validé avec le même JSON Schema côté TypeScript et Python.

```json
{
  "schema_version": 1,
  "project": {"name": "Maison"},
  "appearance": {"preset": "glass-blue"},
  "roles": {},
  "overrides": {}
}
```

`roles` mappe un identifiant choisi à une référence stable. `overrides` mappe l'identifiant stable d'entité à `{name?, areaId?, hidden?, presentation?}` ; `presentation` vaut light ou generic dans ce premier incrément. Une présentation light sur un domaine incompatible est ignorée avec diagnostic. Aucun override ne crée un service ou une capability.

Le schéma ferme les objets et refuse champs secrets, extensions arbitraires, valeurs non finies et versions futures. L'import applique une validation complète, sans ignorer silencieusement les données. Les exports ne sérialisent jamais les registries, states, credentials ou préférences individuelles.

Le backend Store conserve `{revision, project}`. Save exige la révision lue : une édition concurrente est refusée explicitement. L'API projet est administrateur pour l'écriture ; lecture via utilisateur HA authentifié. Les rescan/regenerate ne modifient jamais le projet. La v1 ne comporte pas de migration artificielle v2/v3 : chaque changement réel aura une migration explicite testée et un backup avant activation. Draft/publish et rollback multi-version sont planifiés, pas simulés.

Évolution prévue : navigation, profils de visibilité, floorplans, zones HYBRID. Ne pas les accepter avant d'avoir défini et testé leur contrat. Source normative : `shared/project.schema.json`.
