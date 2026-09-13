# ADR 0005 — intégration principale, add-on optionnel

Date : 2026-09-13. Statut : retenu.

## Contexte

Le Studio doit lire les registries Home Assistant, enregistrer le projet, générer la stratégie Lovelace et rester utilisable sur Home Assistant OS, Container et Core. La question d'un add-on Supervisor a été réévaluée pour accélérer la personnalisation.

## Décision

L'intégration `custom_components/mp_glass` reste le produit principal et embarque le frontend compilé. Son panneau authentifié et son API WebSocket couvrent la navigation, la configuration, la découverte et la génération sans service séparé.

Un add-on ne sera créé que pour une charge qui justifie un processus isolé : conversion et optimisation de plans, traitement d'images, génération d'assets ou outils de développement. Il restera facultatif et ne deviendra pas une condition pour afficher ou contrôler le dashboard.

## Raisons

- une intégration fonctionne sur davantage de types d'installation ;
- l'authentification, les permissions et les données restent dans Home Assistant ;
- un seul package évite une seconde configuration et une seconde panne possible ;
- les add-ons sont des conteneurs Supervisor distincts et ne sont pas disponibles sur toutes les installations.

## Conséquences

Le Studio reste local et accessible depuis `/mp-glass-settings`. Les traitements lourds futurs utiliseront une interface de capacité : leur absence devra produire un fallback local explicite.

Références : [Custom panels](https://developers.home-assistant.io/docs/frontend/custom-ui/creating-custom-panels/), [Apps/add-ons](https://developers.home-assistant.io/docs/apps/), [App configuration](https://developers.home-assistant.io/docs/apps/configuration/).
