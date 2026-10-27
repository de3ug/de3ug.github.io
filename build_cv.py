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


def group_patents(entries):
  """Group matching titles and inventor sets for display, retaining every record."""
  def normalized(value):
    return ' '.join(clean(value).casefold().replace('.', '').split())

  groups = []
  positions = {}
  for entry in entries:
    key = (normalized(entry['title']),
           tuple(sorted(normalized(name) for name in entry['inventors'])))
    if key not in positions:
      positions[key] = len(groups)
      groups.append([])
    groups[positions[key]].append(entry)
  return groups


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
    if entry['kind'] not in ('grant', 'application'):
      raise ValueError(f'Unknown patent record kind: {number}')
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
  base = ParagraphStyle('Body', fontName='CVSans', fontSize=10.5, leading=15.5,
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
    'contact': ParagraphStyle('Contact', parent=base, fontSize=10, leading=14,
                              textColor=muted, spaceAfter=3),
    'section': ParagraphStyle('Section', parent=base, fontName='CVSans-Bold',
                              fontSize=12.5, leading=17, textColor=accent,
                              spaceBefore=15, spaceAfter=8, keepWithNext=True),
    'role': ParagraphStyle('Role', parent=base, fontName='CVSans-Bold', fontSize=10.8,
                           leading=15.5, spaceAfter=0, keepWithNext=True),
    'date': ParagraphStyle('Date', parent=base, fontSize=9.2, leading=15.5,
                           textColor=muted, spaceAfter=0, alignment=2),
    'org': ParagraphStyle('Organization', parent=base, fontSize=10, leading=14,
                          textColor=muted, spaceAfter=5, keepWithNext=True),
    'bullet': ParagraphStyle('Bullet', parent=base, leftIndent=11, firstLineIndent=0,
                             bulletIndent=0, spaceAfter=4),
    'reference': ParagraphStyle('Reference', parent=base, fontSize=10, leading=14.5,
                                leftIndent=26, firstLineIndent=-26, spaceAfter=9),
    'note': ParagraphStyle('Note', parent=base, fontSize=9.2, leading=13,
                           textColor=muted, spaceAfter=10),
  }
  width, height = letter
  margin = 0.7 * inch
  content_width = width - 2 * margin

  def paragraph(value, style='body'):
    return Paragraph(value, styles[style])

  def section(title):
    return paragraph(text(title), 'section')

  def career_entry(entry, section_title=None):
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
    if section_title:
      heading.insert(0, section(section_title))
    # Keep a role on one page when it fits; ReportLab can split oversized groups.
    return [KeepTogether([*heading, *bullets]), Spacer(1, 8)]

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

  education_started = False
  for entry in r['experience']:
    if visible(entry, 'cv') and entry.get('cv_section') == 'education':
      story.extend(career_entry(entry, None if education_started else 'Education'))
      education_started = True

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
    if entry.get('status'):
      status = entry['status']
      details += f' <i>{text(status[:1].upper() + status[1:])}.</i>'
    if entry.get('doi'):
      details += f' {link("DOI", "https://doi.org/" + entry["doi"])}.'
    for supplement in entry.get('supplements', []):
      details += f' {link("Supplementary material", supplement["url"])}.'
    story.append(paragraph(details, 'reference'))

  story.extend([section('Professional Service')])
  for entry in cv['service']:
    details = f'<b>{text(entry["role"])}</b>. {text(entry["details"])}'
    if entry.get('url'):
      details += f' {link("Website", entry["url"])}.'
    story.append(paragraph(details))

  grants = [p for p in cv['patents'] if p['kind'] == 'grant']
  applications = [p for p in cv['patents'] if p['kind'] == 'application']
  story.extend([PageBreak(), section('Patents'), paragraph(
    f'{len(grants)} U.S. patents and {len(applications)} applications.', 'note')])
  for index, members in enumerate(group_patents([*grants, *applications]), 1):
    entry = members[0]
    identifiers = []
    for member in members:
      application_label = ' (application)' if member['kind'] == 'application' else ''
      identifiers.append(f'{link(member["publication_number"], member["url"])}'
                         f'{application_label} ({text(member["date"])})')
    details = (f'[P{index:02d}] <b>{link(entry["title"], entry["url"])}</b>. '
               f'{author_names(entry["inventors"])}. '
               f'{"; ".join(identifiers)}.')
    if len(members) > 1:
      kinds = {member['kind'] for member in members}
      if kinds == {'grant'}:
        details += ' Related patents.'
      elif kinds == {'application'}:
        details += ' Related applications.'
      else:
        details += ' Patent and application.'
    story.append(paragraph(details, 'reference'))

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
