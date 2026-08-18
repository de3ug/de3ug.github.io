# Project Overview
This repository hosts the static files for https://de3ug.github.io/. The site is a lightweight portfolio and demo space for experiments. Content is deployed automatically to the `gh-pages` branch via GitHub Actions. Pull requests get a preview URL so changes can be reviewed before merge.

# Coding Conventions
- Use 2-space indentation for all files.
- JavaScript must target ECMAScript 2020 and avoid frameworks. `three.js` and `jQuery` are allowed.
- Place JavaScript inside `/js` and CSS inside `/css` under `site/`.
- Keep everything compatible with modern evergreen browsers.

# Dependencies
- **Allowed:** vanilla JS, three.js, jQuery, simple client‑side utilities.
- **Forbidden:** React, Vue, Svelte, Angular, TypeScript, Node based build tools.

# Commit Message Template
Use conventional style messages:
- `feat: <description>` for new features.
- `fix: <description>` for bug fixes.
- `docs: <description>` for documentation only changes.

# PR Checklist
- [ ] HTML validator passes in CI.
- [ ] Preview link posted by the action.
- [ ] Documentation updated when relevant.

# Future Ideas / TODO
- Add more demos in `/site/gcmap`.
- Improve styling and accessibility.
