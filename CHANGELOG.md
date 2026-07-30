# Changelog

English | [简体中文](CHANGELOG.zh-CN.md)

All notable changes to Paper for LLMs will be documented here.

## Unreleased

- No changes yet.

## 1.3.0 — 2026-07-30

- Add full-text arXiv HTML support for both modern and legacy arXiv identifier URLs.
- Preserve LaTeXML citation-to-reference links, author and affiliation metadata, arXiv version/category metadata, formulas, figures, tables, captions, and hidden footnote content.
- Prevent DOI values found inside arXiv references from being misidentified as the paper DOI, and remove duplicated title/author blocks and bibliography back-reference controls.
- Validate the extractor against three open-access arXiv HTML papers from computer science, quantum physics, and biophysics, and expand browser regression coverage to 108 assertions.

## 1.2.0 — 2026-07-29

- Add MIT Press Direct support, including Quantitative Science Studies, Open Mind, Network Neuroscience, and other journals using the same article platform.
- Preserve MIT Press citation-to-reference links through `data-modal-source-id` and `data-content-id` identifiers.
- Preserve MIT Press figures, captions, tables, and MathML formulas while removing duplicate viewer controls and reference lookup links.
- Validate the extractor against three open-access articles from three MIT Press journals and expand browser regression coverage to 98 assertions.

## 1.1.0 — 2026-07-29

- Add citation-linked Markdown extraction for MDPI, Taylor & Francis, Frontiers, Oxford Academic, IEEE Xplore, Wolters Kluwer/Ovid, and SAGE Journals.
- Validate each new publisher against at least three open-access articles from different journals.
- Load IEEE references on demand and recover complete Wolters Kluwer author lists from publisher-provided structured data.
- Expand browser regression coverage to 90 assertions across all supported platforms.

## 1.0.0 — 2026-07-25

- Publish the first stable version of the extension.
- Convert supported ScienceDirect, Wiley Online Library, Nature, SpringerLink, and Science / AAAS articles to citation-linked Markdown.
- Preserve structured metadata, body content, formulas, tables, figures, footnotes, references, and publisher-provided citation relationships.
- Add citation-integrity reporting, Markdown copy and download actions, and optional YAML metadata and image links.
- Provide automatic English/Simplified Chinese interface selection with a persistent manual override.
- Publish complete bilingual project, privacy, contribution, security, store-listing, and release documentation.
- Add localized Chrome Web Store promotional tiles and screenshots.
- Release the source code under the MIT License.

## 0.5.0 — Pre-release

- Convert supported ScienceDirect, Wiley Online Library, Nature, SpringerLink, and Science / AAAS articles to Markdown.
- Preserve structured metadata, body content, formulas, tables, figures, footnotes, references, and publisher-provided citation relationships.
- Add citation-integrity reporting, Markdown copy and download actions, and optional YAML metadata and image links.
- Add automatic English/Simplified Chinese interface selection with a persistent manual override.
- Improve publisher-specific handling for author lists, citation targets, inline formulas, captions, and whitespace normalization.
