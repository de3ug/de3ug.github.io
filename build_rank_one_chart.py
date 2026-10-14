#!/usr/bin/env python3
"""Render the sourced VIPeR performance scatter plot used in the essay."""

import json
from datetime import date
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ASSETS = Path(__file__).resolve().parent / 'site/writing/twenty-years-of-person-re-identification/assets'
STYLES = {
  'historical': ('#11637b', 'o', 'Within-dataset methods'),
  'generalization': ('#19724c', 'o', 'External-data training'),
  'reranked': ('#8a446a', 'D', 'Re-ranking'),
  'audit': ('#727272', 'x', 'Protocol unclear')
}
OFFSETS = {
  'PETS baseline': (0, 28), 'ELF': (-22, 23), 'SDALF': (-25, 28), 'KISSME': (-35, -32),
  'eSDC': (-26, -45), 'SalMatch': (-20, 38), 'SCNCD': (-60, 48), 'LOMO + XQDA': (-18, -80),
  'Metric ensembles': (-80, 40), 'KCCA + DCIA': (-85, 44), 'GOG + XQDA': (0, 40),
  'NFST fusion': (0, 72), 'SNR': (12, -48), 'RaMoE': (4, -35), 'ACL': (-20, 42),
  'ReNorm': (-35, 35), 'CLIP-FGDI': (-85, 38), 'NK3ML': (20, -12), 'RND': (-85, -42),
  'DIMN': (-28, -40), 'DualNorm': (-78, 20), 'OSNet + target fine-tuning': (-6, 42)
}


def year_position(row):
  if row['date_basis'] == 'year_only':
    return row['year']
  posted = date.fromisoformat(row['date'])
  start, end = date(posted.year, 1, 1), date(posted.year + 1, 1, 1)
  return posted.year + (posted - start).days / (end - start).days


def main():
  rows = json.loads((ASSETS / 'rank-one-scatter.json').read_text())['papers']
  assert len({r['method'] for r in rows}) == len(rows)
  assert all(0 <= r['rank_one_percent'] <= 100 for r in rows)
  plt.rcParams.update({'font.family': 'sans-serif', 'font.size': 12})
  fig, ax = plt.subplots(figsize=(12, 7.2), dpi=180)
  fig.patch.set_facecolor('white')
  ax.set_facecolor('white')
  for setting, (color, marker, label) in STYLES.items():
    for row in (r for r in rows if r['setting'] == setting):
      x, rate = year_position(row), row['rank_one_percent']
      shape = '^' if row['method'] == 'NK3ML' else marker
      ax.scatter(x, rate, c=color, s=62 if row['highlighted'] else 30,
                 marker=shape, linewidths=1.2, zorder=3, clip_on=False)
      if row['highlighted'] or row['method'] in ('NK3ML', 'RND'):
        ax.annotate(row.get('annotation', row['method']), (x, rate), xytext=OFFSETS[row['method']],
                    textcoords='offset points', fontsize=10, va='center',
                    ha='right' if row['method'] == 'OSNet + target fine-tuning' else 'left',
                    arrowprops={'arrowstyle': '-', 'color': color, 'alpha': 0.7, 'linewidth': 0.7},
                    bbox={'facecolor': 'white', 'edgecolor': 'none', 'pad': 1, 'alpha': 0.95}, zorder=4)
    ax.scatter([], [], c=color, marker=marker, s=40, label=label)
  ax.set_xlim(2006.75, 2026.75)
  ax.set_xticks(list(range(2007, 2027, 2)) + [2026])
  ax.set_xlabel('Year', labelpad=10)
  ax.set_ylim(0, 100)
  ax.set_yticks(range(0, 101, 20))
  ax.set_ylabel('Rank-one accuracy (%)', labelpad=10)
  ax.grid(color='#ededed', linewidth=0.8)
  ax.set_axisbelow(True)
  ax.spines[['top', 'right']].set_visible(False)
  ax.legend(loc='lower right', fontsize=10, frameon=False)
  fig.subplots_adjust(left=0.08, right=0.98, top=0.98, bottom=0.14)
  fig.savefig(ASSETS / 'rank-one-scatter.png')
  plt.close(fig)


if __name__ == '__main__':
  main()
