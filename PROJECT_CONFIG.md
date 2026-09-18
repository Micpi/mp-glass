# Project Config Schema

Le schéma courant est la version 2. Le même JSON Schema strict valide les données dans TypeScript et dans l'intégration Python.

```json
{
  "schema_version": 2,
  "project": {"name": "Maison"},
  "appearance": {
    "preset": "glass-blue",
    "accent": "#69b7ff",
    "secondaryAccent": "#efbd8b",
    "glassTint": "#12344f",
    "glassOpacity": 0.62,
    "glassBlur": 22,
    "borderStrength": 0.2,
    "shadowStrength": 0.35,
    "radius": 22,
    "backgroundDim": 0.44,
    "backgroundPosition": "right",
    "backgroundBlur": 0,
    "backgroundSaturation": 1,
    "density": "comfortable",
    "fontStyle": "elegant",
    "iconStyle": "tile",
    "cardStyle": "standard",
    "cardColumns": 4,
    "cardGap": 12,
    "maxWidth": 1560,
    "heroHeight": 455,
    "motion": true,
    "showHero": true,
    "showClock": true,
    "showOverview": true,
    "showFooter": true,
    "showSettingsShortcut": true,
    "showCardDetails": true,
    "showBrightness": true,
    "eyebrow": "Une maison plus simple à vivre",
    "subtitle": "Vos équipements sont prêts, pièce par pièce.",
    "quote": "Les plus beaux moments commencent à la maison.",
    "sectionTitle": "Lumières",
    "sectionSubtitle": "Contrôle rapide de tous les éclairages détectés"
  },
  "navigation": {
    "items": ["home", "lights", "rooms"],
    "showLabels": true
  },
  "roles": {},
  "overrides": {}
}
```

`appearance` est partagé par le chantier. `backgroundUrl` accepte uniquement une image servie par Home Assistant avec `/local/...` ou `/api/image/...`. Les valeurs numériques sont bornées par le schéma afin qu'une saisie ne puisse pas casser la mise en page. Les préférences personnelles futures restent séparées.

`navigation.items` contient une à trois destinations uniques. Le composer crée toujours les routes techniques requises ; ce tableau contrôle les destinations affichées dans l'en-tête et leur ordre. Les pages de pièce utilisent les identifiants stables des Area Registry.

`roles` mappe un rôle à une référence stable. `overrides` mappe l'identifiant stable d'entité à `{name?, areaId?, hidden?, presentation?}`. Les overrides passent après la découverte et survivent aux rescans.

Le schéma ferme tous les objets et refuse les champs secrets, les extensions arbitraires et les versions futures. L'export ne contient ni registries, ni states, ni credentials, ni préférences individuelles.

Le backend conserve `{revision, project}`. Une sauvegarde exige la révision lue et refuse une édition concurrente. Le passage v1 → v2 complète l'apparence et ajoute la navigation en conservant le nom, le preset, les rôles et les overrides.

Source normative : `shared/project.schema.json`.

Depuis 0.2.0, `spatial` est optionnel dans ce schéma v2 : `{version:1, enabled:true, floors:[...]}`. Géométrie en mètres, niveaux, pièces polygonales, `areaId` facultatif et liste `entityIds` facultative. Depuis 0.7.0, une pièce avec `areaId` et sans `entityIds` suit sa zone : ses équipements sont calculés à la génération du dashboard (mêmes overrides que les pages de pièce), jamais enregistrés ; `entityIds` est une liste choisie à la main. Depuis 0.8.0, une pièce peut porter `openings` (portes et fenêtres sur ses côtés, avec leurs volets et capteurs) et `media` (téléviseurs et enceintes placés, avec leur lecteur) : voir [Contrat](docs/FLOORPLAN.md#contrat-et-confidentialité). Aucun fichier source, clé API ou état runtime. La validation géométrique complète le JSON Schema. Voir `shared/spatial.schema.json` et [MP Spatial](docs/FLOORPLAN.md).
