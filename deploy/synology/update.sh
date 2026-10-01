#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$SCRIPT_DIR/compose.yaml" ]; then
  COMPOSE_FILE="$SCRIPT_DIR/compose.yaml"
  PROJECT_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/../../compose.yaml" ]; then
  COMPOSE_FILE="$SCRIPT_DIR/../../compose.yaml"
  PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
else
  echo "Fichier compose.yaml introuvable. Placez update.sh à côté de compose.yaml, ou dans deploy/synology/ du dépôt." >&2
  exit 1
fi
cd "$PROJECT_DIR"

echo "== Vérification de la configuration MP Nexus =="
docker compose -f "$COMPOSE_FILE" config --quiet

echo "== Téléchargement de la dernière image =="
docker compose -f "$COMPOSE_FILE" pull mp-nexus

echo "== Recréation du conteneur MP Nexus =="
docker compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans mp-nexus

echo "== État du service =="
docker compose -f "$COMPOSE_FILE" ps mp-nexus

echo "Mise à jour terminée. Vérifiez que le service est indiqué comme démarré ci-dessus."
