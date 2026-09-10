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
    return {"schema_version": 1, "project": {"name": name}, "appearance": {"preset": "glass-blue"}, "roles": {}, "overrides": {}}


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
