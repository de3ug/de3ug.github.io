#!/usr/bin/env python3
"""Render the sourced VIPeR performance milestones used in the essay."""

import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ASSETS = Path(__file__).resolve().parent / 'site/writing/twenty-years-of-person-re-identification/assets'


def main():
  data = json.loads((ASSETS / 'rank-one-milestones.json').read_text())
  rows = data['results']
  plt.rcParams.update({'font.family': 'sans-serif', 'font.size': 12})
  groups = [
    ('Historical benchmark methods', [r for r in rows if r['setting'] != 'generalization']),
    ('Unseen-target domain generalization', [r for r in rows if r['setting'] == 'generalization'])
  ]
  fig, axes = plt.subplots(2, 1, figsize=(9, 8.8), dpi=180, sharex=True,
                           gridspec_kw={'height_ratios': [len(g[1]) for g in groups]})
  fig.patch.set_facecolor('white')
  for ax, (title, group) in zip(axes, groups):
    ax.set_facecolor('white')
    for index, row in enumerate(group):
      rate = row['rank_one_percent']
      color = '#19724c' if row['setting'] == 'generalization' else '#11637b'
      if row['year'] <= 2008:
        color = '#b64b24'
      reranked = row['setting'] == 'reranked'
      if reranked:
        color = '#555555'
      ax.hlines(index, 0, rate, color='#dddddd', linewidth=1.5, zorder=1)
      ax.scatter(rate, index, color=color, s=65, marker='D' if reranked else 'o', zorder=3)
      value = f"{rate:g}%"
      if row['approximate']:
        value = f"~{value}"
      ax.annotate(value, xy=(rate, index), xytext=(8, 0), textcoords='offset points',
                  va='center', fontsize=11.5, color=color)
    labels = [f"{r['year']}  {r['method']}" for r in group]
    ax.set_yticks(range(len(group)), labels)
    ax.set_ylim(len(group) - 0.4, -0.8)
    ax.set_title(title, loc='left', fontsize=12, fontweight='bold', pad=9)
    ax.set_xlim(0, 100)
    ax.set_xticks(range(0, 101, 20))
    ax.grid(axis='x', color='#eeeeee')
    ax.set_axisbelow(True)
    ax.tick_params(axis='y', length=0, pad=10)
    ax.spines[['top', 'right', 'left']].set_visible(False)
  axes[-1].set_xlabel('Correct top match (%)', labelpad=10)
  fig.text(0.06, 0.965, 'VIPeR rank-one results over time',
           fontsize=18, fontweight='bold')
  fig.text(0.06, 0.932, 'Selected milestones, 2007-2025 | Literature checked October 2026',
           fontsize=11, color='#555555')
  fig.text(0.06, 0.035,
           '~ Approximate value     Diamond: includes gallery-context re-ranking\n'
           '316-image galleries. Training sources and evaluation procedures differ; not a leaderboard.',
           fontsize=10, color='#555555', linespacing=1.7)
  fig.subplots_adjust(left=0.35, right=0.96, bottom=0.14, top=0.88, hspace=0.38)
  fig.savefig(ASSETS / 'rank-one-over-time.png')
  plt.close(fig)


if __name__ == '__main__':
  main()
