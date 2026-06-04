# de3ug.github.io

This repository contains the sources for [de3ug.github.io](https://de3ug.github.io/). All public files live in the `site/` directory and are deployed automatically to GitHub Pages.

The homepage includes sections for publications, projects, work experience and a Personal/Hobbies area with links to travel, astrophotography and racing content.

## How the site is structured

The deployed site is intentionally simple: `site/` is the public web root. GitHub Actions copies `site/` into a temporary `dist/` directory and publishes that to the `gh-pages` branch. The `docs/` directory is not the live GitHub Pages root for this setup.

The main page is split into a static shell and data-driven content:

- `site/index.html` defines the layout, navigation, theme styling and empty section containers.
- `site/js/render.js` fetches `site/resume.json` in the browser and fills the homepage sections.
- `site/js/theme-toggle.js` handles the light/dark theme toggle.
- `site/resume.pdf` is the printable one-page resume artifact.
- `site/llms.txt` is a short LLM-readable summary artifact that points agents to `resume.json`.
- `site/gcmap/` is a standalone static demo app for mapping great-circle flight routes.
- `site/assets/`, `site/papers/`, `site/privacy.html` and `site/robots.txt` are static public assets.

## Resume data model

`site/resume.json` is the source of truth for the personal, professional and resume content. It intentionally contains more information than any single output needs.

The JSON has a hierarchy of information:

- It contains the full content inventory, including public profile text, publications, patents, media mentions, experience, hobbies, contact links and background notes.
- Most current, public-facing items are rendered into the webpage.
- Some older school, internship and early-career details are kept in the JSON for context but hidden from the webpage because they are no longer central to the public portfolio.
- Only the most important highlights are included in the one-page resume PDF.

Visibility is controlled with fields such as `hide_from` and `for`. For example, an item can appear on the webpage but not the resume, appear only in the resume, or remain in the JSON as background context. Underscore-prefixed fields such as `_notes` are editorial/context notes and are not rendered.

`build.py` reads the same JSON and generates `site/resume.pdf`, keeping the resume concise while preserving a richer content hierarchy for the website and future edits.

The `last_updated` field in `site/resume.json` is also the source of truth for the "Last updated" text shown on the website, the PDF resume and the generated `llms.txt` summary. When changing profile content or rebuilding artifacts, update this date in the JSON.

## LLM-readable summary

`site/llms.txt` follows the emerging `/llms.txt` convention: it is a short plain-text Markdown guide for LLM agents. It intentionally does not duplicate the whole site. Instead, it includes the name, short about text, contact details and a note that deeper structured information is available in `resume.json`.

Treat `site/llms.txt` as a generated file. To refresh it after editing `site/resume.json`, run:

```bash
python3 build.py --format=llms
```

Running `python3 build.py` for the PDF resume also refreshes `site/llms.txt`.

Because deployment copies `site/` as-is, generated artifacts such as `site/resume.pdf` and `site/llms.txt` should be committed after they are rebuilt.

## Local dev

Run the static server and open the site:

```bash
./serve.sh
```

Then visit <http://localhost:8765>.

`./serve.sh` and `./serve.sh start` run in the foreground by default. Use background mode when you want the server to keep running after the command returns:

```bash
./serve.sh start --bg
./serve.sh stop
./serve.sh restart --bg
```

The port is intentionally fixed at `8765` so local links and tests are stable.

## Continuous deployment

Two GitHub Actions workflows keep the site up to date:

1. **Deploy** – runs on every push to `main`. The action copies `site/` into `dist/` and publishes it to the `gh-pages` branch using `peaceiris/actions-gh-pages`.
2. **Preview** – runs on pull requests. It also copies `site/` into `dist/` and posts a preview link in the PR via `rossjrw/pr-preview-action`.

Both workflows run `tidy -qe site/index.html` (warnings ignored) and `node smoke.js` to catch JavaScript errors. The smoke test launches Chromium with `--dump-dom` and kills it after 10 seconds to avoid hanging. `chromium-browser` is installed automatically if not present.

Failures in the smoke test do not block the deployment or preview. The step runs in diagnostic mode, so check the workflow logs if you need to debug JavaScript issues.

When running the test locally without Chromium, you'll see **"No headless browser found, skipping smoke test"**. This message is not an error—the test simply skips until a browser is installed.

## Privacy notice

The privacy policy required for Login with Amazon lives at `/privacy.html`. It is a simple static page automatically deployed along with the rest of the files in `site/`.
