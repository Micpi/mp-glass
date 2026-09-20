# Card Registry

Source : `shared/presentation.ts`. Un descripteur porte type Lovelace, catégories, capabilities requises, priorité et variantes réellement disponibles. Résolution par correspondance de catégorie/capabilities, priorité décroissante et ordre lexical stable. Enregistrement doublon refusé ; fallback obligatoire.

La priorité d'un override de présentation ne permet jamais une fonction incompatible : le domain source et les capabilities gardent leur autorité. Le composer ne connaît ni modèle constructeur ni DOM. Ajouter une carte implique un descripteur et son Web Component, pas une condition supplémentaire dans le layout.

Livré au premier incrément : `custom:mp-glass-light` (POWER/DIM) et `custom:mp-glass-generic` (état et fenêtre Détails). `getEntitySuggestion` ne suggère Light que pour le domain light. Generic n'envahit pas le picker. L'editor utilise `ha-selector` lorsqu'il existe déjà ; sinon un select HTML alimenté par les états accessibles, sans chargement de composant HA privé.
