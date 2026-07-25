# Contributing to Paper for LLMs

English | [简体中文](CONTRIBUTING.zh-CN.md)

Thank you for helping improve Paper for LLMs. Contributions may include parser fixes, support for additional publisher page variants, tests, documentation, translations, accessibility improvements, or interface refinements.

## Before you start

- Search existing issues before opening a new one.
- Keep each issue or pull request focused on one problem.
- Use a representative public URL when possible, but do not post account details, cookies, access tokens, institutional credentials, or other private data.
- Do not attach a full copyrighted article or a complete saved publisher page. Reduce test material to the smallest DOM fragment needed to reproduce the behavior.
- Do not propose code that bypasses paywalls, sign-in requirements, rate limits, or human-verification systems.
- Be respectful and assume good faith when discussing bugs and design decisions.

## Development setup

The extension has no third-party runtime dependencies or build step. You need a current Node.js/npm installation and Chrome or another Chromium browser that supports Manifest V3.

Run the static checks and unit tests:

```bash
npm run check
npm test
```

Run the browser DOM integration suite:

```bash
npm run test:browser
```

Then open `http://127.0.0.1:4173/tests/browser-test.html` and confirm that all assertions pass.

To test the actual extension, open `chrome://extensions/`, enable Developer mode, and load the repository root as an unpacked extension.

## Reporting a parser bug

Please include:

- Publisher and representative article URL.
- Browser and extension version.
- Expected Markdown and the smallest relevant portion of the actual Markdown.
- Whether the problem affects metadata, authors, body text, citations, references, formulas, tables, figures, or footnotes.
- Citation integrity counts shown by the extension, when relevant.
- A screenshot or minimized DOM excerpt if it can be shared lawfully and contains no private information.

Avoid posting the entire converted paper. A short excerpt around the failure is normally enough.

## Updating or adding a parser

- Prefer publisher-provided semantic identifiers and relationships over visible-text guessing.
- Keep publisher-specific rules in the corresponding extractor and reusable Markdown behavior in `src/core.js`.
- Preserve citation and reference identifiers deterministically; do not silently invent a match when the target is ambiguous.
- Treat page markup as variable. Add narrowly scoped fallbacks and avoid selectors that capture navigation, recommendations, metrics, or unrelated widgets.
- Normalize whitespace only where it is safe. Preserve meaningful paragraph, list, table, formula, and caption boundaries.
- Keep all processing local and do not add analytics, trackers, external services, or remote executable code.
- Add a regression test for every parser bug that can be represented with a minimized fixture.

## Test-fixture policy

Fixtures must be synthetic, public-domain, licensed for reuse, or minimized to the structural fragment required by the test. Remove names and prose that are irrelevant to the parser behavior. Never commit credentials, cookies, downloaded paywalled pages, full article text, or publisher assets without clear redistribution permission.

## Pull request checklist

- [ ] The change is focused and explained clearly.
- [ ] English and Simplified Chinese user-facing text are updated together.
- [ ] New publisher behavior includes an appropriate regression test.
- [ ] `npm run check` and `npm test` pass.
- [ ] Browser DOM tests pass when the change affects extraction or rendering.
- [ ] Permissions and privacy disclosures are updated if data access changes.
- [ ] No private, copyrighted, generated build, or local backup files were added unintentionally.

By contributing, you agree that your contribution may be distributed under the repository's [MIT License](LICENSE).
