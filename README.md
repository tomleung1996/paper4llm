# Paper for LLMs (Paper4LLM)

English | [简体中文](README.zh-CN.md)

Paper for LLMs is a Chrome Manifest V3 extension that converts a scholarly article already open in the browser into structured, citation-linked Markdown. Conversion runs locally in the current tab.

The extension currently supports:

- Elsevier ScienceDirect
- Wiley Online Library
- Nature
- SpringerLink
- Science / AAAS
- MDPI
- Taylor & Francis Online
- Frontiers
- Oxford Academic
- MIT Press Direct
- arXiv HTML
- IEEE Xplore
- Wolters Kluwer / Ovid
- SAGE Journals, including the SAGE China platform

## Features

- Extracts title, authors, affiliations, journal metadata, publication date, DOI, PII or arXiv ID, abstract, highlights, and keywords.
- Preserves headings, paragraphs, lists, tables, formulas, figures, captions, and footnotes.
- Links in-text citations to the corresponding reference entries whenever the publisher exposes a reliable DOM target.
- Keeps reference order, displayed labels, text, DOI links, and external links.
- Reports resolved and unresolved citation targets instead of silently guessing.
- Copies the result to the clipboard or downloads it as a local `.md` file.
- Follows the Chrome interface language automatically and provides a persistent Chinese/English override.
- Does not upload article content or use analytics, tracking, or remote code.

## Supported article URLs

```text
https://www.sciencedirect.com/science/article/pii/...
https://onlinelibrary.wiley.com/doi/10....
https://*.onlinelibrary.wiley.com/doi/10....
https://www.nature.com/articles/...
https://link.springer.com/article/10....
https://www.science.org/doi/10.1126/...
https://www.science.org/doi/full/10.1126/...
https://www.science.org/doi/abs/10.1126/...
https://www.mdpi.com/ISSN/volume/issue/article
https://www.tandfonline.com/doi/full/10....
https://www.frontiersin.org/journals/.../articles/10.3389/.../full
https://academic.oup.com/.../article/...
https://direct.mit.edu/.../article/...
https://arxiv.org/html/2607.27178
https://arxiv.org/html/hep-th/9901001
https://ieeexplore.ieee.org/document/...
https://www.ovid.com/jnls/.../fulltext/...
https://journals.sagepub.com/doi/10.1177/...
https://sage.cnpereading.com/doi/10.1177/...
```

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository root, which contains `manifest.json`.

## Usage

1. Open a supported scholarly article page that you are authorized to access.
2. Select the Paper for LLMs extension icon.
3. Choose whether to include YAML metadata and image links.
4. Select **Convert current paper**.
5. Review the integrity summary, then copy the Markdown or download the `.md` file.

If the extension was loaded after the article tab was already open, refreshing the article page before conversion is the safest option.

## Citation integrity

Paper for LLMs prioritizes publisher-provided identifiers rather than matching references by author or year text:

- ScienceDirect citation targets are mapped to bibliography IDs and their publisher aliases.
- Wiley citation links are mapped to the corresponding `data-bib-id` entries.
- Nature and SpringerLink fragments such as `ref-CR30` are mapped to their reference containers.
- Science / AAAS `data-xml-rid` values are mapped to bibliography entry IDs.
- arXiv LaTeXML `#bib.*` targets are mapped to the corresponding `.ltx_bibitem` entries.
- MDPI fragment IDs, Taylor & Francis `data-rid` values, Frontiers reference buttons, Oxford `reveal-id` values, MIT Press `data-modal-source-id` values, IEEE `anchor` values, Wolters Kluwer hydrated `refId` values, and SAGE `data-ref-id` values are mapped to their publisher reference entries.

The generated Markdown ends with an audit marker similar to:

```markdown
<!-- paper-md-integrity: references=42; citation_targets_resolved=81; footnotes=3; footnote_targets_resolved=3; citation_targets_unresolved=0 -->
```

If `citation_targets_unresolved` is not zero, review the affected citations manually.

## Privacy

Article content and the current article URL are processed locally to provide the conversion requested by the user. They are not transmitted to the developer, sold, shared, or retained by the extension.

See the full [Privacy Policy](PRIVACY.md) or the [简体中文隐私政策](PRIVACY.zh-CN.md).

## Development

No build step or third-party runtime dependency is required for the extension itself.

Run syntax and unit tests:

```bash
npm run check
npm test
```

Run browser DOM integration tests:

```bash
npm run test:browser
```

Then open `http://127.0.0.1:4173/tests/browser-test.html`.

Create the Chrome Web Store ZIP:

```bash
npm run package:extension
```

Run the complete release check:

```bash
npm run release:check
```

## Project structure

```text
manifest.json            Extension manifest
popup.html/css/js        Popup interface
_locales/                Chrome manifest localization
src/core.js              Shared DOM-to-Markdown renderer
src/sciencedirect.js     ScienceDirect extractor
src/wiley.js             Wiley extractor
src/springernature.js    Nature and SpringerLink extractor
src/science.js           Science / AAAS extractor
src/publisher-platforms.js  MDPI, Taylor & Francis, Frontiers, Oxford, MIT Press, arXiv, IEEE, Wolters Kluwer, and SAGE extractors
tests/                   Unit and browser DOM fixtures
store/                   Chrome Web Store copy and release checklist
CONTRIBUTING*.md          Contribution guides
SECURITY*.md              Security reporting policies
CHANGELOG*.md             Release history
```

## Known limitations

- The extension does not bypass accounts, institutional access, paywalls, or publisher verification pages.
- Publisher markup changes over time, so new page variants may require selector updates.
- Remote image URLs may fail outside the browser when a publisher requires session cookies or human verification.
- Some SpringerLink tables are hosted on separate detail pages; the extension preserves those links instead of fetching them.
- arXiv support requires an HTML version generated by arXiv; papers available only as PDF are not converted.
- Image-only formulas, interactive figures, and supplementary files are not downloaded.
- The first release keeps remote image URLs rather than packaging image files with the Markdown.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Security issues should follow [SECURITY.md](SECURITY.md) rather than being posted with sensitive details in a public issue.

Release history is recorded in [CHANGELOG.md](CHANGELOG.md). The Chrome Web Store materials are maintained in [store/](store/).

## Disclaimer

Paper for LLMs is an independent project and is not affiliated with or endorsed by any supported publisher. Publisher and journal names are used only to describe compatibility. Users are responsible for complying with the access terms and licenses that apply to the content they convert.

## License

Paper for LLMs is released under the [MIT License](LICENSE).
