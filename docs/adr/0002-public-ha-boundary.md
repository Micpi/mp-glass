# ADR 0002 — frontière HA et génération

Date : 2026-09-10. Statut : retenu.

Strategy `custom:mp-glass`, registration `window.customStrategies`, custom view et custom cards documentées. Les registries et services passent par la session HA du frontend. Aucun endpoint backend ne relaie une commande avec des droits administrateur. Module global chargé par helper frontend Python encapsulé : couplage HA à tester à chaque release. `async_register_static_paths` remplace l'ancien enregistrement synchrone.

Création du dashboard par le dialogue HA natif, sans modifier son stockage privé. La disponibilité du sélecteur communautaire et des suggestions fixe le minimum cible à 2026.6. Source : https://developers.home-assistant.io/docs/frontend/custom-ui/custom-strategy/

Le code HA stable 2026.9.1 fournit les helpers `frontend.add_extra_js_url` et `remove_extra_js_url`, explicitement destinés aux custom integrations. Ils sont encapsulés dans `custom_components/mp_glass/frontend.py` avec feature detection. Aucun accès direct au UrlManager interne n'est nécessaire. Si le helper disparaît, setup échoue explicitement ; le frontend standalone reste chargeable comme ressource Lovelace dans l'UI. Tester ce couplage sur chaque version HA supportée. Les composants privés du frontend ne sont jamais importés dans le JS. Source vérifiée : https://github.com/home-assistant/core/blob/2026.9.1/homeassistant/components/frontend/__init__.py
