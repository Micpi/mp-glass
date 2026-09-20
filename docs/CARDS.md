# Cartes disponibles

| Carte | Affichage | Commandes |
| --- | --- | --- |
| MP Nexus Light | Nom, état, luminosité déclarée | Allumer/éteindre, brightness_pct si DIM, fenêtre Détails |
| MP Nexus Generic | Nom et état, fallback inconnu | Fenêtre Détails |

En mode MANUAL, ajouter MP Nexus Light dans le picker et sélectionner une lumière. Native selector si déjà disponible, liste HTML sinon. Le preset est transmis par le composer ; propriété `debug` montre les preuves et capacités dans les cartes générées lorsque l'utilisateur administrateur l'active dans la stratégie.

Unavailable/unknown désactive les commandes. Erreurs HA affichées localement ; aucun état optimiste ne masque une erreur de service. Les noms et attributs sont rendus via bindings Lit échappés.

## Fenêtre Détails

Depuis 0.12.0, « Détails » ouvre la fenêtre MP Nexus (`mp-glass-detail`) au lieu du dialogue more-info de Home Assistant : même verre, même langue, et uniquement les commandes que l'équipement déclare (lumière avec luminosité, température de couleur et couleur ; volet avec position et inclinaison ; thermostat avec consigne, modes et préréglages ; lecteur avec transport, volume et source ; serrure, interrupteur, ventilateur, scène). Un `<dialog>` modal : Échap, la croix ou le fond la ferment. Les attributs restants sont listés sous « Détails techniques », et « Historique et réglages Home Assistant » rend la main au dialogue natif, seul porteur de l'historique, du logbook et des réglages d'entité.

La vue intercepte l'évènement `hass-more-info` qui remonte de ses cartes, de ses badges et des cartes d'autres auteurs : elles ouvrent donc la même fenêtre. Seule la demande émise par la fenêtre elle-même (`detail.mpNative`) est laissée passer. La carte Light, utilisable dans un dashboard Home Assistant ordinaire, porte sa propre fenêtre.

Voir [registre](CARD_REGISTRY.md). Les cartes Climate, Cover, TV, Alarm, Camera et les contrôles RGB détaillés sont les prochains incréments.
