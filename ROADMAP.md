# Roadmap et portes d'acceptation

## MP Spatial 0.2.0 — développement local

Vue 3D orbitale, niveaux, murs transparents, états/lumières, éditeur de contours et worker Gemini Flash-Lite pour PDF/images implémentés. Installation Supervisor et appel réel Gemini restent à valider. [Détails](docs/FLOORPLAN.md). Meubles, portes/fenêtres, manipulation graphique des sommets et undo/redo restent futurs.

## Incrément 0 — fondations

Audit, recherche API datée, architecture, modèles, ADR, registre de cartes. Documentation créée avant le code.

## Incrément 1 — lumière (travail immédiat)

Config Flow + Options Flow ; backend projet versionné ; registry reader ; graphe ; capabilities ; classification ; priorité overrides ; card registry ; strategy ; vue responsive ; Light Card POWER/DIM + fallback + editor ; réglages scan/audit ; tests unitaires/composants/build ; instance HA de développement et procédure de validation réelle.

Porte : nouvelle instance HA → installer → configurer → détecter une lumière en Salon → générer → commande de service HA effective → état HA actualisé. Un test avec doubles frontend ne valide pas cette porte. Matériel physique et Safari/iOS sont des vérifications supplémentaires explicitement consignées.

## Incrément 2 — terminer MVP 1

Climate, puis Cover, puis TV + Remote ; association avec preuves ; popup natif ; Home synthétique ; Alarm ; Camera lazy ; Floorplan de base ; wizard complet ; preview ; préférences personnelles. Aucun trackpad si l'adapter ne déclare pas les commandes/gestes réels.

## Phase 2

Familles covers/curtains, locks/security, PTZ/doorbell, multiroom, énergie et MP Spatial WYSIWYG. SVG sécurisé, géométrie normalisée, historique undo/redo, couches et interactions accessibles.

## Phase 3

EV, piscine, irrigation, vacuum/mower, appareils et réseau, templates sans entity_id, visibilité adaptative. Dataset 3 floors/18 areas et tous les équipements du cahier des charges ; cas limites et benchmark 20/100/500/1000 entités.

## Phase 4

Bibliothèque intégrateur, presets supplémentaires, documentation marketplace, adapters optionnels. Compatibilité multi-version, revue confidentialité et livraison HACS stable.

## Release

SemVer, changelog, artifact déterministe, CI lint/typecheck/unit/component/build/hassfest/HACS. Pas de publication stable si CI rouge ou porte réelle non passée. Le dossier actuel n'a pas de remote produit : artifact local ne signifie pas release HACS publiée.
