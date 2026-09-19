# ADR 0006 — un seul chemin, deux profondeurs

Date : 2026-09-19. Statut : retenu. Complète l'ADR 0004.

## Objectif produit

MP Nexus doit être aussi simple pour un néophyte que pour un professionnel : l'interface domotique de référence, pas un outil d'expert avec un mode facile ni un jouet avec un mode avancé. Cet ADR fixe la doctrine qui départage toute décision de conception à venir.

## Décision

Il n'existe qu'un seul parcours : **installer → analyser → regarder → ajuster**. Chaque écran de ce parcours possède deux profondeurs :

1. **Essentiel** — visible par défaut. Zéro terme technique (`entity_id`, capability, evidence, strategy, override, schéma), un choix à la fois, un résultat immédiat, un bouton « Suivant » ou « C'est fait ». Un néophyte termine sans documentation.
2. **Expert** — même écran, révélé par un geste explicite (« Afficher plus », `details/summary`, bascule persistante « Mode expert » par utilisateur). Rien n'est caché au professionnel ; rien n'est imposé au néophyte.

Le mode expert ne remplace jamais le mode essentiel par un écran différent. Les deux profondeurs manipulent le même `project` et produisent le même dashboard : le professionnel corrige en masse ce que le néophyte corrige à l'unité.

## Règles

1. **Défaut fonctionnel.** Après « Analyser », le dashboard généré est utilisable sans aucune correction. Une entité non classée ou sans pièce n'est jamais une erreur : elle est visible, groupée sous un libellé humain (« Sans pièce »), et le dashboard s'affiche quand même.
2. **Vocabulaire humain d'abord.** Les libellés de premier niveau sont des mots du quotidien : pièce, équipement, lumière, volet, plan. Les identifiants techniques apparaissent en second niveau, en texte secondaire. Toute nouvelle chaîne de locale est relue selon cette règle avant merge.
3. **Expliquer, pas afficher.** Une décision automatique (classification, pièce déduite, appariement plan ↔ pièce) se justifie par une phrase (« Détecté comme lumière car Home Assistant le déclare ainsi »), et non par un code (`domain:light`). Le JSON brut reste disponible en profondeur expert.
4. **Réversible.** Toute modification dans Studio se prévisualise avant enregistrement et peut être annulée après. Aucun écran ne demande de « recharger pour perdre vos modifications ».
5. **Le professionnel passe à l'échelle.** Toute action unitaire (assigner une pièce, masquer, renommer) a un équivalent en masse (sélection multiple, filtre, appliquer à la sélection) et un équivalent hors interface (export/import du projet, modèle réutilisable). Un intégrateur configure 50 équipements en moins de trois minutes.
6. **Un nouveau domaine = le chemin complet.** Ajouter climate, cover ou media ne consiste pas seulement à créer une carte : la découverte, la révision, l'explication, la carte, le fallback et la locale doivent respecter les règles 1 à 5. Aucun domaine n'est annoncé livré sans ce parcours.
7. **Le plan 3D est un bonus.** Il n'est jamais requis pour obtenir un dashboard complet et n'apparaît jamais comme étape bloquante du parcours essentiel.

## Porte d'acceptation UX

Chaque incrément passe, en plus de sa porte technique, deux tests réels sur instance Home Assistant :

- **Test néophyte** : une personne sans connaissance HA, sans documentation, installe et obtient un dashboard qui pilote ses lumières en moins de cinq minutes, et sait dire où sont les équipements non assignés.
- **Test professionnel** : un intégrateur assigne 50 équipements répartis sur 10 pièces en moins de trois minutes, exporte le projet, le réimporte sur une instance vierge et obtient le même dashboard.

Un incrément dont l'un des deux tests échoue n'est pas terminé, même si CI et porte technique sont vertes.

## Conséquences

- La roadmap accueille un Incrément 1.5 « parcours guidé » avant l'extension du catalogue (voir ROADMAP.md) : onboarding au premier lancement de Studio, libellés humains, indicateur de progression, sélection multiple et export/import.
- Studio évolue vers une entrée unique « Essentiel » (analyser, vérifier les pièces, choisir un style, voir le dashboard) ; les huit sections actuelles deviennent la profondeur expert.
- Les 20+ curseurs d'apparence restent, mais derrière les préréglages : « choisir un style » suffit au néophyte.
- Les codes d'évidence reçoivent des libellés traduits ; le JSON reste dans `details`.
- Toute revue de code peut refuser un changement au motif « viole ADR 0006 » avec la règle citée.
