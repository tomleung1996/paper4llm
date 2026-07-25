(function initSpringerNatureExtractor(root) {
  "use strict";

  const PaperMd = root.PaperMd || (root.PaperMd = {});
  const core = PaperMd.core;
  if (!core) throw new Error("PaperMd core must be loaded before the Springer Nature extractor.");
  const i18n = root.PaperMdI18n;
  if (!i18n) throw new Error("PaperMd i18n must be loaded before the Springer Nature extractor.");

  const TITLE_SELECTORS = [
    '[data-test="article-title"]',
    "h1.c-article-title",
    "article#main h1",
    "main article h1",
    "h1",
  ];

  const ABSTRACT_SELECTORS = [
    '.c-article-body section[data-title="Abstract"]',
    'section[aria-labelledby="Abs1"]',
    "#Abs1-section",
  ];

  const BODY_SELECTORS = [
    'article#main [data-article-body="true"]',
    "article#main .c-article-body",
    "main article .c-article-body",
    ".c-article-body",
  ];

  const REFERENCE_SELECTORS = [
    '.c-article-body section[data-title="References"]',
    'section[aria-labelledby="Bib1"]',
    "#Bib1-section",
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

  function platformInfo(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname === "www.nature.com" || hostname === "nature.com") {
        return { platform: "Nature", defaultPublisher: "Springer Nature" };
      }
    } catch (_error) {
      // Use the Springer Nature Link defaults for fixture or malformed URLs.
    }
    return { platform: "Springer Nature Link", defaultPublisher: "Springer Nature" };
  }

  function extractKeywords(document) {
    const fromMeta = core.metaContents(document, ["citation_keywords", "keywords", "dc.subject"])
      .flatMap((value) => value.split(/[;,]/))
      .map(core.normalizeInlineWhitespace);
    const fromDom = Array.from(
      document.querySelectorAll(
        '[data-test="article-keywords"] a, .c-article-subject-list a, [class*="keyword" i] li',
      ),
    ).map((element) => core.normalizeInlineWhitespace(element.textContent));
    return core.unique([...fromMeta, ...fromDom]);
  }

  function extractMetadata(document) {
    const url = pageUrl(document);
    const platform = platformInfo(url);
    const title =
      core.firstMeta(document, ["citation_title", "dc.title", "og:title"]) ||
      textFromFirst(document, TITLE_SELECTORS) ||
      core.normalizeInlineWhitespace(document.title)
        .replace(/\s*\|\s*Springer Nature Link\s*$/i, "")
        .replace(/\s*-\s*Nature\s*$/i, "");
    const visibleAuthors = Array.from(
      document.querySelectorAll('[data-test="authors-list"] [data-test="author-name"]'),
    ).map((element) => core.normalizeInlineWhitespace(element.textContent));
    const authors = core.unique(
      visibleAuthors.length
        ? visibleAuthors
        : core.metaContents(document, ["citation_author", "dc.creator"]),
    );
    const affiliations = core.unique([
      ...core.metaContents(document, ["citation_author_institution"]),
      ...Array.from(
        document.querySelectorAll(
          '[data-test="author-affiliation"], .c-article-author-affiliation__address',
        ),
      ).map((element) => core.normalizeInlineWhitespace(element.textContent)),
    ]);
    const journal = core.firstMeta(document, [
      "citation_journal_title",
      "prism.publicationname",
      "dc.source",
    ]);
    const publicationDate = core.firstMeta(document, [
      "citation_online_date",
      "citation_publication_date",
      "citation_cover_date",
      "dc.date",
      "article:published_time",
    ]);
    const doi = core.normalizeDoi(
      core.firstMeta(document, ["citation_doi", "prism.doi", "dc.identifier"]) || url,
    );

    return {
      title,
      authors,
      affiliations,
      journal,
      publicationDate,
      year: (publicationDate.match(/(?:19|20)\d{2}/) || [""])[0],
      doi,
      url,
      publisher:
        core.firstMeta(document, ["citation_publisher", "dc.publisher"]) ||
        platform.defaultPublisher,
      sourcePlatform: platform.platform,
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
    return core.queryFirst(document, BODY_SELECTORS, (element) =>
      core.normalizeInlineWhitespace(element.textContent).length > 100,
    );
  }

  function findReferenceContainer(document) {
    return core.queryFirst(document, REFERENCE_SELECTORS, (element) =>
      Boolean(element.querySelector(".c-article-references__text[id]")) ||
      core.normalizeInlineWhitespace(element.textContent).length > 20,
    );
  }

  function findReferenceEntries(container) {
    if (!container) return [];
    return Array.from(
      container.querySelectorAll(
        "ol.c-article-references > li.c-article-references__item, ul.c-article-references > li.c-article-references__item, li.c-article-references__item",
      ),
    ).filter((entry) => Boolean(entry.querySelector(".c-article-references__text[id]")));
  }

  function referenceTextNode(entry) {
    return entry.querySelector(".c-article-references__text") || entry;
  }

  function referenceLabel(entry, index) {
    const counter = (entry.getAttribute("data-counter") || "").replace(/[^0-9A-Za-z.-]/g, "");
    if (counter) return counter.replace(/[.)]+$/g, "");
    const sourceId = referenceTextNode(entry).id || "";
    const idMatch = sourceId.match(/(?:CR|ref[-_:]?)(\d+)$/i);
    return idMatch ? String(Number(idMatch[1])) : String(index + 1);
  }

  function referenceAliases(entry, label) {
    const aliases = new Set();
    const add = (value) => {
      const normalized = core.normalizeTargetId(value);
      if (!normalized || aliases.has(normalized)) return;
      aliases.add(normalized);
      if (normalized.startsWith("ref-")) aliases.add(normalized.slice(4));
      if (/^cr\d+$/i.test(normalized)) aliases.add(`ref-${normalized}`);
      const numericSuffix = (normalized.match(/(?:cr|ref[-_:]?)(\d+)$/i) || ["", ""])[1];
      if (numericSuffix) aliases.add(String(Number(numericSuffix)));
    };

    add(entry.id);
    ["data-reference-id", "data-ref-id", "data-bib-id"].forEach((attribute) =>
      add(entry.getAttribute(attribute)),
    );
    Array.from(entry.querySelectorAll("[id], [name]")).forEach((element) => {
      add(element.id);
      add(element.getAttribute("name"));
    });
    if (/^\d+$/.test(label)) add(label);
    return Array.from(aliases);
  }

  function renderReferenceNode(node, baseUrl) {
    if (!node) return "";
    if (node.nodeType === 3) return core.escapeMarkdown(node.nodeValue || "");
    if (node.nodeType !== 1) return "";
    const element = node;
    const tag = element.tagName;
    if (["SCRIPT", "STYLE", "BUTTON", "SVG"].includes(tag)) return "";
    if (element.getAttribute("aria-hidden") === "true") return "";

    const children = () =>
      Array.from(element.childNodes)
        .map((child) => renderReferenceNode(child, baseUrl))
        .join("");
    if (tag === "A") {
      const text = core.normalizeInlineWhitespace(children() || element.textContent);
      const href = core.absoluteUrl(element.getAttribute("href"), baseUrl);
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
    const textNode = referenceTextNode(entry);
    let markdown = core.normalizeInlineWhitespace(renderReferenceNode(textNode, baseUrl));
    const doiLink = entry.querySelector(
      '.c-article-references__links a[data-doi], .c-article-references__links a[href*="doi.org"]',
    );
    const doi = core.normalizeDoi(
      (doiLink && (doiLink.getAttribute("data-doi") || doiLink.getAttribute("href"))) || "",
    );
    if (doi && !markdown.toLowerCase().includes(doi.toLowerCase())) {
      markdown = `${markdown}${/[.!?]$/.test(markdown) ? "" : "."} DOI: [${doi}](https://doi.org/${doi})`;
    }
    return core.linkifyBareDoi(markdown);
  }

  function buildReferenceIndex(entries, baseUrl) {
    const aliasMap = new Map();
    const references = entries.map((entry, index) => {
      const label = referenceLabel(entry, index);
      const reference = {
        kind: "reference",
        index: index + 1,
        label,
        anchor: `ref-${index + 1}`,
        aliases: referenceAliases(entry, label),
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
    const container = document.querySelector('.c-article-body section[data-title="Notes"]');
    const entries = container
      ? Array.from(container.querySelectorAll("li.c-article-footnote--listed__item[id]"))
      : [];
    const aliasMap = new Map();
    const footnotes = entries.map((entry, index) => {
      const label = (entry.getAttribute("data-counter") || String(index + 1)).replace(/[.)]+$/g, "");
      const aliases = core.unique([
        core.normalizeTargetId(entry.id),
        `fn${index + 1}`,
        String(index + 1),
      ]);
      const footnote = {
        kind: "footnote",
        index: index + 1,
        label,
        anchor: `footnote-${index + 1}`,
        aliases,
        content: entry.querySelector(".c-article-footnote--listed__content") || entry,
      };
      aliases.forEach((alias) => {
        if (alias && !aliasMap.has(alias)) aliasMap.set(alias, footnote);
      });
      return footnote;
    });
    return { container, footnotes, aliasMap };
  }

  function citationTargetTokens(element) {
    const values = [];
    const href = element.getAttribute("href") || "";
    if (href.includes("#")) values.push(href.slice(href.lastIndexOf("#") + 1));
    ["data-reference-id", "data-ref-id", "data-bib-id", "aria-describedby"].forEach(
      (attribute) => {
        const value = element.getAttribute(attribute);
        if (value) values.push(...value.split(/[\s,;]+/));
      },
    );
    return core.unique(values.map(core.normalizeTargetId));
  }

  function createCitationResolver(referenceIndex, footnoteIndex) {
    return function resolveCitation(element) {
      const tokens = citationTargetTokens(element);
      const targets = [];
      tokens.forEach((token) => {
        const target = referenceIndex.aliasMap.get(token) || footnoteIndex.aliasMap.get(token);
        if (target && !targets.includes(target)) targets.push(target);
      });
      const isCitation =
        targets.length > 0 ||
        element.getAttribute("data-test") === "citation-ref" ||
        tokens.some((token) => /^(?:ref-)?cr\d+$|^fn\d+$/i.test(token));
      return { isCitation, targets, rawTarget: tokens.join(", ") };
    };
  }

  function renderSectionContent(node, context, headingPattern) {
    if (!node) return "";
    const headings = new Set(
      Array.from(node.querySelectorAll("h1.c-article-section__title, h2.c-article-section__title")),
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
    if (metadata.publicationDate) lines.push(`publication_date: ${core.yamlString(metadata.publicationDate)}`);
    if (metadata.year) lines.push(`year: ${core.yamlString(metadata.year)}`);
    if (metadata.doi) lines.push(`doi: ${core.yamlString(metadata.doi)}`);
    if (metadata.url) lines.push(`source_url: ${core.yamlString(metadata.url)}`);
    lines.push(
      `publisher: ${core.yamlString(metadata.publisher || "Springer Nature")}`,
      `source_platform: ${core.yamlString(metadata.sourcePlatform)}`,
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
        const detail = core.renderBlocks(footnote.content, context) ||
          core.normalizeInlineWhitespace(footnote.content.textContent);
        return `${footnote.index}. <a id="${footnote.anchor}"></a>${detail}`;
      })
      .join("\n\n");
  }

  function extractSpringerNatureArticle(document, options) {
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
      duplicateReferenceLabels: [],
      warnings: [],
      warningDetails: [],
    };

    const skipNodes = new Set([
      abstractNode,
      referenceContainer,
      footnoteIndex.container,
    ].filter(Boolean));
    if (bodyRoot) {
      Array.from(bodyRoot.querySelectorAll("section[data-title]")).forEach((section) => {
        const title = section.getAttribute("data-title") || "";
        if (
          /^(?:Inline Recommendations|Author information|Additional information|Rights and permissions|About this article)$/i.test(
            title,
          )
        ) {
          skipNodes.add(section);
        }
      });
      Array.from(
        bodyRoot.querySelectorAll(
          ".app-explore-related-subjects, #researcher-profile-container, .c-pdf-button__container",
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
    const abstractMarkdown = renderSectionContent(abstractNode, context, /^abstract\s*:?[\s\n]*/i);
    const bodyMarkdown = bodyRoot ? core.renderBlocks(bodyRoot, context) : "";
    const footnoteMarkdown = renderFootnotes(footnoteIndex.footnotes, context);
    const referenceMarkdown = renderReferences(referenceIndex.references);

    const mainContent = bodyRoot && bodyRoot.querySelector(".main-content");
    const hasFullText = Boolean(
      mainContent &&
      mainContent.querySelector(
        'section .c-article-section__content p, [data-test="figure"], .mathjax-tex, div[role="paragraph"]',
      ),
    );
    if (!metadata.title) i18n.addWarning(diagnostics, settings.locale, "missingTitle");
    if (!hasFullText) {
      i18n.addWarning(diagnostics, settings.locale, "springerPartialBody");
    }
    if (!referenceIndex.references.length) {
      i18n.addWarning(diagnostics, settings.locale, "missingReferences");
    }
    if (diagnostics.unresolvedCitations.length) {
      i18n.addWarning(diagnostics, settings.locale, "unresolvedCitationCount", {
        count: diagnostics.unresolvedCitations.length,
      });
    }

    const chunks = [];
    if (settings.includeFrontMatter) chunks.push(buildFrontMatter(metadata, referenceIndex.references.length));
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

  PaperMd.springernature = {
    extract: extractSpringerNatureArticle,
    extractMetadata,
    findReferenceContainer,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PaperMd.springernature;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
