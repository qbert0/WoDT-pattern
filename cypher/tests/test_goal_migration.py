import copy
import sys
import unittest
from pathlib import Path
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from migrate_goal_ids import Ditto, attribute_changes, rename_plan


class FakeDitto(Ditto):
    def __init__(self, attrs, race=False):
        self.attrs = copy.deepcopy(attrs)
        self.race = race
        self.revision = 1

    def request(self, path, method='GET', body=None, etag=None):
        if method == 'GET':
            return {'attributes': copy.deepcopy(self.attrs)}, str(self.revision)
        if self.race:
            self.race = False
            self.revision += 1
            self.attrs['telemetryMarker'] = 'new'
            raise HTTPError(path, 412, 'revision changed', {}, None)
        assert etag == str(self.revision)
        assert set(body) == {'attributes'}
        self.attrs.update(body['attributes'])
        self.revision += 1
        return None, None


class MigrationTest(unittest.TestCase):
    def test_collision_and_missing_goal_are_rejected(self):
        node = lambda key, id: {'key': key, 'labels': ['Goal'], 'props': {'id': id}}
        with self.assertRaises(ValueError):
            rename_plan({'nodes': [node('1', 'old'), node('2', 'new')]}, {'old': 'new'})
        with self.assertRaises(ValueError):
            rename_plan({'nodes': []}, {'old': 'new'})
        self.assertEqual(rename_plan({'nodes': [node('1', 'new')]}, {'old': 'new'}), [])

    def test_scope_migration_only_changes_mapping_attributes(self):
        self.assertEqual(attribute_changes({'goalRootId': 'G_LIFT_ROOT', 'goalAgentId': 'A_LIFT', 'name': 'lift'}),
                         {'goalRootId': 'G_WT_CROSSFLOOR'})

    def test_etag_retry_resume_and_rollback_preserve_unrelated_attributes(self):
        plan = {'thingId': 'test:robot', 'before': {'goalRootId': 'G_ROBOT_ROOT'},
                'after': {'goalRootId': 'G_WT_TRANSPORT'}}
        client = FakeDitto({'goalRootId': 'G_ROBOT_ROOT', 'name': 'R01'}, race=True)
        client.update(plan)
        client.update(plan)  # Crash after PATCH: resume is a no-op.
        self.assertEqual(client.attrs['goalRootId'], 'G_WT_TRANSPORT')
        client.update(plan, rollback=True)
        client.update(plan, rollback=True)
        self.assertEqual(client.attrs, {'goalRootId': 'G_ROBOT_ROOT', 'name': 'R01', 'telemetryMarker': 'new'})

    def test_concurrent_mapping_edit_is_not_overwritten(self):
        client = FakeDitto({'goalRootId': 'USER_GOAL'})
        with self.assertRaises(ValueError):
            client.update({'thingId': 'test:robot', 'before': {'goalRootId': 'G_ROBOT_ROOT'},
                           'after': {'goalRootId': 'G_WT_TRANSPORT'}})
        self.assertEqual(client.attrs['goalRootId'], 'USER_GOAL')


if __name__ == '__main__':
    unittest.main()
