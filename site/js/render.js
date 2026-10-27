// Renders all page content from context.json.
// Each list item uses a "parts" array where each part is either
// a plain string or {text, url} for a hyperlink. Visibility controls can be
// applied to an entire item or an individual linked part.

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function visible(item, target) {
  let allowed = new Set(['web', 'resume']);
  if (item.for) allowed = new Set(item.for);
  if (item.hide_from) item.hide_from.forEach(t => allowed.delete(t));
  return allowed.has(target);
}

function renderParts(parts, target = 'web') {
  return parts
    .filter(p => typeof p === 'string' || visible(p, target))
    .map(p => typeof p === 'string'
      ? esc(p)
      : `<a href="${esc(p.url)}">${esc(p.text)}</a>`)
    .join('');
}

function renderList(items, target = 'web') {
  const rows = items
    .filter(item => visible(item, target))
    .map(item => `<li>${renderParts(item.parts, target)}</li>`)
    .join('');
  return rows ? `<ul>${rows}</ul>` : '';
}

function renderExperience(entries) {
  return entries
    .filter(e => visible(e, 'web'))
    .map(e => {
      let html = `<p><strong>${esc(e.role)}</strong>, ${esc(e.org)} (${esc(e.years)})</p>`;
      if (e.bullets && e.bullets.length) {
        html += '<ul>' + e.bullets.map(b => `<li>${esc(b)}</li>`).join('') + '</ul>';
      }
      return html;
    }).join('');
}

function injectJsonLd(r) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    'name': r.name,
    'jobTitle': r.title,
    'description': r.about,
    'email': r.email,
    'url': 'https://de3ug.github.io/',
    'sameAs': r.social.map(s => s.url)
  };
  const writing = (r.writing || []).filter(entry => visible(entry, 'web'));
  if (writing.length) {
    ld.subjectOf = writing.map(entry => ({
      '@type': 'Article',
      'headline': entry.title,
      'url': entry.url,
      'dateCreated': entry.date
    }));
  }
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(ld, null, 2);
  document.head.appendChild(script);
}

async function render() {
  const res = await fetch('context.json');
  const r = await res.json();

  document.title = `${r.name} - Portfolio`;

  // About
  document.querySelector('#about').innerHTML =
    `<h1>${esc(r.name)}</h1>` +
    `<p>${esc(r.about)}</p>`;

  // Publications
  const mediaHtml = renderList(r.projects);
  document.querySelector('#publications').innerHTML =
    `<h2>Publications and Service</h2>` +
    `<h3 class="subsection-title">Selected Publications</h3>` +
    `<p>${renderParts(r.publications_intro.parts)}</p>` +
    renderList([...r.publications, ...(r.datasets || [])]) +
    `<p>${esc(r.reviewer_service)}</p>` +
    `<h3 id="patents" class="subsection-title">Selected Patents</h3>` +
    `<p>${esc(r.patents_intro)}</p>` +
    renderList(r.patents) +
    (mediaHtml ? `<h3 id="projects" class="subsection-title">Selected Media Mentions</h3>${mediaHtml}` : '');

  // Experience
  document.querySelector('#experience').innerHTML =
    `<h2>Education &amp; Work History</h2>` +
    renderExperience(r.experience);

  // Personal writing and hobbies
  const writingItems = (r.writing || []).map(entry => ({
    ...entry,
    parts: [{text: entry.title, url: entry.path || entry.url}]
  }));
  let hobbiesHtml = `<h2>Personal, Hobbies, and Writing</h2>` +
    renderList([...writingItems, ...r.hobbies]);
  if (r.hobby_poem && visible(r.hobby_poem, 'web')) {
    const p = r.hobby_poem;
    const body = p.lines.map(esc).join('<br>');
    const author = p.author_url
      ? `<a href="${esc(p.author_url)}">${esc(p.author)}</a>`
      : esc(p.author);
    hobbiesHtml +=
      `<blockquote class="poem">${body}` +
      `<cite>&mdash; ${author}</cite></blockquote>`;
  }
  document.querySelector('#hobbies').innerHTML = hobbiesHtml;

  // Contact
  document.querySelector('#contact').innerHTML =
    `<h2>Contact</h2>` +
    `<p>Based in ${esc(r.location)}.</p>` +
    `<p>Email: <a href="mailto:${esc(r.email)}">${esc(r.email)}</a></p>` +
    `<ul>${r.social.map(s => `<li><a href="${esc(s.url)}">${esc(s.name)}</a></li>`).join('')}</ul>` +
    `<p><em>Last updated: ${esc(r.last_updated)} &mdash; <a href="privacy.html">Privacy notice</a></em></p>`;

  injectJsonLd(r);
}

render().catch(console.error);
