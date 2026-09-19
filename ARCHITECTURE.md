# MP Nexus — architecture

Statut : architecture cible avec premier incrément lumière. La roadmap distingue les composants livrés et futurs.

Extension 0.2.0 : `frontend/spatial` ajoute Three.js chargé à la demande et l’édition de `project.spatial`. L’intégration reçoit les imports HTTP administrateur et expose le suivi WebSocket. `addons/mp_glass_spatial` isole la conversion et Gemini Flash-Lite, sans token HA ni accès aux entités/services. Son absence n’empêche pas d’afficher un plan enregistré. [Contrat et parcours](docs/FLOORPLAN.md).

Depuis 0.2.1, l’intégration propose Gemini direct par défaut : entrée binaire bornée, vérification de signature sans décodage dans Core, appel asynchrone Google, validation du JSON. La clé reste dans les options HA. L’add-on reste un mode avancé explicite pour rasteriser localement ; aucune bascule entre fournisseurs n’est déclenchée en cas d’erreur.

## Frontières

```text
HA registries / states / services
  → HARegistryReader (frontend, session HA courante)
  → MPDiscoveryEngine → MPHomeGraph
  → MPCapabilityEngine → classification avec preuves
  → logical resolver → overrides projet
  → MPCardRegistry / MPPresentationResolver
  → MPDashboardComposer → strategy custom:mp-glass
  → custom view / cards → HA callService (identité utilisateur)
```

`shared/` : TypeScript pur, sans DOM, marque, appel réseau ou stockage. Données structurelles séparées des valeurs runtime. `frontend/ha/` : frontière API HA et cache par connexion. `frontend/cards/` : présentation et commandes contrôlées. `custom_components/mp_glass/` : Config Flow, Options Flow, stockage versionné, API projet authentifiée et assets publics sans données privées. Les écritures projet sont administrateur seulement. Les commandes restent natives HA et ne passent pas par un proxy privilégié.

## Installation

Un paquet HACS Integration contient le JS compilé. Le backend charge le module globalement ; la stratégie s'enregistre dans le sélecteur communautaire. L'utilisateur ajoute MP Nexus Dashboard dans l'interface native. Pas d'écriture directe dans `.storage/lovelace*`. Cette frontière évite une API privée de création de dashboards.

## Durabilité

Overrides, rôles et plans appartiennent au projet persistant, jamais à la sortie générée. IDs registry prioritaires ; une entité sans registry a une référence provisoire `state:<entity_id>` explicitement instable en cas de renommage. Les relations parent/enfant restent des arêtes ; elles ne prouvent pas qu'il faut fusionner les appareils. Configuration rejetée si son schéma est futur ; aucune rétrogradation destructive.

## Rendering et performance

Lit et CSS tokens locaux, sans CDN. Custom view documentée : HA crée et maintient ses cartes, MP Nexus les dispose. Cache structurel invalidable, aucun scan déclenché par une lumière qui change. Chaque carte compare sa propre référence d'état. Le premier incrément fournit lumière et fallback ; les autres domaines arrivent après validation du parcours lumière.

## Modes

MANAGED est le premier mode. MANUAL utilise la même Light Card avec editor. HYBRID est réservé à un incrément ultérieur : zones personnalisées persistantes avec validation, sans réécriture du générateur. Les préférences individuelles seront isolées par utilisateur et appareil, hors Project Config.

## Risques et inconnues

1. Évolution HA : compatibilité ciblée 2026.6+, stable consultée 2026.9 ; support annoncé uniquement après tests des versions exactes.
2. Enregistrement global du module : helper backend encapsulé, unload et cache à vérifier sur instance.
3. Lecture registry : refus possible selon droits ; ne jamais convertir une permission refusée en scan vide réussi.
4. IDs sans registry, changements d'area, parent devices : ambiguïtés visibles et overrides conservés.
5. Installation HACS : nécessite un dépôt produit dédié et les validations distantes.
6. Floorplan SVG : avant upload, décider sanitisation/rasterisation, limites de taille et distribution authentifiée. Aucun SVG utilisateur injecté directement.
7. Accessibilité, Safari et performance murale : tests réels requis, pas de certification déduite des media queries.

Voir `docs/adr/`, `docs/HA_API_RESEARCH.md`, `DATA_MODEL.md`, `CAPABILITY_MODEL.md`, `PROJECT_CONFIG.md`.
