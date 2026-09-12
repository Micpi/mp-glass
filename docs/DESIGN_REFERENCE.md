# Direction visuelle — références utilisateur du 11 septembre 2026

Les quatre images Maison Madeiras fournies par l'utilisateur sont des références de composition et de style. Leurs noms, températures, scènes, compteurs, localisation et état de sécurité ne sont pas des données Home Assistant et ne doivent jamais être injectés comme états réels.

## Principes retenus

- Fond photographique architectural au crépuscule, cadrage adapté par orientation et voile sombre pour la lisibilité.
- Verre teinté bleu nuit, bord fin clair et highlight discret. Accent bleu pour sélection ; jaune pour lumière active ; vert seulement pour état normal réellement établi.
- Titres éditoriaux à empattements pour l'identité et l'accueil ; typographie sans empattements pour les contrôles et valeurs.
- Navigation horizontale compacte sur tablette/desktop, navigation accessible au pouce sur téléphone.
- Accueil composé de synthèses et actions rapides. Les sliders individuels appartiennent aux détails, pas à une accumulation de cartes sur l'accueil.
- Desktop paysage : bandeau compact et quatre familles principales, puis scènes/événements. Tablette portrait : deux colonnes. Téléphone : priorité aux états et actions ; ne pas reproduire les grands espaces décoratifs au détriment du contrôle.

## Frontière framework / chantier

Identité, fond, choix de preset et textes d'accueil configurables. Aucune référence obligatoire à Madeiras, aucune météo de démonstration dans un dashboard réel, aucun « tout est en ordre » sans couverture connue des capteurs concernés. Les familles absentes disparaissent.

Le build 0.1.0 valide d'abord le parcours lumière et ne prétend pas encore reproduire cette direction visuelle. Prochain incrément UI après validation du backend : shell d'accueil, résumé lumière, navigation responsive, identité/fond projet et ouverture des contrôles détaillés.
