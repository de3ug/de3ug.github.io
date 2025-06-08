# de3ug.github.io

This repository contains the sources for [de3ug.github.io](https://de3ug.github.io/). All public files live in the `site/` directory and are deployed automatically to GitHub Pages.

## Local dev

Run a simple static server and open the site:

```bash
python3 -m http.server -d site
```
Then visit <http://localhost:8000>.

## Continuous deployment

Two GitHub Actions workflows keep the site up to date:

1. **Deploy** – runs on every push to `main`. The action copies `site/` into `dist/` and publishes it to the `gh-pages` branch using `peaceiris/actions-gh-pages`.
2. **Preview** – runs on pull requests. It also copies `site/` into `dist/` and posts a preview link in the PR via `rossjrw/pr-preview-action`.

The HTML validator step fails the build if `site/index.html` contains validation errors.
