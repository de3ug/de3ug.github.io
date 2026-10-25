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

<!-- git-hygiene-policy:start -->
## Git hygiene — owner decision, 2026-10-24

- The owner explicitly placed website publication ON HOLD. Preserve the existing local branches and commits. Local commits are allowed; do not push any website branch, publish previews, merge, or deploy until the owner explicitly releases the hold.
- Begin with the repository root, current branch, `git status --short` and `git remote -v`. Account for shared Git metadata when using a worktree.
- Stage explicit files after reviewing the diff. Keep unrelated/pre-existing edits and other agents' work intact; never reset, clean, force-push or rewrite shared history to obtain a clean status.
- Check in reproducible source, tests, manifests, instructions and technical decisions. Exclude credentials, provider/account receipts, databases, local task state, dependencies, caches and bulky generated output. Review existing ignore rules before adding files.
- Run the relevant available checks. A checkpoint preserves work; it does not establish scientific results, deployment readiness or task completion. Report existing failures honestly.
- End with the commit/branch, checks and publication status, plus any intentional local-only files. Paperclip retains operational authority; Git retains source history. Git publication does not authorize experiments, spending, messages or deployment.
<!-- git-hygiene-policy:end -->
