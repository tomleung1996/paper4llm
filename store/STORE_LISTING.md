# Chrome Web Store Listing — English

English | [简体中文](STORE_LISTING.zh-CN.md)

This file is a copy-and-paste draft for the Chrome Web Store Developer Dashboard.

## Product details

- **Name:** Paper for LLMs: Markdown Converter
- **Short name:** Paper4LLM
- **Summary:** Convert research articles to clean Markdown with linked citations, references, figures, tables, and formulas.
- **Primary category:** Productivity
- **Language:** English
- **Pricing:** Free
- **Homepage URL:** `https://github.com/tomleung1996/paper4llm`
- **Support URL:** `https://github.com/tomleung1996/paper4llm/issues`
- **Privacy policy URL:** `https://github.com/tomleung1996/paper4llm/blob/main/PRIVACY.md`

## Detailed description

Paper for LLMs turns a scholarly article page you can already access into structured Markdown for reading, archiving, and language-model workflows.

Key features:

- Preserve title, authors, affiliations, journal metadata, abstract, keywords, headings, lists, tables, formulas, figures, captions, and footnotes.
- Link in-text citations to matching reference entries and preserve reference order, text, DOI, and external links.
- Report unresolved citation targets instead of silently guessing.
- Support ScienceDirect, Wiley Online Library, Nature, SpringerLink, Science / AAAS, MDPI, Taylor & Francis, Frontiers, Oxford Academic, MIT Press Direct, arXiv HTML, IEEE Xplore, Wolters Kluwer/Ovid, and SAGE article pages.
- Follow the Chrome interface language automatically, with a persistent Chinese/English override.
- Copy the generated Markdown or download it as a local `.md` file.

Conversion is local and user initiated. Paper for LLMs does not bypass sign-in, institutional access, paywalls, or publisher verification, and it does not upload article content.

Paper for LLMs is an independent project and is not affiliated with or endorsed by the supported publishers. Publisher names are used only to describe compatibility.

## Single purpose

Convert the currently opened supported scholarly article page into structured Markdown while preserving citation-to-reference links.

## Permission justifications

- **activeTab:** Access the current article tab after the user invokes the extension, detect whether the page is supported, and initiate conversion.
- **scripting:** Inject the converter code packaged with the extension when the supported page was opened before the extension was loaded or the content script is otherwise unavailable.
- **Supported-site host access:** Read the DOM only on the supported scholarly article URL patterns listed above to extract the article content requested by the user.

Before submission, verify that this section exactly matches the permissions in the uploaded `manifest.json`.

## Privacy declarations

- **Remote code:** No. All executable code is included in the uploaded extension package.
- **Website content:** Processed locally to generate the user-requested Markdown. It is not transmitted, sold, shared, or retained by the extension.
- **Web history / current URL:** The current article URL is processed locally to identify the publisher and preserve the source URL. The extension does not collect browsing history across tabs or sessions.
- **User settings:** A manually selected interface-language preference is stored locally and is not transmitted.
- **Limited Use:** The extension's use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Reviewer test instructions

No Paper for LLMs account or test credentials are required.

1. Install the submitted extension package.
2. Open a representative article, preferably one of the following:
   - `https://www.nature.com/articles/s41597-025-06434-2`
   - `https://link.springer.com/article/10.1007/s11192-024-05163-4`
   - `https://www.sciencedirect.com/science/article/pii/S0048733320301475`
   - `https://asistdl.onlinelibrary.wiley.com/doi/10.1002/asi.70104`
   - `https://www.science.org/doi/10.1126/sciadv.ads7738`
   - `https://direct.mit.edu/qss/article/doi/10.1162/qss_a_00346/126307/Teaching-counts-Open-Educational-Resources-as-an`
   - `https://arxiv.org/html/2607.27178`
3. Complete any publisher-provided cookie or human-verification page if it appears. The extension does not bypass it.
4. Select the Paper for LLMs icon and choose **Convert current paper**.
5. Confirm that the output contains Markdown headings and a References section.
6. Confirm that the integrity summary reports the number of references and linked or unlinked citations.
7. Change **Language** from **Auto** to 中文 and then to English; confirm that the interface updates immediately.
8. Copy the Markdown or download the `.md` file.

If an article is paywalled, the extension converts only the content currently available in the reviewer's browser session.
