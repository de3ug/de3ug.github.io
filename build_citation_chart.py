#!/usr/bin/env python3
"""Render the observed Google Scholar histories used in the VIPeR essay."""

import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ASSETS = Path(__file__).resolve().parent / 'site/writing/twenty-years-of-person-re-identification/assets'


def main():
  data = json.loads((ASSETS / 'scholar-citations.json').read_text())
  rows = data['annual']
  years = [row['year'] for row in rows]
  plt.rcParams.update({'font.family': 'sans-serif', 'font.size': 12})
  fig, ax = plt.subplots(figsize=(10, 5.6), dpi=180)
  fig.patch.set_facecolor('white')
  ax.set_facecolor('white')
  for key, label, color, style in [
    ('eccv2008', 'ECCV 2008', '#11637b', '-'),
    ('pets2007', 'PETS 2007', '#b64b24', '--'),
  ]:
    counts = [row[key] for row in rows]
    ax.plot(years[:-1], counts[:-1], color=color, linewidth=2.5,
            linestyle=style, label=label)
    ax.plot(years[-2:], counts[-2:], color=color, linewidth=2,
            linestyle=':', marker='o', markersize=4)
  ax.set_title('Citations to the foundational VIPeR papers', loc='left',
               fontsize=17, fontweight='bold', pad=22)
  ax.set_ylabel('Citations per year')
  ax.set_xticks(range(2010, 2027, 2))
  ax.set_xlim(2009.7, 2026.3)
  ax.set_ylim(0, 240)
  ax.grid(axis='y', color='#dedede')
  ax.set_axisbelow(True)
  ax.spines[['top', 'right']].set_visible(False)
  ax.legend(frameon=False, loc='upper left')
  ax.annotate('213 (2018)', xy=(2018, 213), xytext=(2019, 225),
              color='#11637b', fontsize=11,
              arrowprops={'arrowstyle': '-', 'color': '#11637b'})
  ax.annotate('179 (2017)', xy=(2017, 179), xytext=(2013, 204),
              color='#b64b24', fontsize=11,
              arrowprops={'arrowstyle': '-', 'color': '#b64b24'})
  fig.text(0.12, 0.025,
           'Google Scholar · observed October 12, 2026 · 2026 is year-to-date',
           fontsize=10, color='#555555')
  fig.subplots_adjust(left=0.12, right=0.97, bottom=0.13, top=0.84)
  fig.savefig(ASSETS / 'citations-over-time.png')
  plt.close(fig)


if __name__ == '__main__':
  main()
