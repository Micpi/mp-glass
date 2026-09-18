# MPHomeGraph

Le snapshot HA est une entrée, pas une configuration de chantier.

| Objet | Identifiant | Données |
| --- | --- | --- |
| Floor | floor_id | nom, niveau, labels éventuels |
| Area | area_id | nom, floor_id, icône, image |
| SourceDevice | registry id | area_id, fabricant, modèle, via_device_id, relations supplémentaires conservables |
| Entity | registry id, sinon state:entity_id | entity_id courant, domain, device, area, disabled, hidden |
| LogicalDevice | logical:<stable entity id> initialement | source IDs, entités, area, catégorie, confidence, preuves, capabilities, `planKind` (lumière, volet, thermostat, température, humidité, lecteur multimédia, ouverture, présence ; absent pour le diagnostic et les réglages) |
| Role | identifiant projet | référence stable vers logical device ou entity |
| Floorplan | identifiant projet | niveaux et pièces en mètres (`project.spatial`) ; par pièce, portes et fenêtres sur ses côtés avec leurs volets et capteurs, téléviseurs et enceintes placés avec leur lecteur |

La priorité de localisation est override projet > entity area > device area. Un floor est dérivé de l'area. Une area inconnue génère un avertissement. Ni nom identique, ni area partagée ne justifient seuls une fusion.

Au premier incrément, une lumière correspond à un appareil logique même si un device comporte plusieurs circuits : aucune fusion abusive. Le resolver média viendra ensuite avec arêtes typées, scores d'association et validation manuelle. States et availability restent hors graphe persistant. L'inventaire conserve hidden/disabled pour l'audit, mais le composer les exclut par défaut.

Les explications sont des codes de preuve traduisibles, pas des textes liés à la langue du navigateur. Tri explicite par ID pour une génération indépendante de l'ordre reçu du réseau.
