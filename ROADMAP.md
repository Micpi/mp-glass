# Roadmap et portes d'acceptation

## MP Spatial 0.2.0 — développement local

Vue 3D orbitale, niveaux, murs transparents, états/lumières, éditeur de contours et worker Gemini Flash-Lite pour PDF/images implémentés. Installation Supervisor et appel réel Gemini restent à valider. [Détails](docs/FLOORPLAN.md). Depuis 0.8.0 : portes, fenêtres et portes-fenêtres placées sur les murs avec volets, stores, rideaux et capteurs, téléviseurs et enceintes commandés depuis le plan. Meubles, reconnaissance des ouvertures par Gemini, manipulation graphique des sommets et undo/redo restent futurs.

## Incrément 0 — fondations

Audit, recherche API datée, architecture, modèles, ADR, registre de cartes. Documentation créée avant le code.

## Incrément 1 — lumière (travail immédiat)

Config Flow + Options Flow ; backend projet versionné ; registry reader ; graphe ; capabilities ; classification ; priorité overrides ; card registry ; strategy ; vue responsive ; Light Card POWER/DIM + fallback + editor ; réglages scan/audit ; tests unitaires/composants/build ; instance HA de développement et procédure de validation réelle.

Porte : nouvelle instance HA → installer → configurer → détecter une lumière en Salon → générer → commande de service HA effective → état HA actualisé. Un test avec doubles frontend ne valide pas cette porte. Matériel physique et Safari/iOS sont des vérifications supplémentaires explicitement consignées. Porte passée le 11 septembre 2026 sur HA 2026.9.1.

## Doctrine transversale — un seul chemin, deux profondeurs

[ADR 0006](docs/adr/0006-one-path-two-depths.md) s'applique à tous les incréments suivants : parcours unique installer → analyser → regarder → ajuster, profondeur essentielle sans jargon par défaut, profondeur expert révélée à la demande, toute action unitaire dotée d'un équivalent en masse. Chaque incrément passe deux tests réels en plus de sa porte technique : **néophyte** (dashboard pilotant ses lumières en moins de cinq minutes sans documentation, sait où sont les équipements sans pièce) et **professionnel** (50 équipements sur 10 pièces assignés en moins de trois minutes, export puis import sur instance vierge identique). Un incrément est incomplet tant que l'un des deux tests échoue.

## Incrément 1.5 — parcours guidé (avant l'extension du catalogue)

Livré en 0.10.0 :

1. Mode essentiel au lancement de Studio : trois étapes (Analyser → Pièces → Style) avec progression, « Voir le dashboard » disponible à chaque étape, plan 3D présenté comme option.
2. Libellés humains : « Sans pièce » remplace « À vérifier » ; « Pourquoi cette carte ? » en phrases ; JSON conservé sous « Données techniques ».
3. Retour visuel : indicateur d'analyse en cours, aperçu avant enregistrement, annulation de la dernière modification.
4. Passage à l'échelle : sélection multiple, filtre par type et recherche, « Pièce pour la sélection » et « Masquer la sélection » ; export/import du projet depuis Studio avec résumé des différences ; conflit de sauvegarde résolu sans perte (reprendre la version enregistrée ou conserver ses modifications).
5. Bascule « Mode expert » persistante par utilisateur révélant les huit sections.

Porte : les tests néophyte et professionnel sont automatisés sur doubles (`tests/browser/settings.spec.ts`) ; leur passage sur instance réelle reste à consigner dans VALIDATION.md avant de déclarer l'incrément clos.

## Incrément 2 — terminer MVP 1

Climate, puis Cover, puis TV + Remote ; association avec preuves ; popup natif ; Home synthétique ; Alarm ; Camera lazy ; Floorplan de base ; wizard complet ; preview ; préférences personnelles. Aucun trackpad si l'adapter ne déclare pas les commandes/gestes réels. Chaque domaine livre le chemin complet de l'ADR 0006 (découverte, révision, explication, carte, fallback, locale) et repasse les deux tests UX avec des équipements mixtes.

## Phase 2

Familles covers/curtains, locks/security, PTZ/doorbell, multiroom, énergie et MP Spatial WYSIWYG. SVG sécurisé, géométrie normalisée, historique undo/redo, couches et interactions accessibles.

## Phase 3

EV, piscine, irrigation, vacuum/mower, appareils et réseau, templates sans entity_id, visibilité adaptative. Dataset 3 floors/18 areas et tous les équipements du cahier des charges ; cas limites et benchmark 20/100/500/1000 entités.

## Phase 4

Bibliothèque intégrateur, presets supplémentaires, documentation marketplace, adapters optionnels. Compatibilité multi-version, revue confidentialité et livraison HACS stable.

## Release

SemVer, changelog, artifact déterministe, CI lint/typecheck/unit/component/build/hassfest/HACS. Pas de publication stable si CI rouge ou porte réelle non passée. Le dossier actuel n'a pas de remote produit : artifact local ne signifie pas release HACS publiée.
