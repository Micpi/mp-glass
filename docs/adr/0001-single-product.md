# ADR 0001 — paquet Integration unique

Date : 2026-09-10. Statut : retenu pour le premier incrément.

HACS installe le contenu de `custom_components/mp_glass`. Embarquer le frontend compilé dans `www/` permet une version atomique backend/frontend, sans dépendance à un second dépôt. Choix A. Choix B (deux packages) ajouterait une matrice de compatibilité et une étape d'installation sans besoin démontré.

Conséquences : build avant packaging obligatoire ; JS public exclusivement statique ; projet via API authentifiée. Dépôt produit avec un seul domaine ; le monorepo parent n'est pas une cible HACS valide pour MP Nexus. Revoir si le frontend doit avoir un cycle indépendant. Source : https://hacs.xyz/docs/publish/integration/
