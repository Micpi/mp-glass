# ADR 0003 — core pur et projet versionné

Date : 2026-09-10. Statut : retenu.

TypeScript strict + Lit + Vite + Vitest + Playwright. Lit fournit des bindings échappés et Web Components avec peu de runtime ; le core ignore Lit. JSON Schema partagé validé par Ajv et jsonschema évite une divergence frontend/backend. Store HA garde une révision pour éviter les écrasements concurrents.

Le modèle HA, les capacités, la présentation et le placement restent distincts. La v1 n'invente pas de migrations pour des formats jamais publiés. Des migrations réelles et tests précéderont chaque nouveau format. Overrides appliqués en dernier, découverte non destructive. Aucun secret ni télémétrie dans le modèle.
