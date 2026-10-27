# de3ug.github.io

This repository contains the sources for [de3ug.github.io](https://de3ug.github.io/). All public files live in the `site/` directory and are deployed automatically to GitHub Pages.

The homepage includes publications, service and patents in one section, projects, work experience, and a Personal/Hobbies area that also lists writing.

## How the site is structured

The deployed site is intentionally simple: `site/` is the public web root. GitHub Actions copies `site/` into a temporary `dist/` directory and publishes that to the `gh-pages` branch. The `docs/` directory is not the live GitHub Pages root for this setup.

The main page is split into a static shell and data-driven content:

- `site/index.html` defines the homepage shell and empty section containers.
- `site/css/site.css` and `site/js/navigation.js` provide the shared sidebar, layout, and theme styling for the homepage, writing pages, and dataset page.
- `site/js/render.js` fetches `site/context.json` in the browser and fills the homepage sections.
- `site/js/theme-toggle.js` handles the light/dark theme toggle.
- `site/writing/` contains the writing archive and standalone long-form articles.
- `site/css/writing.css` adds reading and dataset layouts to the common site styles.
- `site/datasets/viper/` contains the dataset landing page, original ZIP, and citation file.
- `site/resume.pdf` is the printable one-page resume artifact.
- `site/full-cv.pdf` is the full CV, with complete experience, education, service, publications and patents.
- `site/llms.txt` is a short LLM-readable summary artifact that points agents to `context.json`.
- `site/gcmap/` is a standalone static demo app for mapping great-circle flight routes.
- `site/assets/`, `site/papers/`, `site/privacy.html` and `site/robots.txt` are static public assets.

## Resume data model

`site/context.json` is the source of truth for the personal, professional and resume content. It intentionally contains more information than any single output needs.

The JSON has a hierarchy of information:

- It contains the full content inventory, including public profile text, writing metadata, publications, patents, media mentions, experience, hobbies, contact links and background notes.
- Most current, public-facing items are rendered into the webpage.
- Some older school, internship and early-career details are kept in the JSON for context but hidden from the webpage because they are no longer central to the public portfolio.
- Only the most important highlights are included in the one-page resume PDF.

Visibility is controlled with fields such as `hide_from` and `for`, with targets `web`, `resume` and `cv`. These fields can be applied to a whole item or an individual linked part. For example, an item can appear on the webpage but not the resume, a supplementary link can remain web-only, or an entry can remain in the JSON as background context. Underscore-prefixed fields such as `_notes` are editorial/context notes and are not rendered.

`build.py` reads the same JSON and generates both PDFs, keeping the resume concise while preserving a richer content hierarchy for the website and CV.

The CV uses explicitly curated `cv_bullets` on experience entries, falling back to ordinary `bullets` when no CV override exists. Entries marked `cv_section: "education"` appear in Education rather than the employment history. The combined resume-only education entry stays exclusive to the one-page resume. Older roles hidden from both `web` and `resume` remain eligible for `cv`; exclude an entry from the CV explicitly with `hide_from: ["cv"]` when appropriate. The renderer never copies `_notes`, career stories, writing or hobbies into the CV.

The `cv` collection stores the complete publication and patent catalog, professional service and source provenance. The existing top-level `publications` and `patents` remain the selected summaries used by the website and one-page resume. Maintain the selected summaries and complete metadata together in this one JSON source; the CV does not scrape external sources at build time.

The CV catalog reconciles all 66 records in the Google Scholar profile as observed on October 23, 2026: 18 scholarly entries, two supplements attached to their papers, 44 patent grants and two published patent applications. Author corrections identify one scholarly entry as accepted and withdrawn before publication following a late-stage internal publication approval review; the work was later published at the 2nd International Workshop on Robust Reading (IWRR), held with ECCV in 2016. Publication `status` is printed when present, preserving proper-name capitalization. Two Scholar application records are represented by their later grants, with application-publication identifiers retained in the JSON. Every patent remains a separate source record. The PDF groups matching titles and inventor sets into one citation, preserving each identifier, date and clickable link. This is a presentation rule, not an inference about legal patent families. The current 46 records appear as 28 citations; records with different inventor sets remain separate. Inventor lists were reconciled against Google Patents. Malformed Scholar volume/page fields for the PETS 2007, BMVC 2005 and ICDAR 2013 records are omitted. Bibliographic links and verification dates stay in the structured source; the PDF presents a simple patent count and list, with inline labels for applications.

Uncertain career dates stay in underscore-prefixed notes until confirmed. In particular, ACVC service records two lead-organizer stints including 2020, while the recalled earlier year (approximately 2016) and the WACV area-chair year remain undated in the CV.

The CV is typeset with ReportLab in `build_cv.py`, with embedded fonts, natural pagination, page numbers and absolute clickable links. It uses 10.5-point body text and 10-point bibliography text, has no page limit and does not shrink text to fit. Install the build dependencies and generate artifacts with:

```bash
python3 -m pip install playwright reportlab
python3 -m playwright install chromium
python3 build.py                  # both PDFs and llms.txt
python3 build.py --format=cv      # full CV and llms.txt only
python3 build.py --format=resume  # one-page resume and llms.txt only
```

During the owner's publication hold, generate only a local review PDF instead:

```bash
python3 build.py --format=cv --cv-output=output/pdf/full-cv.pdf
python3 -m unittest test_cv.py
```

`--cv-output` leaves all existing site artifacts untouched and does not regenerate `llms.txt`. The `output/` directory is ignored by Git and sits outside the served site. A private Tailscale review requires the owner's explicit authorization and does not release the hold on pushes or public deployment. Rebuild site artifacts from the reviewed source before an authorized publication.

Long-form prose does not live in `context.json`. The `writing` collection stores discoverability metadata such as title, summary, publication date, canonical URL and site-relative path. Each article owns its full content and assets under `site/writing/<slug>/`; this keeps the résumé data useful as a directory without turning it into a document format.

Writing appears under Personal/Hobbies on the homepage. The separate `/writing/` archive and article pages use the same sidebar and light/dark controls as the portfolio. The VIPeR article lives at `/writing/twenty-years-of-person-re-identification/`; the previous preview slug redirects there.

The VIPeR download page is `/datasets/viper/`. Its ZIP is the exact historical v1.0 archive, with checksums and the original citation. The homepage dataset entry is web-only. The essay's citation chart uses manually observed Google Scholar article histograms, stored with source URLs and observation date in `assets/scholar-citations.json`. Run `python3 build_citation_chart.py` with Matplotlib installed to regenerate it.

The essay's performance scatter plot uses `assets/rank-one-scatter.json`, which records reported results, evaluation settings, dates, and paper sources. Run `python3 build_rank_one_chart.py` with Matplotlib installed to regenerate `assets/rank-one-scatter.png`. The plot distinguishes training settings and is not a controlled leaderboard.

The essay's informal Haiku/Opus experiment is documented separately in `assets/foundation-model-evaluation.json`, including prompts, aggregate counts, and evaluation limits. It is a single-split observation, not an additional literature-chart milestone or a five-repeat benchmark estimate.

The `last_updated` field in `site/context.json` is also the source of truth for the "Last updated" text shown on the website, the PDF resume and the generated `llms.txt` summary. When changing profile content or rebuilding artifacts, update this date in the JSON.

## LLM-readable summary

`site/llms.txt` follows the emerging `/llms.txt` convention: it is a short plain-text Markdown guide for LLM agents. It intentionally does not duplicate the whole site. Instead, it includes the name, short about text, contact details and a note that deeper structured information is available in `context.json`.

Treat `site/llms.txt` as a generated file. To refresh it after editing `site/context.json`, run:

```bash
python3 build.py --format=llms
```

Running `python3 build.py` for either PDF also refreshes `site/llms.txt`.

Because deployment copies `site/` as-is, generated artifacts such as `site/resume.pdf`, `site/full-cv.pdf` and `site/llms.txt` should be committed after they are rebuilt.

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
