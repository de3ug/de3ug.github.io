#!/usr/bin/env python3
"""Typeset the complete, curated CV from the shared resume.json inventory."""

from html import escape
from pathlib import Path
import re
from urllib.parse import urljoin


SITE_URL = 'https://de3ug.github.io/'


def clean(value):
  """Use ordinary spaces and hyphens consistently in the printable document."""
  return str(value).translate(str.maketrans({
    '\u00a0': ' ', '\u2011': '-', '\u2013': '-', '\u2014': ' - ', '\u2212': '-'
  }))


def text(value):
  return escape(clean(value))


def link(label, url):
  absolute = urljoin(SITE_URL, url)
  if not absolute.startswith(('https://', 'mailto:')):
    raise ValueError(f'Unsupported CV link: {absolute}')
  return f'<a href="{escape(absolute, quote=True)}" color="#234f62">{text(label)}</a>'


def author_names(names):
  rendered = []
  for name in names:
    value = text(name)
    if re.fullmatch(r'(Douglas(?: Ryan| R\.?)?|Doug|D\.?(?: R\.?)?) Gray', name):
      value = f'<b>{value}</b>'
    rendered.append(value)
  return ', '.join(rendered)


def validate_cv(r, visible):
  """Reject incomplete records rather than silently producing a partial CV."""
  cv = r['cv']
  for field in ('summary', 'publications', 'patents', 'service', 'sources'):
    if not cv.get(field):
      raise ValueError(f'Missing CV field: {field}')
  for entry in r['experience']:
    if visible(entry, 'cv') and not entry.get('cv_bullets', entry.get('bullets')):
      raise ValueError(f'Missing CV bullets: {entry["role"]}, {entry["org"]}')
  seen = set()
  for entry in cv['patents']:
    number = entry['publication_number']
    if number in seen:
      raise ValueError(f'Duplicate patent publication: {number}')
    seen.add(number)
    for field in ('title', 'inventors', 'date', 'kind', 'url', 'application_number'):
      if not entry.get(field):
        raise ValueError(f'Missing patent {field}: {number}')
  for entry in cv['publications']:
    for field in ('title', 'authors', 'year', 'venue', 'url'):
      if not entry.get(field):
        raise ValueError(f'Missing publication {field}: {entry.get("title")}')


