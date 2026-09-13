# Migrations

Version 1 : première version de Project Config.

Version 2 : réglages visuels avancés et modèle de navigation.

La migration v1 → v2 ajoute les nouvelles valeurs par défaut sans modifier le nom, le preset, les rôles ou les overrides existants. Le backend migre puis persiste le projet au chargement de l'intégration ; le frontend contient la même transformation pour les imports et les tests hors Home Assistant.

Le stockage HA versionne l'enveloppe indépendamment du `schema_version` du projet. Les deux devront évoluer explicitement si leurs contrats changent.
