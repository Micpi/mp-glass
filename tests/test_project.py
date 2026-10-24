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
        for patch in ({"schema_version": 3}, {"token": "secret"}, {"overrides": {"x": {"pin": "1234"}}}):
            with self.assertRaises(ValidationError):
                module.validate_project(self.validator, module.default_project() | patch)

    def test_interface_version(self):
        source = module.default_project() | {"interface": {"version": 2}}
        self.assertEqual(module.validate_project(self.validator, source)["interface"], {"version": 2})
        with self.assertRaises(ValidationError):
            module.validate_project(self.validator, module.default_project() | {"interface": {"version": 3}})

    def test_houses_of_a_domain(self):
        room = {"id": "r", "name": "Salon", "polygon": [[0, 0], [4, 0], [4, 4], [0, 4]]}

        def floor(floor_id, house=None):
            return {"id": floor_id, "name": floor_id, "elevation": 0, "height": 2.6, "rooms": [room], **({"buildingId": house} if house else {})}

        def project(buildings, floors):
            return module.default_project() | {"spatial": {"version": 1, "enabled": True, "buildings": buildings, "floors": floors}}

        houses = [{"id": "main", "name": "Maison principale"}, {"id": "guest", "name": "Maison d'amis"}]
        # Eight floors in each house: more than one house may hold, not more than the domain.
        floors = [floor(f"{h}-{i}", h) for h in ("main", "guest") for i in range(8)]
        module.validate_project(self.validator, project(houses, floors))
        # A floor without a house belongs to the first one, which is then full.
        for bad in (project(houses, [floor("x", "nowhere")]), project(houses + [houses[0]], [floor("x")]), project(houses, floors + [floor("main-8")])):
            with self.assertRaises(ValueError):
                module.validate_project(self.validator, bad)

    def test_site_plan_of_a_domain(self):
        room = {"id": "r", "name": "Salon", "polygon": [[0, 0], [4, 0], [4, 4], [0, 4]]}

        def project(site, placed=None):
            house = {"id": "main", "name": "Maison principale", **({"site": placed} if placed else {})}
            spatial = {"version": 1, "enabled": True, "site": site, "buildings": [house], "floors": [{"id": "f", "name": "RDC", "elevation": 0, "height": 2.6, "rooms": [room]}]}
            return module.default_project() | {"spatial": spatial}

        site = {"width": 300, "height": 430, "layers": [{"name": "batiment", "kind": "building", "fills": [[10, 10, 30, 10, 30, 30, 10, 10]], "paths": [[0, 0, 300, 0]]}],
                "labels": [{"text": "SAINT-JAUME 1", "at": [20, 20]}]}
        module.validate_project(self.validator, project(site, {"at": [20, 20], "outline": [[10, 10], [30, 10], [30, 30]]}))
        # Beyond the points a dashboard can carry, or a line with half a point.
        heavy = {"width": 100, "height": 100, "layers": [{"name": f"l{i}", "kind": "other", "paths": [[k % 100 for k in range(8000)]]} for i in range(11)]}
        for bad in (heavy, {**site, "layers": [{"name": "odd", "kind": "path", "paths": [[1, 2, 3, 4, 5]]}]}):
            with self.assertRaises(ValueError):
                module.validate_project(self.validator, project(bad))
        with self.assertRaises(ValidationError):
            module.validate_project(self.validator, project({**site, "layers": [{"name": "x", "kind": "lamp", "paths": []}]}))

    def test_migrates_v1_and_preserves_user_choices(self):
        old = module.default_project("Maison")
        old["schema_version"] = 1
        old.pop("navigation")
        old["appearance"] = {"preset": "glass-warm", "accent": "#112233"}
        migrated = module.migrate_project(old)
        self.assertEqual(migrated["schema_version"], 2)
        self.assertEqual(migrated["appearance"]["accent"], "#112233")
        self.assertEqual(migrated["navigation"]["items"], ["home", "lights", "rooms"])
        module.validate_project(self.validator, migrated)


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
        self.assertEqual(self.repo.read()["project"]["project"]["name"], "MP Nexus")


if __name__ == "__main__":
    unittest.main()
