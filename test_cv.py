"""Check that condensed patent citations preserve the complete source inventory."""

from copy import deepcopy
import json
from pathlib import Path
import unittest

from build_cv import group_patents


class PatentGroupingTests(unittest.TestCase):
  def patent(self, number, title='Tracking', inventors=None, kind='grant'):
    return {
      'publication_number': number,
      'title': title,
      'inventors': inventors or ['Douglas Gray', 'Colin Taylor'],
      'kind': kind,
      'date': '2020-01-01',
      'url': f'https://patents.google.com/patent/{number}/en'
    }

  def test_related_patents_keep_both_identifiers_and_metadata(self):
    entries = [self.patent('US1B1'), self.patent('US2B2')]
    entries[1]['date'] = '2024-03-19'
    before = deepcopy(entries)
    groups = group_patents(entries)
    self.assertEqual(len(groups), 1)
    self.assertEqual(groups[0], before)
    self.assertEqual(entries, before)

  def test_same_title_with_different_inventors_stays_separate(self):
    entries = [self.patent('US1B1'),
               self.patent('US2B1', inventors=['Douglas Gray', 'Ming Du'])]
    self.assertEqual(len(group_patents(entries)), 2)

  def test_different_titles_with_same_inventors_stay_separate(self):
    entries = [self.patent('US1B1'), self.patent('US2B1', title='Recognition')]
    self.assertEqual(len(group_patents(entries)), 2)

  def test_typography_and_inventor_order_do_not_repeat_a_citation(self):
    entries = [self.patent('US1B1', inventors=['Douglas R. Gray', 'Colin Taylor']),
               self.patent('US2B1', title=' TRACKING ',
                           inventors=['COLIN TAYLOR', 'Douglas R Gray'])]
    self.assertEqual(len(group_patents(entries)), 1)

  def test_application_keeps_its_distinct_kind_when_grouped_with_a_grant(self):
    entries = [self.patent('US1B1'), self.patent('US20200000001A1', kind='application')]
    groups = group_patents(entries)
    self.assertEqual(len(groups), 1)
    self.assertEqual([entry['kind'] for entry in groups[0]], ['grant', 'application'])

  def test_real_catalog_retains_every_record_and_groups_the_reported_duplicate(self):
    source = Path(__file__).parent / 'site' / 'resume.json'
    cv = json.loads(source.read_text(encoding='utf-8'))['cv']
    entries = cv['patents']
    groups = group_patents(entries)
    flattened = [entry for members in groups for entry in members]
    self.assertEqual(len(flattened), len(entries))
    self.assertCountEqual(flattened, entries)
    self.assertEqual(sum(entry['kind'] == 'grant' for entry in flattened),
                     cv['sources']['patent_grant_count'])
    self.assertEqual(sum(entry['kind'] == 'application' for entry in flattened),
                     cv['sources']['patent_application_count'])
    navigation = [members for members in groups
                  if members[0]['title'] == 'Intelligent video navigation techniques']
    self.assertEqual(len(navigation), 1)
    self.assertEqual({entry['publication_number'] for entry in navigation[0]},
                     {'US9564177B1', 'US9558784B1'})


if __name__ == '__main__':
  unittest.main()
