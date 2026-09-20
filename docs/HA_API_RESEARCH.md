# Recherche HA / HACS — 2026-09-10

Sources primaires consultées avant architecture :

- [Release 2026.9](https://www.home-assistant.io/blog/2026/09/02/release-20269/) : branche stable annoncée le 2 septembre. La version patch utilisée en test doit être relevée sur l'instance ; ne pas déduire le patch d'une date.
- [Strategy](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-strategy/) : generate(config,hass), element ll-strategy-dashboard-*, enregistrement communautaire depuis 2026.5.
- [Cards](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/) : editor, config-changed, getEntitySuggestion depuis 2026.6, context API moderne ; compatibilité setter hass à tester.
- [Views](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-view/) : HA fournit les instances cards/badges ; la custom view assure leur disposition.
- [WebSocket](https://developers.home-assistant.io/docs/api/websocket/) : session authentifiée, erreurs explicites et services natifs.
- [Config Flow](https://developers.home-assistant.io/docs/core/integration/config_flow/) : entrée et options graphiques.
- [Device registry](https://developers.home-assistant.io/docs/device_registry_index/) : relations d'appareils à préserver, pas de fusion par nom.
- [Light](https://developers.home-assistant.io/docs/core/entity/light/) : supported_color_modes et capabilities, pas une heuristique entity_id.
- [Static paths](https://developers.home-assistant.io/blog/2024/06/18/async_register_static_paths/) : utiliser async_register_static_paths, ancien helper déprécié.
- [HACS Integration](https://hacs.xyz/docs/publish/integration/) : racine custom_components et manifest ; release dans un dépôt produit.

## Complément — 2026-09-20 : historique

- [`history/websocket_api.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/history/websocket_api.py) : commande `history/history_during_period` (`start_time`, `end_time`, `entity_ids`, `include_start_time_state`, `significant_changes_only`, `minimal_response`, `no_attributes`). Réponse : un dictionnaire par `entity_id` dont chaque élément est un état **compressé**. `history/stream` existe aussi, par abonnement ; MP Nexus lit une période bornée et n'a pas besoin du flux.
- [`homeassistant/const.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/const.py) : clés compressées `s` (state), `a` (attributes), `lc` (last_changed), `lu` (last_updated), `c` (context). Le lecteur MP Nexus accepte aussi les noms complets et les dates ISO : une version de Home Assistant qui les écrirait autrement ne casse pas la fenêtre, elle affiche moins.
- L'absence d'enregistreur (recorder désactivé, entité exclue) remonte comme une erreur de commande WebSocket : elle est dite à l'écran, jamais convertie en historique vide.

Décisions dérivées : minimum cible 2026.6 ; API publiques d'extension ; code frontend groupé avec backend ; helper d'enregistrement global isolé ; aucune garantie multi-version sans exécution de la matrice de tests.
