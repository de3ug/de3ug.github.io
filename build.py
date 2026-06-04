#!/usr/bin/env python3
"""
build.py — Generate resume artifacts from site/resume.json

Usage:
  python build.py                # generate site/resume.pdf and site/llms.txt
  python build.py --format=pdf   # same
  python build.py --format=llms  # generate site/llms.txt only
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
OUTPUT_LLMS = REPO_ROOT / 'site' / 'llms.txt'


def load():
    with open(RESUME_JSON, encoding='utf-8') as f:
        return json.load(f)


ALL_TARGETS = {'web', 'resume'}


def visible(node, target, parent_for=None):
    """Return True if node should appear for the given target ('web' or 'resume').

    Visibility is inherited from parent, then narrowed by the node's own
    'for' and/or 'hide_from' fields.  Keys starting with '_' are always
    context/notes and are never rendered.
    """
    allowed = set(parent_for) if parent_for else set(ALL_TARGETS)
    if 'for' in node:
        allowed &= set(node['for'])
    if 'hide_from' in node:
        allowed -= set(node['hide_from'])
    return target in allowed


def parts_to_html(parts):
    out = []
    for p in parts:
        if isinstance(p, str):
            out.append(p)
        else:
            out.append(f'<a href="{p["url"]}">{p["text"]}</a>')
    return ''.join(out)


def ul(items, target, parent_for=None):
    """Render a <ul>, filtering items by visibility for the given target."""
    section_for = None
    if parent_for is not None:
        section_for = parent_for

    rows = []
    for item in items:
        if not visible(item, target, section_for):
            continue
        rows.append(f'  <li>{parts_to_html(item["parts"])}</li>')
    if not rows:
        return ''
    return f'<ul>\n' + '\n'.join(rows) + '\n</ul>'


def render_experience(entries, target):
    out = []
    for e in entries:
        if not visible(e, target):
            continue
        row = (
            f'<div class="exp-entry">'
            f'<div class="exp-header">'
            f'<span class="role">{e["role"]}</span>'
            f'<span class="org">{e["org"]}</span>'
            f'<span class="years">{e["years"]}</span>'
            f'</div>'
        )
        if e.get('bullets'):
            bullets = '\n'.join(f'  <li>{b}</li>' for b in e['bullets'])
            row += f'<ul class="exp-bullets">\n{bullets}\n</ul>'
        row += '</div>'
        out.append(row)
    return '\n'.join(out)


def render_llms(r):
    social = '\n'.join(
        f'- {s["name"]}: {s["url"]}'
        for s in r['social']
        if visible(s, 'web')
    )

    return f"""# {r['name']}

> {r['title']} based in {r['location']}.

{r['about']}

Last updated: {r['last_updated']}

Contact:
- Email: {r['email']}
- Website: https://de3ug.github.io/
{social}

## More information

