# Migrations

Version 1 : première version de Project Config. Le validateur conserve les données et refuse un format futur. Il n'existe aucun format MP Glass v2/v3 publié à migrer.

Avant chaque évolution : documenter transformation, backup, tests de conservation des overrides/roles/plans, reprise après interruption et refus de downgrade incompatible. La fonction `migrateProject` constitue aujourd'hui uniquement une validation/copie v1 ; ne pas la présenter comme des migrations multiples implémentées.

Le stockage HA versionne l'enveloppe indépendamment du `schema_version` du projet. Les deux devront évoluer explicitement si leurs contrats changent.
