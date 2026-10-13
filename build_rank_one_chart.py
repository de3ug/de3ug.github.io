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
  plt.rcParams.update({'font.family': 'sans-serif', 'font.size': 13})
  fig, ax = plt.subplots(figsize=(9, 5.6), dpi=180)
  fig.patch.set_facecolor('white')
  ax.set_facecolor('white')
  offsets = [(0, 18), (0, 18), (0, -46), (-16, -46), (-8, 18)]
  for row, offset in zip(rows, offsets):
    year, rate = row['year'], row['rank_one_percent']
    color = '#b64b24' if row['method'] == 'ELF' else '#11637b'
    ax.vlines(year, 0, rate, color='#dedede', linewidth=1.5, zorder=1)
    ax.scatter(year, rate, color=color, s=85, zorder=3)
    value = f"{rate:g}%"
    if row['approximate']:
      value = f"~{value}"
    ax.annotate(f"{row['method']}\n{value}", xy=(year, rate),
                xytext=offset, textcoords='offset points', ha='center',
                va='bottom' if offset[1] > 0 else 'top',
                fontsize=12, color=color, linespacing=1.5)
  ax.set_title('Selected VIPeR rank-one results', loc='left',
               fontsize=17, fontweight='bold', pad=22)
  ax.set_ylabel('Correct top match (%)')
  ax.set_xlabel('Publication year', labelpad=12)
  ax.set_xticks([row['year'] for row in rows])
  ax.set_xlim(2007, 2017)
  ax.set_ylim(0, 63)
  ax.set_yticks(range(0, 61, 10))
  ax.grid(axis='y', color='#eeeeee')
  ax.set_axisbelow(True)
  ax.spines[['top', 'right']].set_visible(False)
  fig.text(0.12, 0.025,
           '316-image galleries | Original reported results | ~ denotes an approximate value',
           fontsize=10, color='#555555')
  fig.subplots_adjust(left=0.12, right=0.97, bottom=0.19, top=0.86)
  fig.savefig(ASSETS / 'rank-one-over-time.png')
  plt.close(fig)


if __name__ == '__main__':
  main()
