"""Strict project contract; no Home Assistant runtime dependency."""
from copy import deepcopy
import asyncio
import json
from pathlib import Path

from jsonschema import Draft7Validator


def load_validator():
    """Load once via executor at integration setup."""
    schema = json.loads(Path(__file__).with_name("project.schema.json").read_text(encoding="utf-8"))
    Draft7Validator.check_schema(schema)
    return Draft7Validator(schema)


def default_project(name="MP Glass"):
    return {
        "schema_version": 2,
        "project": {"name": name},
        "appearance": {
            "preset": "glass-blue", "accent": "#69b7ff", "secondaryAccent": "#efbd8b",
            "glassTint": "#12344f", "glassOpacity": 0.62, "glassBlur": 22,
            "borderStrength": 0.2, "shadowStrength": 0.35, "radius": 22,
            "backgroundDim": 0.44, "backgroundPosition": "right",
            "backgroundBlur": 0, "backgroundSaturation": 1,
            "density": "comfortable", "fontStyle": "elegant", "iconStyle": "tile",
            "cardStyle": "standard", "cardColumns": 4, "cardGap": 12,
            "maxWidth": 1560, "heroHeight": 455, "motion": True,
            "showHero": True, "showClock": True, "showOverview": True,
            "showFooter": True, "showSettingsShortcut": True,
            "showCardDetails": True, "showBrightness": True,
            "eyebrow": "Une maison plus simple à vivre",
            "subtitle": "Vos équipements sont prêts, pièce par pièce.",
            "quote": "Les plus beaux moments commencent à la maison.",
            "sectionTitle": "Lumières",
            "sectionSubtitle": "Contrôle rapide de tous les éclairages détectés"
        },
        "navigation": {"items": ["home", "lights", "rooms"], "showLabels": True},
        "roles": {},
        "overrides": {},
    }


def migrate_project(value):
    """Migrate stored project configuration without discarding user choices."""
    source = deepcopy(value)
    if source.get("schema_version") == 1:
        migrated = default_project(source.get("project", {}).get("name", "MP Glass"))
        migrated.update(source)
        migrated["schema_version"] = 2
        migrated["appearance"] = {**default_project()["appearance"], **source.get("appearance", {})}
        migrated["navigation"] = {"items": ["home", "lights", "rooms"], "showLabels": True}
        return migrated
    return source


def validate_project(validator, value):
    validator.validate(value)
    return deepcopy(value)


class RevisionConflict(Exception):
    """The editor is stale."""


class ProjectRepository:
    """Serialize writes and only expose committed records."""

    def __init__(self, store, validator, record):
        validate_project(validator, record["project"])
        self.store = store
        self.validator = validator
        self.record = deepcopy(record)
        self.lock = asyncio.Lock()

    def read(self):
        return deepcopy(self.record)

    async def save(self, revision, value):
        project = validate_project(self.validator, value)
        async with self.lock:
            if revision != self.record["revision"]:
                raise RevisionConflict
            record = {"revision": revision + 1, "project": project}
            await self.store.async_save(record)
            self.record = record
        return self.read()
