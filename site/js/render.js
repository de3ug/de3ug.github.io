// Renders all page content from resume.json.
// Each list item uses a "parts" array where each part is either
// a plain string or {text, url} for a hyperlink.

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderParts(parts) {
  return parts.map(p =>
    typeof p === 'string'
      ? esc(p)
      : `<a href="${esc(p.url)}">${esc(p.text)}</a>`
  ).join('');
}

function renderList(items) {
  return '<ul>' + items.map(item => `<li>${renderParts(item.parts)}</li>`).join('') + '</ul>';
}

function injectJsonLd(r) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    'name': r.name,
    'jobTitle': r.title,
    'description': r.tagline + ' ' + r.about,
    'url': 'https://de3ug.github.io/',
    'sameAs': r.social.map(s => s.url)
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(ld, null, 2);
  document.head.appendChild(script);
}

async function render() {
  const res = await fetch('resume.json');
  const r = await res.json();

  document.title = `${r.name} - Portfolio`;

  // About
  document.querySelector('#about').innerHTML =
    `<h1>${esc(r.name)}</h1>` +
    `<p>${esc(r.title)} &mdash; ${esc(r.tagline)}</p>` +
    `<p>${esc(r.about)}</p>`;

  // Publications
  document.querySelector('#publications').innerHTML =
    `<h2>Selected Publications and Service</h2>` +
    renderList(r.publications);

  // Patents
  document.querySelector('#patents').innerHTML =
    `<h2>Selected Patents</h2>` +
    `<p>${esc(r.patents_intro)}</p>` +
    renderList(r.patents);

  // Projects
  document.querySelector('#projects').innerHTML =
    `<h2>Selected Projects and News Articles</h2>` +
    renderList(r.projects);

  // Experience
  document.querySelector('#experience').innerHTML =
    `<h2>Education &amp; Work History</h2>` +
    r.experience.map(e =>
      `<p><strong>${esc(e.role)}</strong>, ${esc(e.org)} (${esc(e.years)})</p>`
    ).join('');

  // Hobbies
  document.querySelector('#hobbies').innerHTML =
    `<h2>Personal &amp; Hobbies</h2>` +
    renderList(r.hobbies);

  // Contact
  document.querySelector('#contact').innerHTML =
    `<h2>Contact</h2>` +
    `<p>Based in ${esc(r.location)}.</p>` +
    `<p>Email: ${esc(r.email_hint)}</p>` +
    `<ul>${r.social.map(s => `<li><a href="${esc(s.url)}">${esc(s.name)}</a></li>`).join('')}</ul>` +
    `<p><em>Last updated: ${esc(r.last_updated)} &mdash; <a href="privacy.html">Privacy notice</a></em></p>`;

  // Always inject JSON-LD for structured data (helps all modes including agent)
  injectJsonLd(r);
}

render().catch(console.error);
