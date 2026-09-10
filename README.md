# MP Glass

**Install. Discover. Personalize. Deploy.**

Framework de dashboards Home Assistant : configurer une installation, puis déduire son interface à partir des pièces, des appareils et de leurs capacités.

**État : premier incrément de développement 0.1.0, non publié.** Le parcours lumière est implémenté et testé localement. L'installation et le contrôle sur une instance HA réelle restent à valider ; le MVP complet n'est pas annoncé terminé.

![Aperçu de la fixture desktop](tests/browser/light.spec.ts-snapshots/desktop-win32.png)

Cette image montre une fixture de développement, pas une maison cliente. [Résultats et limites des tests](docs/VALIDATION.md).

## Contenu actuel

- Backend Home Assistant : Config Flow, Options Flow, stockage projet validé, API authentifiée et diagnostics limités aux compteurs.
- Core TypeScript indépendant : normalisation, capacités lumière, classification explicable, overrides, registre de cartes et composition déterministe.
- Frontend : stratégie MP Glass Dashboard, vue responsive, carte lumière marche/arrêt et luminosité, fallback, editor, panneau de découverte et apparence.
- Six presets : Glass Blue, Warm, Dark, Light, OLED et Neutral. La direction photographique premium et le wizard complet restent au programme.

## Installer et créer un premier dashboard

Voir [INSTALL](docs/INSTALL.md) et [QUICKSTART](docs/QUICKSTART.md). Minimum cible HA 2026.6 ; instance de développement épinglée sur 2026.9.1. Il ne s'agit pas encore d'une compatibilité certifiée.

Après copie du composant et redémarrage HA : ajouter l'intégration MP Glass, ouvrir MP Glass, analyser, enregistrer, puis ajouter **MP Glass Dashboard** dans le dialogue des dashboards communautaires. Le module est fourni avec l'intégration. Aucun YAML chantier n'est nécessaire pour ce parcours.

## Développement

```sh
npm install
npm run dev
npm test
npm run build
npm run test:e2e
```

`npm run dev` ouvre une fixture locale. Pour un vrai serveur HA isolé : `pwsh -File scripts/dev-ha.ps1` avec Docker Engine actif. Ne pas confondre ces deux environnements.

## Documentation

[Architecture](ARCHITECTURE.md) · [Home Graph](DATA_MODEL.md) · [Capabilities](CAPABILITY_MODEL.md) · [Projet](PROJECT_CONFIG.md) · [Roadmap](ROADMAP.md) · [ADR](docs/adr/) · [Cards](docs/CARDS.md) · [Découverte](docs/DISCOVERY.md) · [Intégrateur](docs/INTEGRATOR.md) · [Sécurité](docs/SECURITY.md) · [Développement](docs/DEVELOPMENT.md).

Climate → Cover → TV/Remote suivent la validation réelle lumière. MP Spatial, catalogue complet, templates, hybrid mode et draft/publish sont définis dans la roadmap, pas inclus dans ce build.
