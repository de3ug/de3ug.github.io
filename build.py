#!/usr/bin/env python3
"""
build.py — Generate resume artifacts from site/resume.json

Usage:
  python build.py                # generate site/resume.pdf
  python build.py --format=pdf   # same
  python build.py --format=web   # start local dev server at localhost:8000

Requirements for PDF:
  pip install playwright
  playwright install chromium
"""

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
RESUME_JSON = REPO_ROOT / 'site' / 'resume.json'
OUTPUT_PDF  = REPO_ROOT / 'site' / 'resume.pdf'


def load():
    with open(RESUME_JSON, encoding='utf-8') as f:
        return json.load(f)


def parts_to_html(parts):
    out = []
    for p in parts:
        if isinstance(p, str):
            out.append(p)
        else:
            out.append(f'<a href="{p["url"]}">{p["text"]}</a>')
    return ''.join(out)


def ul(items):
    rows = '\n'.join(f'  <li>{parts_to_html(item["parts"])}</li>' for item in items)
    return f'<ul>\n{rows}\n</ul>'


def render_html(r):
    exp_rows = '\n'.join(
        f'  <tr>'
        f'<td class="role">{e["role"]}</td>'
        f'<td class="org">{e["org"]}</td>'
        f'<td class="years">{e["years"]}</td>'
        f'</tr>'
        for e in r['experience']
    )
    social = ' &nbsp;&middot;&nbsp; '.join(
        f'<a href="{s["url"]}">{s["name"]}</a>' for s in r['social']
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page {{
    size: letter;
    margin: 0.7in 0.75in;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #111;
  }}
  h1 {{
    font-size: 22pt;
    font-weight: normal;
    letter-spacing: 0.02em;
    margin-bottom: 2pt;
  }}
  .subtitle {{
    font-size: 10.5pt;
    color: #444;
    margin-bottom: 10pt;
  }}
  hr {{
    border: none;
    border-top: 0.75pt solid #999;
    margin: 8pt 0;
  }}
  h2 {{
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #333;
    margin: 12pt 0 3pt;
  }}
  p {{ margin-bottom: 4pt; }}
  ul {{
    padding-left: 13pt;
    margin-bottom: 2pt;
  }}
  li {{ margin-bottom: 2pt; }}
  a {{ color: #111; text-decoration: none; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 2pt; }}
  td {{ padding: 1.5pt 0; vertical-align: top; }}
  td.role  {{ font-weight: bold; width: 38%; }}
  td.org   {{ width: 40%; color: #333; }}
  td.years {{ width: 22%; text-align: right; color: #555; white-space: nowrap; }}
  .footer {{
    margin-top: 10pt;
    font-size: 8.5pt;
    color: #555;
    border-top: 0.5pt solid #ccc;
    padding-top: 5pt;
  }}
</style>
</head>
<body>

  <h1>{r['name']}</h1>
  <div class="subtitle">{r['title']} &mdash; {r['tagline']}</div>
  <hr>

  <h2>About</h2>
  <p>{r['about']}</p>

  <h2>Selected Publications &amp; Service</h2>
  {ul(r['publications'])}

  <h2>Selected Patents</h2>
  <p>{r['patents_intro']}</p>
  {ul(r['patents'])}

  <h2>Selected Projects</h2>
  {ul(r['projects'])}

  <h2>Education &amp; Work History</h2>
  <table>
{exp_rows}
  </table>

  <div class="footer">
    {r['location']} &nbsp;&middot;&nbsp; {social}
    &nbsp;&middot;&nbsp; de3ug.github.io
    <span style="float:right">Last updated: {r['last_updated']}</span>
  </div>

</body>
</html>"""


def build_pdf():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            'playwright not installed.\n'
            'Run: pip install playwright && playwright install chromium',
            file=sys.stderr
        )
        sys.exit(1)

    r = load()
    html = render_html(r)

    tmp = REPO_ROOT / '_resume_tmp.html'
    try:
        tmp.write_text(html, encoding='utf-8')
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(tmp.as_uri())
            page.pdf(
                path=str(OUTPUT_PDF),
                format='Letter',
                margin={'top': '0.7in', 'right': '0.75in',
                        'bottom': '0.7in', 'left': '0.75in'},
                print_background=True,
            )
            browser.close()
    finally:
        tmp.unlink(missing_ok=True)

    print(f'PDF written -> {OUTPUT_PDF.relative_to(REPO_ROOT)}')


def serve_web():
    import http.server
    import os
    os.chdir(REPO_ROOT / 'site')
    addr = ('', 8000)
    handler = http.server.SimpleHTTPRequestHandler
    with http.server.HTTPServer(addr, handler) as httpd:
        print('Serving at http://localhost:8000  (Ctrl-C to stop)')
        httpd.serve_forever()


def main():
    parser = argparse.ArgumentParser(description='Build resume artifacts from resume.json')
    parser.add_argument(
        '--format', choices=['pdf', 'web'], default='pdf',
        help='pdf: generate site/resume.pdf  |  web: start local dev server'
    )
    args = parser.parse_args()

    if args.format == 'web':
        serve_web()
    else:
        build_pdf()


if __name__ == '__main__':
    main()
