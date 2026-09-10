# Cartes disponibles

| Carte | Affichage | Commandes |
| --- | --- | --- |
| MP Glass Light | Nom, état, luminosité déclarée | Allumer/éteindre, brightness_pct si DIM, more-info |
| MP Glass Generic | Nom et état, fallback inconnu | more-info natif |

En mode MANUAL, ajouter MP Glass Light dans le picker et sélectionner une lumière. Native selector si déjà disponible, liste HTML sinon. Le preset est transmis par le composer ; propriété `debug` montre les preuves et capacités dans les cartes générées lorsque l'utilisateur administrateur l'active dans la stratégie.

Unavailable/unknown désactive les commandes. Erreurs HA affichées localement ; aucun état optimiste ne masque une erreur de service. Les noms et attributs sont rendus via bindings Lit échappés.

Voir [registre](CARD_REGISTRY.md). Les cartes Climate, Cover, TV, Alarm, Camera et les contrôles RGB détaillés sont les prochains incréments.
