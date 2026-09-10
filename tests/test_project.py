"""Run without importing the Home Assistant integration package."""
import importlib.util
import asyncio
from pathlib import Path
import unittest
from jsonschema.exceptions import ValidationError

spec = importlib.util.spec_from_file_location("mp_project", Path(__file__).parents[1] / "custom_components/mp_glass/project.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProjectContractTest(unittest.TestCase):
    def setUp(self):
        self.validator = module.load_validator()

    def test_round_trip_and_copy(self):
        source = module.default_project("Salon")
        result = module.validate_project(self.validator, source)
        self.assertEqual(result, source)
        result["project"]["name"] = "Different"
        self.assertEqual(source["project"]["name"], "Salon")

    def test_reject_secrets_and_future_schema(self):
        for patch in ({"schema_version": 2}, {"token": "secret"}, {"overrides": {"x": {"pin": "1234"}}}):
            with self.assertRaises(ValidationError):
                module.validate_project(self.validator, module.default_project() | patch)


class MemoryStore:
    """Storage test double, not a substitute for the real HA acceptance gate."""
    def __init__(self):
        self.records = []
        self.fail = False

    async def async_save(self, record):
        await asyncio.sleep(0)
        if self.fail:
            raise OSError("Disk error")
        self.records.append(record)


class RepositoryTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.store = MemoryStore()
        self.project = module.default_project()
        self.repo = module.ProjectRepository(self.store, module.load_validator(), {"revision": 0, "project": self.project})

    async def test_concurrent_edits_have_one_winner(self):
        results = await asyncio.gather(self.repo.save(0, self.project), self.repo.save(0, self.project), return_exceptions=True)
        self.assertEqual(sum(isinstance(result, module.RevisionConflict) for result in results), 1)
        self.assertEqual(self.repo.read()["revision"], 1)
        self.assertEqual(len(self.store.records), 1)

    async def test_disk_failure_does_not_publish_a_revision(self):
        self.store.fail = True
        with self.assertRaises(OSError):
            await self.repo.save(0, self.project)
        self.assertEqual(self.repo.read()["revision"], 0)

    async def test_invalid_project_never_reaches_storage(self):
        with self.assertRaises(ValidationError):
            await self.repo.save(0, self.project | {"token": "secret"})
        self.assertEqual(self.store.records, [])

    async def test_read_and_save_return_detached_objects(self):
        record = await self.repo.save(0, self.project)
        record["project"]["project"]["name"] = "Changed"
        self.assertEqual(self.repo.read()["project"]["project"]["name"], "MP Glass")


if __name__ == "__main__":
    unittest.main()