def write_cv(r, output, visible):
  try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (
      BaseDocTemplate, Frame, HRFlowable, KeepTogether, PageBreak, PageTemplate,
      Paragraph, Spacer, Table, TableStyle
    )
    import reportlab
  except ImportError as exc:
    raise SystemExit('CV generation requires reportlab: pip install reportlab') from exc

  validate_cv(r, visible)
  cv = r['cv']
  # ReportLab ships these fonts, so the output is portable across build hosts.
  fonts = Path(reportlab.__file__).parent / 'fonts'
  for suffix, filename in (('', 'Vera.ttf'), ('-Bold', 'VeraBd.ttf'),
                           ('-Italic', 'VeraIt.ttf'), ('-BoldItalic', 'VeraBI.ttf')):
    pdfmetrics.registerFont(TTFont(f'CVSans{suffix}', str(fonts / filename)))
  pdfmetrics.registerFontFamily('CVSans', normal='CVSans', bold='CVSans-Bold',
                               italic='CVSans-Italic', boldItalic='CVSans-BoldItalic')

  ink = colors.HexColor('#192b35')
  muted = colors.HexColor('#56636a')
  accent = colors.HexColor('#234f62')
  rule = colors.HexColor('#c4cdd1')
  base = ParagraphStyle('Body', fontName='CVSans', fontSize=9.7, leading=14,
                        textColor=ink, spaceAfter=5, alignment=TA_LEFT,
                        allowWidows=0, allowOrphans=0)
  styles = {
    'body': base,
    'name': ParagraphStyle('Name', parent=base, fontName='Times-Roman', fontSize=29,
                           leading=33, spaceAfter=4),
    'eyebrow': ParagraphStyle('Eyebrow', parent=base, fontSize=8.3, leading=11,
                              textColor=accent, spaceAfter=8),
    'subtitle': ParagraphStyle('Subtitle', parent=base, fontSize=11, leading=15,
                               spaceAfter=6),
    'contact': ParagraphStyle('Contact', parent=base, fontSize=8.4, leading=12,
                              textColor=muted, spaceAfter=3),
    'section': ParagraphStyle('Section', parent=base, fontName='CVSans-Bold',
                              fontSize=12, leading=16, textColor=accent,
                              spaceBefore=15, spaceAfter=8, keepWithNext=True),
    'role': ParagraphStyle('Role', parent=base, fontName='CVSans-Bold', fontSize=10,
                           leading=14, spaceAfter=0, keepWithNext=True),
    'date': ParagraphStyle('Date', parent=base, fontSize=8.6, leading=14,
                           textColor=muted, spaceAfter=0, alignment=2),
    'org': ParagraphStyle('Organization', parent=base, fontSize=9.2, leading=13,
                          textColor=muted, spaceAfter=5, keepWithNext=True),
    'bullet': ParagraphStyle('Bullet', parent=base, leftIndent=11, firstLineIndent=0,
                             bulletIndent=0, spaceAfter=4),
    'reference': ParagraphStyle('Reference', parent=base, fontSize=9.1, leading=13.1,
                                leftIndent=26, firstLineIndent=-26, spaceAfter=9),
    'note': ParagraphStyle('Note', parent=base, fontSize=8.3, leading=12,
                           textColor=muted, spaceAfter=10),
  }
  width, height = letter
  margin = 0.7 * inch
  content_width = width - 2 * margin

  def paragraph(value, style='body'):
    return Paragraph(value, styles[style])

  def section(title):
    return paragraph(text(title), 'section')

  def career_entry(entry):
    header = Table([[
      paragraph(text(entry['role']), 'role'),
      paragraph(text(entry['years']), 'date')
    ]], colWidths=[content_width - 116, 116])
    header.setStyle(TableStyle([
      ('LEFTPADDING', (0, 0), (-1, -1), 0),
      ('RIGHTPADDING', (0, 0), (-1, -1), 0),
      ('TOPPADDING', (0, 0), (-1, -1), 0),
      ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
      ('VALIGN', (0, 0), (-1, -1), 'TOP')
    ]))
    bullets = [paragraph(text(value), 'bullet')
               for value in entry.get('cv_bullets', entry.get('bullets', []))]
    for bullet in bullets:
      bullet.bulletText = '-'
    heading = [header, paragraph(text(entry['org']), 'org')]
    if sum(len(value) for value in entry.get('cv_bullets', entry.get('bullets', []))) < 900:
      return [KeepTogether([*heading, *bullets]), Spacer(1, 8)]
    return [KeepTogether([*heading, bullets[0]]), *bullets[1:], Spacer(1, 8)]

  story = [
    paragraph('CURRICULUM VITAE', 'eyebrow'),
    paragraph(text(r['name']), 'name'),
    paragraph(text(r['title']), 'subtitle'),
    paragraph(f'{link(r["email"], "mailto:" + r["email"])}  |  '
              f'{link("de3ug.github.io", SITE_URL)}', 'contact'),
    paragraph('  |  '.join([
      text('Portola Valley, California'),
      *[link(s['name'], s['url']) for s in r['social']
        if s['name'] in ('Google Scholar', 'LinkedIn')]
    ]), 'contact'),
    Spacer(1, 8),
    HRFlowable(width='100%', thickness=0.7, color=rule),
    Spacer(1, 10),
    paragraph(text(cv['summary'])),
    section('Professional & Research Experience'),
  ]
  for entry in r['experience']:
    if visible(entry, 'cv') and entry.get('cv_section') != 'education':
      story.extend(career_entry(entry))

  story.append(section('Education'))
  for entry in r['experience']:
    if visible(entry, 'cv') and entry.get('cv_section') == 'education':
      story.extend(career_entry(entry))

  story.extend([section('Professional Service')])
  for entry in cv['service']:
    details = f'<b>{text(entry["role"])}</b>. {text(entry["details"])}'
    if entry.get('url'):
      details += f' {link("Website", entry["url"])}.'
    story.append(paragraph(details))

  story.append(section('Publications'))
  for index, entry in enumerate(cv['publications'], 1):
    details = (f'[{index:02d}] {author_names(entry["authors"])}. '
               f'<b>{link(entry["title"], entry["url"])}</b>. '
               f'<i>{text(entry["venue"])}</i>')
    if entry.get('volume'):
      details += f', {text(entry["volume"])}'
      if entry.get('issue'):
        details += f'({text(entry["issue"])})'
    if entry.get('pages'):
      details += f', pp. {text(entry["pages"])}'
    details += f', {entry["year"]}.'
    if entry.get('doi'):
      details += f' {link("DOI", "https://doi.org/" + entry["doi"])}.'
    for supplement in entry.get('supplements', []):
      details += f' {link("Supplementary material", supplement["url"])}.'
    story.append(paragraph(details, 'reference'))

  grants = [p for p in cv['patents'] if p['kind'] == 'grant']
  applications = [p for p in cv['patents'] if p['kind'] == 'application']
  story.extend([PageBreak(), section('Patents'), paragraph(
    f'{len(grants)} U.S. patent grants and {len(applications)} published '
    'application record' + ('s' if len(applications) != 1 else '') + '. '
    'Related grants in the same family are listed separately. '
    'Dates are grant or application-publication dates, respectively.', 'note')])
  index = 0
  for kind, title in (('grant', 'Granted U.S. Patents'),
                      ('application', 'Published U.S. Patent Applications')):
    entries = [p for p in cv['patents'] if p['kind'] == kind]
    if not entries:
      continue
    story.append(section(title))
    for entry in entries:
      index += 1
      details = (f'[P{index:02d}] <b>{link(entry["title"], entry["url"])}</b>. '
                 f'{author_names(entry["inventors"])}. '
                 f'{text(entry["publication_number"])}; {text(entry["date"])}.')
      if entry.get('application_publication'):
        publication = entry['application_publication']
        details += (' Application publication: ' +
                    link(publication, f'https://patents.google.com/patent/{publication}/en') + '.')
      story.append(paragraph(details, 'reference'))

  story.extend([Spacer(1, 9), paragraph(
    f'Bibliographic records verified {text(cv["sources"]["verified_on"])} against '
    f'{link("Google Scholar", cv["sources"]["scholar"])} and '
    f'{link("Google Patents", cv["sources"]["patents"])}.', 'note')])

  def page_frame(canvas, doc):
    canvas.saveState()
    canvas.setTitle(f'{r["name"]} - Curriculum Vitae')
    canvas.setAuthor(r['name'])
    canvas.setSubject('Complete professional experience, publications and patents')
    canvas.setFont('CVSans', 7.6)
    canvas.setFillColor(muted)
    if doc.page > 1:
      canvas.drawString(margin, height - 0.4 * inch, r['name'])
      canvas.drawRightString(width - margin, height - 0.4 * inch, 'Curriculum vitae')
    canvas.setStrokeColor(rule)
    canvas.setLineWidth(0.4)
    canvas.line(margin, 0.48 * inch, width - margin, 0.48 * inch)
    canvas.drawString(margin, 0.31 * inch, f'Updated {r["last_updated"]}')
    canvas.drawRightString(width - margin, 0.31 * inch, f'Page {doc.page}')
    canvas.restoreState()

  output = Path(output)
  output.parent.mkdir(parents=True, exist_ok=True)
  doc = BaseDocTemplate(str(output), pagesize=letter, rightMargin=margin,
                         leftMargin=margin, topMargin=0.68 * inch,
                         bottomMargin=0.67 * inch, title=f'{r["name"]} - Curriculum Vitae',
                         author=r['name'], pageCompression=1)
  frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height,
                 leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
  doc.addPageTemplates(PageTemplate(id='cv', frames=[frame], onPage=page_frame))
  doc.build(story)