- [resume.json](https://de3ug.github.io/resume.json): Canonical structured profile data for this site. It contains the full content hierarchy, including public webpage content, resume-only highlights, hidden older/background entries and editorial notes.
- [resume.pdf](https://de3ug.github.io/resume.pdf): One-page resume generated from the same JSON source, limited to the highest-priority highlights.

LLM agents should prefer `resume.json` when they need deeper context than this short summary. The `hide_from`, `for` and underscore-prefixed fields describe what is rendered to the public webpage, what is included in the resume and what is retained as background context.
"""


def render_html(r, target='resume'):
    exp_html = render_experience(r['experience'], target)
    social = ' &nbsp;&middot;&nbsp; '.join(
        f'<a href="{s["url"]}">{s["name"]}</a>'
        for s in r['social']
        if visible(s, target)
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
    font-size: 9pt;
    line-height: 1.35;
    color: #111;
  }}
  h1 {{
    font-size: 20pt;
    font-weight: normal;
    letter-spacing: 0.02em;
    margin-bottom: 2pt;
  }}
  .subtitle {{
    font-size: 9.5pt;
    color: #444;
    margin-bottom: 6pt;
  }}
  hr {{
    border: none;
    border-top: 0.75pt solid #999;
    margin: 5pt 0;
  }}
  h2 {{
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #333;
    margin: 7pt 0 2pt;
  }}
  p {{ margin-bottom: 3pt; }}
  ul {{
    padding-left: 12pt;
    margin-bottom: 1pt;
  }}
  li {{ margin-bottom: 1pt; }}
  a {{ color: #111; text-decoration: none; }}
  .exp-entry {{ margin-bottom: 3pt; }}
  .exp-header {{ display: flex; width: 100%; }}
  .exp-header .role  {{ font-weight: bold; width: 38%; }}
  .exp-header .org   {{ width: 40%; color: #333; }}
  .exp-header .years {{ width: 22%; text-align: right; color: #555; white-space: nowrap; }}
  .exp-bullets {{ padding-left: 12pt; margin: 1pt 0 1pt; }}
  .exp-bullets li {{ margin-bottom: 1pt; }}
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
  <div class="subtitle">{r['title']}</div>
  <hr>

  <h2>About</h2>
  <p>{r['about']}</p>

  <h2>Selected Publications &amp; Service</h2>
  <p>{parts_to_html(r['publications_intro']['parts'])}</p>
  {ul(r['publications'], target)}

  <h2>Selected Patents</h2>
  <p>{r['patents_intro']}</p>
  {ul(r['patents'], target)}

  {f'<h2>Selected Projects</h2>{ul(r["projects"], target)}' if ul(r['projects'], target) else ''}

  <h2>Education &amp; Work History</h2>
  {exp_html}

  <div class="footer">
    {r['email']} &nbsp;&middot;&nbsp; {r['location']} &nbsp;&middot;&nbsp; {social}
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

    # Printable area: Letter (11in) minus top+bottom margins (0.7in each) = 9.6in
    # At 96 CSS px/in, usable height = 921.6px; width (8.5in - 2*0.75in) = 7in = 672px
    PRINT_W_PX = int(7.0 * 96)    # 672
    PRINT_H_PX = int(9.6 * 96)    # 921

    tmp = REPO_ROOT / '_resume_tmp.html'
    try:
        tmp.write_text(html, encoding='utf-8')
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.set_viewport_size({'width': PRINT_W_PX, 'height': PRINT_H_PX})
            page.goto(tmp.as_uri())
            page.emulate_media(media='print')

            # Measure rendered content height in print layout and compute scale to fit one page
            content_h = page.evaluate('document.documentElement.scrollHeight')
            scale = min(1.0, PRINT_H_PX / content_h)
            if scale < 1.0:
                print(f'Content height {content_h}px > {PRINT_H_PX}px; scaling to {scale:.3f}')

            page.pdf(
                path=str(OUTPUT_PDF),
                format='Letter',
                margin={'top': '0.7in', 'right': '0.75in',
                        'bottom': '0.7in', 'left': '0.75in'},
                print_background=True,
                scale=scale,
            )
            browser.close()
    finally:
        tmp.unlink(missing_ok=True)

    print(f'PDF written -> {OUTPUT_PDF.relative_to(REPO_ROOT)}')


def build_llms():
    r = load()
    OUTPUT_LLMS.write_text(render_llms(r), encoding='utf-8')
    print(f'llms.txt written -> {OUTPUT_LLMS.relative_to(REPO_ROOT)}')


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
        '--format', choices=['pdf', 'llms', 'web'], default='pdf',
        help='pdf: generate site/resume.pdf and site/llms.txt  |  llms: generate site/llms.txt  |  web: start local dev server'
    )
    args = parser.parse_args()

    if args.format == 'web':
        serve_web()
    elif args.format == 'llms':
        build_llms()
    else:
        build_pdf()
        build_llms()


if __name__ == '__main__':
    main()
