function writingEsc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writingVisible(item) {
  return !(item.hide_from || []).includes('web');
}

async function renderWritingIndex() {
  const root = document.querySelector('[data-writing-index]');
  if (!root) return;

  const response = await fetch(root.dataset.resumeSrc);
  if (!response.ok) throw new Error(`Could not load writing metadata (${response.status})`);

  const resume = await response.json();
  const entries = (resume.writing || []).filter(writingVisible);
  if (!entries.length) {
    root.innerHTML = '<p class="writing-empty">No writing has been published yet.</p>';
    return;
  }

  root.innerHTML = entries.map((entry) => {
    const href = new URL(entry.path, response.url).href;
    const image = new URL(entry.image, response.url).href;
    const status = entry.status ? `${entry.status} · ` : '';
    return `
      <article class="writing-row">
        <a href="${writingEsc(href)}" aria-label="Read ${writingEsc(entry.title)}">
          <img src="${writingEsc(image)}" alt="${writingEsc(entry.image_alt)}">
        </a>
        <div>
          <p class="writing-date">${writingEsc(status + entry.date_display)}</p>
          <h2><a href="${writingEsc(href)}">${writingEsc(entry.title)}</a></h2>
          <p>${writingEsc(entry.summary)}</p>
          <p class="reading-note">${writingEsc(entry.reading_time)} read</p>
        </div>
      </article>`;
  }).join('');
}

renderWritingIndex().catch((error) => {
  console.error(error);
  const root = document.querySelector('[data-writing-index]');
  if (root) root.innerHTML = '<p class="writing-empty">Writing could not be loaded.</p>';
});
