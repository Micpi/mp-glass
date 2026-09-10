# Capability Model

Une capability signifie qu'une fonction est déclarée disponible par HA, pas que l'utilisateur est autorisé à l'exécuter. HA tranche les permissions à l'appel.

Un binding associe `{ capability, entityId, evidence }`. Les cartes résolvent leurs actions sur ce binding ; elles ne connaissent aucune marque. L'adapter générique utilise domain, device_class, supported_color_modes et supported_features. Les adapters vendeurs futurs peuvent enrichir les preuves sans modifier le layout.

Premier contrat lumière : POWER, DIM, COLOR_TEMP, RGB, RGBW, RGBWW, EFFECT. POWER découle du domain light ; DIM des modes brightness/color_temp/hs/xy/rgb/rgbw/rgbww/white. Jamais DIM à partir de la seule présence de l'attribut brightness. COLOR_TEMP requiert color_temp et des bornes Kelvin valides pour proposer un contrôle. RGB/XY/HS ne sont pas confondus avec RGBW/RGBWW. La première carte expose POWER et DIM ; les autres capabilities sont inspectables mais leur contrôle détaillé reste au backlog.

Les valeurs absentes, inconnues, unavailable ou non finies n'activent pas de contrôles. Une action n'invente pas de succès local : attendre le prochain état HA. Échec réseau ou permission : message local, possibilité de réessayer.

Confidence : >= 0,90 automatique, [0,65;0,90[ à vérifier, <0,65 non classé. Score heuristique explicable, jamais présenté comme probabilité statistiquement calibrée. Une lumière standard a un signal domain explicite ; un domaine inconnu conserve le fallback. Une attribution forcée par override ne fabrique aucune capability.

Extensions prévues : cover bits OPEN/CLOSE/STOP/POSITION/TILT ; climate temperature/HVAC/presets ; media playback/volume/source ; remote bindings validés. Chaque extension exige fixtures et tests sur API HA courante.
