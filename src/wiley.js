(function initWileyExtractor(root) {
  "use strict";

  const PaperMd = root.PaperMd || (root.PaperMd = {});
  const core = PaperMd.core;
  if (!core) throw new Error("PaperMd core must be loaded before the Wiley extractor.");
  const i18n = root.PaperMdI18n;
  if (!i18n) throw new Error("PaperMd i18n must be loaded before the Wiley extractor.");

  const TITLE_SELECTORS = [
    "h1.citation__title",
    "article h1",
    "main h1",
    "h1",
  ];

  const ABSTRACT_SELECTORS = [
    "section.article-section__abstract",
    ".abstract-group section",
    ".abstract-group",
    'section[id*="abstract" i]',
    '[class*="abstract" i]',
  ];

  const BODY_SELECTORS = [
    "section.article-section__full",
    ".article-section__full",
    '[data-testid="article-body"]',
    "article",
    "main",
  ];

  const REFERENCE_CONTAINER_SELECTORS = [
    "section.article-section__references",
    "#article-references-section-1",
    'section[id*="references" i]',
    '[class*="references" i]',
  ];

  function pageUrl(document) {
    const locationUrl = document.location && document.location.href ? document.location.href : "";
    if (locationUrl && locationUrl !== "about:blank") return locationUrl;
    const canonical = document.querySelector('link[rel="canonical"]');
    return (
      core.firstMeta(document, ["citation_fulltext_html_url", "citation_public_url", "og:url"]) ||
      (canonical && canonical.getAttribute("href")) ||
      locationUrl
    );
  }

  function textFromFirst(documentOrElement, selectors) {
    const element = core.queryFirst(documentOrElement, selectors, (candidate) =>
      Boolean(core.normalizeInlineWhitespace(candidate.textContent)),
    );
    return element ? core.normalizeInlineWhitespace(element.textContent) : "";
  }

  function extractKeywords(document) {
    const fromMeta = core.metaContents(document, ["citation_keywords", "keywords", "dc.subject"])
      .flatMap((value) => value.split(/[;,]/))
      .map(core.normalizeInlineWhitespace);
    const fromDom = Array.from(
      document.querySelectorAll(
        '.keywords .keyword, .article-info__keywords a, [class*="keyword-list" i] li',
      ),
    ).map((element) => core.normalizeInlineWhitespace(element.textContent));
    return core.unique([...fromMeta, ...fromDom]);
  }

  function extractMetadata(document) {
    const url = pageUrl(document);
    const title =
      core.firstMeta(document, ["citation_title"]) ||
      core.firstMeta(document, ["dc.title"]) ||
      core.firstMeta(document, ["og:title"]) ||
      textFromFirst(document, TITLE_SELECTORS) ||
      core.normalizeInlineWhitespace(document.title).replace(/\s+-\s+Wiley Online Library\s*$/i, "");
    const authors = core.unique([
      ...core.metaContents(document, ["citation_author", "dc.creator", "author"]),
      ...Array.from(
        document.querySelectorAll(
          '.loa-authors .author-name.accordion-tabbed__control, [data-testid="author-list"] [data-testid="author-name"]',
        ),
      ).map((element) => core.normalizeInlineWhitespace(element.textContent)),
    ]);
    const affiliations = core.unique([
      ...core.metaContents(document, ["citation_author_institution", "dc.contributor"]),
      ...Array.from(
        document.querySelectorAll('.author-info [class*="affiliation" i], .affiliation'),
      ).map((element) => core.normalizeInlineWhitespace(element.textContent)),
    ]);
    const journal = core.firstMeta(document, [
      "citation_journal_title",
      "prism.publicationname",
      "dc.source",
    ]);
    const publicationDate =
      core.firstMeta(document, [
        "citation_online_date",
        "citation_publication_date",
        "prism.publicationdate",
        "dc.date",
        "article:published_time",
      ]) || textFromFirst(document, [".epub-date"]);
    const doi = core.normalizeDoi(
      core.firstMeta(document, ["citation_doi", "prism.doi", "dc.identifier"]) || url,
    );
    const publisher = core.firstMeta(document, ["citation_publisher", "dc.publisher"]);

    return {
      title,
      authors,
      affiliations,
      journal,
      publicationDate,
      year: (publicationDate.match(/(?:19|20)\d{2}/) || [""])[0],
      doi,
      url,
      publisher,
      language:
        core.firstMeta(document, ["citation_language", "dc.language"]) ||
        document.documentElement.getAttribute("lang") ||
        "",
      keywords: extractKeywords(document),
    };
  }

  function findAbstractNode(document) {
    return core.queryFirst(document, ABSTRACT_SELECTORS, (element) => {
      const text = core.normalizeInlineWhitespace(element.textContent).replace(/^abstract\s*/i, "");
      return text.length > 40;
    });
  }

  function findBodyRoot(document) {
    return core.queryFirst(document, BODY_SELECTORS, (element) => {
      const text = core.normalizeInlineWhitespace(element.textContent);
      return text.length > 100;
    });
  }

  function findReferenceContainer(document) {
    const exact = document.querySelector(
      "section.article-section__references, #article-references-section-1",
    );
    if (exact) return exact;
    return core.queryFirst(document, REFERENCE_CONTAINER_SELECTORS, (element) =>
      Boolean(element.querySelector('li[data-bib-id], [id*="-bib-" i]')) ||
      core.normalizeInlineWhitespace(element.textContent).length > 20,
    );
  }

  function findReferenceEntries(container) {
    if (!container) return [];
    const direct = Array.from(container.querySelectorAll("li[data-bib-id]"));
    if (direct.length) return direct;
    return Array.from(container.querySelectorAll("ul.rlist > li, ol.rlist > li")).filter(
      (entry) => core.normalizeInlineWhitespace(entry.textContent).length > 15,
    );
  }

  function prepareWileyArticle(document, timeoutMs) {
    const initialContainer = findReferenceContainer(document);
    if (initialContainer && findReferenceEntries(initialContainer).length) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let timeout = null;
      const clickedControls = new WeakSet();
      const finish = () => {
        if (settled) return;
        settled = true;
        if (observer) observer.disconnect();
        if (timeout) clearTimeout(timeout);
        resolve();
      };
      const checkReferences = () => {
        if (settled) return;
        const container = findReferenceContainer(document);
        if (!container) return;
        if (findReferenceEntries(container).length) {
          finish();
          return;
        }

        const control = container.querySelector(".accordion__control");
        if (
          control &&
          control.getAttribute("aria-expanded") !== "true" &&
          !clickedControls.has(control)
        ) {
          clickedControls.add(control);
          control.click();
        }
        if (findReferenceEntries(container).length) finish();
      };
      observer = new MutationObserver(checkReferences);
      timeout = setTimeout(finish, timeoutMs || 5000);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      checkReferences();
    });
  }

  function referenceAliases(entry, index) {
    const aliases = new Set();
    const add = (value) => {
      const normalized = core.normalizeTargetId(value);
      if (!normalized) return;
      aliases.add(normalized);
      if (/-bibl-/i.test(normalized)) aliases.add(normalized.replace(/-bibl-/i, "-bib-"));
      if (/-bib-/i.test(normalized)) aliases.add(normalized.replace(/-bib-/i, "-bibl-"));
    };
    add(entry.id);
    add(entry.getAttribute("data-bib-id"));
    add(entry.getAttribute("data-reference-id"));
    add(entry.getAttribute("data-ref-id"));
    if (!aliases.size) add(`reference-${index + 1}`);
    return Array.from(aliases);
  }

  function isReferenceUiElement(element) {
    const className = typeof element.className === "string" ? element.className : "";
    return /(?:^|\s)(?:extra-links|getFTR|google-scholar|visitable)(?:\s|$)/i.test(className);
  }

  function renderReferenceNode(node, baseUrl) {
    if (!node) return "";
    if (node.nodeType === 3) return core.escapeMarkdown(node.nodeValue || "");
    if (node.nodeType !== 1) return "";

    const element = node;
    const tag = element.tagName;
    if (["SCRIPT", "STYLE", "BUTTON", "SVG"].includes(tag)) return "";
    if (isReferenceUiElement(element)) return "";
    if (element.getAttribute("aria-hidden") === "true") return "";

    const children = () =>
      Array.from(element.childNodes)
        .map((child) => renderReferenceNode(child, baseUrl))
        .join("");

    if (tag === "A") {
      const text = core.normalizeInlineWhitespace(children() || element.textContent);
      const rawHref = element.getAttribute("href") || "";
      if (/\/(?:action|getFTRLinkout|servlet\/linkout)/i.test(rawHref)) return "";
      const href = core.absoluteUrl(rawHref, baseUrl);
      if (!href || href.includes("#")) return text;
      return text ? `[${text}](${href})` : `<${href}>`;
    }
    if (tag === "BR") return " ";
    if (tag === "EM" || tag === "I") return `*${children().trim()}*`;
    if (tag === "STRONG" || tag === "B") return `**${children().trim()}**`;
    if (tag === "SUP") return `<sup>${children().trim()}</sup>`;
    if (tag === "SUB") return `<sub>${children().trim()}</sub>`;
    const rendered = children();
    return ["DIV", "P", "LI"].includes(tag) ? `${rendered.trim()} ` : rendered;
  }

  function cleanReferenceText(entry, baseUrl) {
    let markdown = core.normalizeInlineWhitespace(renderReferenceNode(entry, baseUrl));
    const doi = core.normalizeDoi(textFromFirst(entry, [".data-doi"]));
    if (doi && !markdown.toLowerCase().includes(doi.toLowerCase())) {
      markdown = `${markdown}${/[.!?]$/.test(markdown) ? "" : "."} DOI: [${doi}](https://doi.org/${doi})`;
    }
    return core.linkifyBareDoi(markdown);
  }

  function buildReferenceIndex(entries, baseUrl) {
    const aliasMap = new Map();
    const references = entries.map((entry, index) => {
      const reference = {
        kind: "reference",
        index: index + 1,
        label: String(index + 1),
        anchor: `ref-${index + 1}`,
        aliases: referenceAliases(entry, index),
        markdown: cleanReferenceText(entry, baseUrl),
      };
      reference.aliases.forEach((alias) => {
        if (!aliasMap.has(alias)) aliasMap.set(alias, reference);
      });
      return reference;
    });
    return { references, aliasMap, duplicateLabels: [] };
  }

  function buildFootnoteIndex(document) {
    const aliasMap = new Map();
    const entries = Array.from(
      document.querySelectorAll(
        '.footNotePopup__item[id], li[title^="Footnote" i][id*="-note-" i]',
      ),
    );
    const seenIds = new Set();
    const footnotes = entries
      .filter((entry) => {
        const id = core.normalizeTargetId(entry.id);
        if (!id || seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
      .map((entry, index) => {
        const id = core.normalizeTargetId(entry.id);
        const numberNode = entry.querySelector(".number");
        const label =
          core.normalizeInlineWhitespace(numberNode && numberNode.textContent) || String(index + 1);
        const aliases = core.unique([id, id.replace(/_\d+$/, "")]);
        const footnote = {
          kind: "footnote",
          index: index + 1,
          label,
          anchor: `footnote-${index + 1}`,
          aliases,
          entry,
          numberNode,
        };
        aliases.forEach((alias) => {
          const normalized = core.normalizeTargetId(alias);
          if (normalized && !aliasMap.has(normalized)) aliasMap.set(normalized, footnote);
        });
        return footnote;
      });
    const heading = footnotes.length ? footnotes[0].entry.previousElementSibling : null;
    return {
      footnotes,
      aliasMap,
      heading: heading && /^H[1-6]$/.test(heading.tagName) ? heading : null,
    };
  }

  function citationTargetTokens(element) {
    const values = [];
    const href = element.getAttribute("href") || "";
    if (href.includes("#")) values.push(href.slice(href.lastIndexOf("#") + 1));
    [
      "data-bib-id",
      "data-reference-id",
      "data-ref-id",
      "data-noteid",
      "aria-describedby",
    ].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value) values.push(...value.split(/[\s,;]+/));
    });
    return core.unique(values.map(core.normalizeTargetId));
  }

  function createCitationResolver(referenceIndex, footnoteIndex) {
    return function resolveCitation(element) {
      const tokens = citationTargetTokens(element);
      const targets = [];
      tokens.forEach((token) => {
        const footnoteToken = token.replace(/(_\d+)$/, "");
        const target =
          referenceIndex.aliasMap.get(token) ||
          footnoteIndex.aliasMap.get(token) ||
          footnoteIndex.aliasMap.get(footnoteToken);
        if (target && !targets.includes(target)) targets.push(target);
      });

      const className = typeof element.className === "string" ? element.className : "";
      const isCitation =
        targets.length > 0 ||
        /(?:^|\s)(?:bibLink|noteLink)(?:\s|$)/i.test(className) ||
        tokens.some((token) => /-(?:bib|note)-\d+/i.test(token));
      return { isCitation, targets, rawTarget: tokens.join(", ") };
    };
  }

  function renderSectionContent(node, context, headingPattern) {
    if (!node) return "";
    const headings = new Set(
      Array.from(node.querySelectorAll("h1, h2, h3, .article-section__header, .section__title")),
    );
    const markdown = core.renderBlocks(node, { ...context, skipNodes: headings }).trim();
    return headingPattern ? markdown.replace(headingPattern, "").trim() : markdown;
  }

  function buildFrontMatter(metadata, referenceCount) {
    const lines = ["---", `title: ${core.yamlString(metadata.title)}`];
    if (metadata.authors.length) {
      lines.push("authors:", ...metadata.authors.map((author) => `  - ${core.yamlString(author)}`));
    }
    if (metadata.affiliations.length) {
      lines.push(
        "affiliations:",
        ...metadata.affiliations.map((affiliation) => `  - ${core.yamlString(affiliation)}`),
      );
    }
    if (metadata.journal) lines.push(`journal: ${core.yamlString(metadata.journal)}`);
    if (metadata.publicationDate) {
      lines.push(`publication_date: ${core.yamlString(metadata.publicationDate)}`);
    }
    if (metadata.year) lines.push(`year: ${core.yamlString(metadata.year)}`);
    if (metadata.doi) lines.push(`doi: ${core.yamlString(metadata.doi)}`);
    if (metadata.url) lines.push(`source_url: ${core.yamlString(metadata.url)}`);
    lines.push(
      `publisher: ${core.yamlString(metadata.publisher || "John Wiley & Sons")}`,
      'source_platform: "Wiley Online Library"',
    );
    if (metadata.language) lines.push(`language: ${core.yamlString(metadata.language)}`);
    lines.push(
      `reference_count: ${referenceCount}`,
      `extracted_at: ${core.yamlString(new Date().toISOString())}`,
      "---",
    );
    return lines.join("\n");
  }

  function renderReferences(references) {
    return references
      .map((reference) =>
        `${reference.index}. <a id="${reference.anchor}"></a>${reference.markdown || "Reference text unavailable"}`,
      )
      .join("\n\n");
  }

  function renderFootnotes(footnotes, context) {
    return footnotes
      .map((footnote) => {
        const skipNodes = new Set(context.skipNodes || []);
        if (footnote.numberNode) skipNodes.add(footnote.numberNode);
        const detail = core.normalizeInlineWhitespace(
          core.renderInlineChildren(footnote.entry, { ...context, skipNodes }),
        );
        return `${footnote.index}. <a id="${footnote.anchor}"></a>${detail}`;
      })
      .join("\n\n");
  }

  function extractWileyArticle(document, options) {
    const settings = {
      includeImages: true,
      includeFrontMatter: true,
      locale: i18n.detectLocale(),
      ...(options || {}),
    };
    const metadata = extractMetadata(document);
    const abstractNode = findAbstractNode(document);
    const bodyRoot = findBodyRoot(document);
    const referenceContainer = findReferenceContainer(document);
    const referenceEntries = findReferenceEntries(referenceContainer);
    const referenceIndex = buildReferenceIndex(referenceEntries, metadata.url);
    const footnoteIndex = buildFootnoteIndex(document);
    const diagnostics = {
      references: referenceIndex.references.length,
      footnotes: footnoteIndex.footnotes.length,
      resolvedCitationLinks: 0,
      resolvedFootnoteLinks: 0,
      unresolvedCitations: [],
      duplicateReferenceLabels: referenceIndex.duplicateLabels,
      warnings: [],
      warningDetails: [],
    };

    const skipNodes = new Set([
      abstractNode,
      referenceContainer,
      footnoteIndex.heading,
      ...footnoteIndex.footnotes.map((footnote) => footnote.entry),
    ].filter(Boolean));
    if (bodyRoot) {
      Array.from(
        bodyRoot.querySelectorAll(
          ".figure-extra, .table-extra, .article-table-actions, .open-figure-link, .ppt-figure-link",
        ),
      ).forEach((node) => skipNodes.add(node));
    }

    const context = {
      baseUrl: metadata.url,
      includeImages: settings.includeImages,
      resolveCitation: createCitationResolver(referenceIndex, footnoteIndex),
      diagnostics,
      skipNodes,
    };

    const abstractMarkdown = renderSectionContent(abstractNode, context, /^abstract\s*:?\s*/i);
    const bodyMarkdown = bodyRoot ? core.renderBlocks(bodyRoot, context) : "";
    const footnoteMarkdown = renderFootnotes(footnoteIndex.footnotes, context);
    const referenceMarkdown = renderReferences(referenceIndex.references);

    if (!metadata.title) i18n.addWarning(diagnostics, settings.locale, "missingTitle");
    if (!bodyRoot || bodyMarkdown.length < 300) {
      i18n.addWarning(diagnostics, settings.locale, "bodyTooShort");
    }
    if (!referenceIndex.references.length) {
      i18n.addWarning(
        diagnostics,
        settings.locale,
        referenceContainer ? "wileyReferencesDelayed" : "missingReferences",
      );
    }
    if (diagnostics.unresolvedCitations.length) {
      i18n.addWarning(diagnostics, settings.locale, "unresolvedCitationCount", {
        count: diagnostics.unresolvedCitations.length,
      });
    }

    const chunks = [];
    if (settings.includeFrontMatter) {
      chunks.push(buildFrontMatter(metadata, referenceIndex.references.length));
    }
    chunks.push(`# ${core.escapeMarkdown(metadata.title || "Untitled paper")}`);
    if (metadata.authors.length) {
      chunks.push(`**Authors:** ${metadata.authors.map(core.escapeMarkdown).join(", ")}`);
    }
    const publication = [metadata.journal, metadata.publicationDate]
      .filter(Boolean)
      .map(core.escapeMarkdown)
      .join(", ");
    if (publication) chunks.push(`**Published in:** ${publication}`);
    if (metadata.doi) chunks.push(`**DOI:** [${metadata.doi}](https://doi.org/${metadata.doi})`);
    if (metadata.keywords.length) {
      chunks.push(`**Keywords:** ${metadata.keywords.map(core.escapeMarkdown).join("; ")}`);
    }
    if (abstractMarkdown) chunks.push(`## Abstract\n\n${abstractMarkdown}`);
    if (bodyMarkdown) chunks.push(bodyMarkdown);
    if (footnoteMarkdown) chunks.push(`## Footnotes\n\n${footnoteMarkdown}`);
    if (referenceMarkdown) chunks.push(`## References\n\n${referenceMarkdown}`);
    chunks.push(
      `<!-- paper-md-integrity: references=${diagnostics.references}; citation_targets_resolved=${diagnostics.resolvedCitationLinks}; footnotes=${diagnostics.footnotes}; footnote_targets_resolved=${diagnostics.resolvedFootnoteLinks}; citation_targets_unresolved=${diagnostics.unresolvedCitations.length} -->`,
    );

    const markdown = chunks
      .filter(Boolean)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .concat("\n");

    return {
      markdown,
      metadata,
      diagnostics,
      filename: `${core.sanitizeFileName(metadata.title)}.md`,
    };
  }

  PaperMd.wiley = {
    extract: extractWileyArticle,
    extractMetadata,
    findReferenceContainer,
    prepare: prepareWileyArticle,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PaperMd.wiley;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
