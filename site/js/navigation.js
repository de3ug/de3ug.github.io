const siteNavigation = document.querySelector('[data-site-root]');

if (siteNavigation) {
  const base = siteNavigation.dataset.siteRoot;
  const home = base === './';
  const section = (id) => home ? `#${id}` : `${base}#${id}`;
  siteNavigation.innerHTML = `
    <div class="profile">
      <a href="${base}" aria-label="Douglas Gray home">
        <img class="profile-pic" src="${base}assets/img/profile_pic.jpg" alt="Portrait of Douglas Gray">
      </a>
    </div>
    <a href="${section('about')}">About</a>
    <a href="${section('publications')}">Publications &amp; Service</a>
    <a href="${section('experience')}">Experience</a>
    <a href="${section('hobbies')}">Personal, Hobbies &amp; Writing</a>
    <a href="${section('contact')}">Contact</a>
    <hr class="nav-divider">
    <button class="theme-toggle" type="button" data-theme-toggle>&#127769; Dark</button>
    <div class="nav-artifacts">
      <a href="${base}resume.pdf">R&eacute;sum&eacute;</a>
      <a href="${base}cv.pdf">Full CV</a>
      <a href="${base}resume.json">JSON</a>
      <a href="${base}llms.txt">LLMs</a>
    </div>`;
}
