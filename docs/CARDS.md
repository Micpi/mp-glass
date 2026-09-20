# Cartes disponibles

| Carte | Affichage | Commandes |
| --- | --- | --- |
| MP Nexus Light | Nom, état, luminosité déclarée | Allumer/éteindre, brightness_pct si DIM, fenêtre Détails |
| MP Nexus Generic | Nom et état, fallback inconnu | Fenêtre Détails |

En mode MANUAL, ajouter MP Nexus Light dans le picker et sélectionner une lumière. Native selector si déjà disponible, liste HTML sinon. Le preset est transmis par le composer ; propriété `debug` montre les preuves et capacités dans les cartes générées lorsque l'utilisateur administrateur l'active dans la stratégie.

Unavailable/unknown désactive les commandes. Erreurs HA affichées localement ; aucun état optimiste ne masque une erreur de service. Les noms et attributs sont rendus via bindings Lit échappés.

## Fenêtre Détails

Depuis 0.12.0, « Détails » ouvre la fenêtre MP Nexus (`mp-glass-detail`) au lieu du dialogue more-info de Home Assistant : même verre, même langue, et uniquement les commandes que l'équipement déclare (lumière avec luminosité, température de couleur et couleur ; volet avec position et inclinaison ; thermostat avec consigne, modes et préréglages ; lecteur avec transport, volume et source ; serrure, interrupteur, ventilateur, scène). Un `<dialog>` modal : Échap, la croix ou le fond la ferment. Les attributs restants sont listés sous « Détails techniques », et « Réglages Home Assistant » rend la main au dialogue natif, seul porteur des réglages d'entité et du logbook.

Depuis 0.13.0, la fenêtre se commande comme celle de Home Assistant, dans le thème MP Nexus. `frontend/controls.ts` fournit deux commandes tactiles : `mp-glass-bar`, la barre verticale glissée (luminosité, ouverture d'un volet, vitesse d'un ventilateur), et `mp-glass-dial`, le cadran tourné (consigne d'un thermostat, couleur du mode en cours). Les deux suivent le doigt sans rien commander, n'envoient la commande qu'au relâcher, gardent la valeur affichée jusqu'à la réponse de Home Assistant (4 s au plus) et répondent au clavier (`role="slider"`, flèches, Page, Origine/Fin).

## Historique

`frontend/history.ts` lit `history/history_during_period` sur la session de l'utilisateur et dessine ce que l'enregistreur a gardé : une **courbe** pour une grandeur mesurée (capteur numérique, température mesurée d'un thermostat, avec la consigne en pointillés), une **bande d'états** colorée sinon, avec la durée de chaque état. Trois périodes : 12 h, 24 h, 7 jours. Le survol lit la valeur du moment pointé. Sans enregistreur, ou pour une entité exclue, la fenêtre le dit et garde ses commandes. Formats acceptés : états compressés (`s`, `a`, `lu`, `lc`) et noms complets ; voir [recherche API](HA_API_RESEARCH.md).

La vue intercepte l'évènement `hass-more-info` qui remonte de ses cartes, de ses badges et des cartes d'autres auteurs : elles ouvrent donc la même fenêtre. Seule la demande émise par la fenêtre elle-même (`detail.mpNative`) est laissée passer. La carte Light, utilisable dans un dashboard Home Assistant ordinaire, porte sa propre fenêtre.

Voir [registre](CARD_REGISTRY.md). Les cartes Climate, Cover, TV, Alarm, Camera et les contrôles RGB détaillés sont les prochains incréments.
