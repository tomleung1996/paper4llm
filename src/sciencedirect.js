(function initScienceDirectExtractor(root) {
  "use strict";

  const PaperMd = root.PaperMd || (root.PaperMd = {});
  const core = PaperMd.core;
  if (!core) throw new Error("PaperMd core must be loaded before the ScienceDirect extractor.");
  const i18n = root.PaperMdI18n;
  if (!i18n) throw new Error("PaperMd i18n must be loaded before the ScienceDirect extractor.");

  const TITLE_SELECTORS = [
    "h1#screen-reader-main-title",
    "h1.article-title",
    "h1 .title-text",
    "span.title-text",
    "article h1",
    "main h1",
    "h1",
  ];

  const ABSTRACT_SELECTORS = [
    'section[data-testid="abstract"]',
    "section#abstract",
    ".abstract.author",
    "#ab0005",
    "section.Abstracts",
    ".Abstracts",
    ".abstract",
    '[class*="abstract"]',
  ];

  const HIGHLIGHT_SELECTORS = [
    ".abstract.author-highlights",
    ".author-highlights",
    '[data-testid="highlights"]',
  ];

  const BODY_SELECTORS = [
    'article [data-testid="article-body"]',
    '[data-testid="article-body"]',
    "article #body",
    "#body",
    "article .Body",
    ".Body",
    ".article-body",
    ".ArticleBody",
    "main article",
    "article",
    "main",
  ];

  const REFERENCE_CONTAINER_SELECTORS = [
    'section[data-testid="references"]',
    "section#bibliography",
    "#bibliography",
    "section#references",
    "#references",
    "section.bibliography",
    "#bi0005",
    "section.References",
    ".References",
    "section.references",
    ".references",
    'section[id*="reference" i]',
    'section[class*="bibliograph" i]',
  ];

  function pageUrl(document) {
    const locationUrl = document.location && document.location.href ? document.location.href : "";
    if (locationUrl && locationUrl !== "about:blank") return locationUrl;
    const canonical = document.querySelector('link[rel="canonical"]');
    return (
      core.firstMeta(document, ["citation_public_url", "og:url"]) ||
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

  function extractMetadata(document) {
    const url = pageUrl(document);
    const title =
      core.firstMeta(document, ["citation_title", "dc.title", "og:title"]) ||
      textFromFirst(document, TITLE_SELECTORS) ||
      core.normalizeInlineWhitespace(document.title).replace(/\s*-\s*ScienceDirect\s*$/i, "");

    const domAuthors = Array.from(
      document.querySelectorAll(
        [
          '.AuthorGroups button[data-xocs-content-type="author"]',
          '.author-group button[data-xocs-content-type="author"]',
          '.AuthorGroups a[name^="bau"][name$="-profile"]',
          '.author-group a[name^="bau"][name$="-profile"]',
          '.AuthorGroups a[href^="/author/"]',
          '.author-group a[href^="/author/"]',
        ].join(", "),
      ),
    ).map((control) => {
      const nameContainer = control.querySelector(".react-xocs-alternative-link") || control;
      const givenName = textFromFirst(nameContainer, [".given-name"]);
      const surname = textFromFirst(nameContainer, [".surname"]);
      const structuredName = core.normalizeInlineWhitespace(
        [givenName, surname].filter(Boolean).join(" "),
      );
      if (structuredName) return structuredName;
      return textFromFirst(nameContainer, [".author-name", '[itemprop="name"]']);
    });

    const authors = core.unique([
      ...core.metaContents(document, ["citation_author", "dc.creator", "author"]),
      ...domAuthors,
      ...Array.from(
        document.querySelectorAll(
          '.AuthorGroups .author, .author-group .author, [data-testid="author-list"] [data-testid="author-name"]',
        ),
      ).map((element) => core.normalizeInlineWhitespace(element.textContent)),
    ]);

    const affiliations = core.unique([
      ...core.metaContents(document, ["citation_author_institution", "dc.contributor"]),
      ...Array.from(document.querySelectorAll(".affiliation, .Affiliation")).map((element) =>
        core.normalizeInlineWhitespace(element.textContent),
      ),
    ]);

    const journal = core.firstMeta(document, [
      "citation_journal_title",
      "prism.publicationname",
      "dc.source",
    ]);
    const publicationDate = core.firstMeta(document, [
      "citation_publication_date",
      "prism.publicationdate",
      "dc.date",
      "article:published_time",
    ]);
    const doi = core.normalizeDoi(
      core.firstMeta(document, ["citation_doi", "prism.doi", "dc.identifier"]) || url,
    );
    const piiMatch = url.match(/\/pii\/([^/?#]+)/i);
    const keywords = extractKeywords(document);

    return {
      title,
      authors,
      affiliations,
      journal,
      publicationDate,
      year: (publicationDate.match(/(?:19|20)\d{2}/) || [""])[0],
      doi,
      pii: piiMatch ? piiMatch[1] : "",
      url,
      language: document.documentElement.getAttribute("lang") || "",
      keywords,
    };
  }

  function extractKeywords(document) {
    const fromMeta = core.metaContents(document, ["citation_keywords", "keywords", "dc.subject"])
      .flatMap((value) => value.split(/[;,]/))
      .map(core.normalizeInlineWhitespace);
    const fromDom = Array.from(
      document.querySelectorAll(
        '.Keywords .keyword, .keywords .keyword, [data-testid="keywords"] li, .keyword-list li',
      ),
    ).map((element) => core.normalizeInlineWhitespace(element.textContent).replace(/^keywords?\s*:?\s*/i, ""));
    return core.unique([...fromMeta, ...fromDom]);
  }

  function findReferenceContainer(document) {
    return core.queryFirst(document, REFERENCE_CONTAINER_SELECTORS, (element) => {
      const text = core.normalizeInlineWhitespace(element.textContent);
      return text.length > 20;
    });
  }

  function findReferenceEntries(container, document) {
    const rootElement = container || document;
    const selectorGroups = [
      "ol.references > li, ul.references > li, ol.reference-list > li, ul.reference-list > li",
      ".References > ol > li, .references > ol > li, .Bibliography > ol > li",
      "li.Reference, li.reference, div.Reference, div.reference",
      'li[id^="bib" i], div[id^="bib" i], li[id^="ref" i], div[id^="ref" i]',
      '[data-reference-id][class*="reference" i]',
    ];

    let candidates = [];
    for (const selectors of selectorGroups) {
      const matches = Array.from(rootElement.querySelectorAll(selectors)).filter(
        (element) => core.normalizeInlineWhitespace(element.textContent).length > 15,
      );
      if (matches.length) {
        candidates = matches;
        break;
      }
    }

    if (!candidates.length && container) {
      candidates = Array.from(container.children).filter(
        (element) => core.normalizeInlineWhitespace(element.textContent).length > 20,
      );
    }

    const uniqueCandidates = [];
    const seen = new Set();
    candidates.forEach((candidate) => {
      if (seen.has(candidate)) return;
      if (uniqueCandidates.some((existing) => existing.contains(candidate))) return;
      seen.add(candidate);
      uniqueCandidates.push(candidate);
    });
    return uniqueCandidates;
  }

  function findReferenceLabel(entry, index) {
    const explicit = textFromFirst(entry, [
      ".reference-label",
      ".Reference-label",
      ".label",
      ".ref-number",
      ".reference-number",
      '[data-testid="reference-label"]',
    ]);
    const fromAttribute =
      entry.getAttribute("data-reference-number") ||
      entry.getAttribute("data-ref-number") ||
      entry.getAttribute("data-label");
    const startMatch = core
      .normalizeInlineWhitespace(entry.textContent)
      .match(/^\s*(?:\[\s*)?(\d{1,4})(?:\s*\])?[.)]?\s+/);
    const idMatch = (entry.id || "").match(/(\d+)$/);
    const raw = explicit || fromAttribute || (startMatch && startMatch[1]) || (idMatch && idMatch[1]);
    return core.normalizeInlineWhitespace(raw || String(index + 1)).replace(/^\[|\]$/g, "");
  }

  function referenceAliases(entry, label) {
    const aliases = new Set();
    const add = (value) => {
      const normalized = core.normalizeTargetId(value);
      if (!normalized) return;
      aliases.add(normalized);
      if (normalized.startsWith("ref-id-")) {
        add(normalized.slice("ref-id-".length));
      }
      if (/^bbb\d+$/i.test(normalized)) {
        aliases.add(`bb${normalized.slice(3)}`);
      } else if (/^bb\d+$/i.test(normalized)) {
        aliases.add(`bbb${normalized.slice(2)}`);
      }
    };

    add(entry.id);
    ["data-reference-id", "data-ref-id", "data-id", "data-bib-id"].forEach((attribute) =>
      add(entry.getAttribute(attribute)),
    );
    Array.from(entry.querySelectorAll("[id], [name], [data-xocs-content-id], a[href^='#']")).forEach((element) => {
      add(element.id);
      add(element.getAttribute("name"));
      add(element.getAttribute("data-xocs-content-id"));
      const href = element.getAttribute("href") || "";
      if (href.startsWith("#")) add(href);
    });

    if (/^\d+$/.test(String(label))) {
      const number = String(Number(label));
      [number, `bib${number}`, `b${number}`, `ref${number}`, `reference${number}`].forEach(add);
    }
    return Array.from(aliases);
  }

  function renderReferenceNode(node, baseUrl) {
    if (!node) return "";
    if (node.nodeType === 3) return core.escapeMarkdown(node.nodeValue || "");
    if (node.nodeType !== 1) return "";
    const element = node;
    const tag = element.tagName;
    if (["SCRIPT", "STYLE", "BUTTON", "SVG"].includes(tag)) return "";
    if (/reference-label|ref-number|reference-number/i.test(element.className || "")) return "";

    const children = () => Array.from(element.childNodes).map((child) => renderReferenceNode(child, baseUrl)).join("");
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

  function joinReferenceParts(parts) {
    return parts
      .map((part) => core.normalizeInlineWhitespace(part))
      .filter(Boolean)
      .reduce((result, part) => {
        if (!result) return part;
        return /[.!?;:]$/.test(result) ? `${result} ${part}` : `${result}. ${part}`;
      }, "");
  }

  function structuredReferenceText(entry, baseUrl) {
    const referenceBody = entry.querySelector(".reference, .Reference");
    if (!referenceBody) return "";

    const authors = referenceBody.querySelector(".authors, .Authors");
    const title = referenceBody.querySelector(".title, .Title");
    const host = referenceBody.querySelector(".host, .Host");
    if (!authors && !title && !host) return "";

    const parts = [authors, title, host]
      .filter(Boolean)
      .map((element) => renderReferenceNode(element, baseUrl));
    const doiLinks = core.unique(
      Array.from(referenceBody.querySelectorAll('.ReferenceLinks a[href*="doi.org"], a[href*="doi.org"]'))
        .map((link) => core.normalizeDoi(link.getAttribute("href")))
        .filter(Boolean),
    );
    doiLinks.forEach((doi) => parts.push(`DOI: [${doi}](https://doi.org/${doi})`));
    return joinReferenceParts(parts);
  }

  function cleanReferenceText(entry, label, baseUrl) {
    const structured = structuredReferenceText(entry, baseUrl);
    if (structured) return core.linkifyBareDoi(structured);

    let markdown = core.normalizeInlineWhitespace(renderReferenceNode(entry, baseUrl));
    const escapedLabel = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    markdown = markdown.replace(new RegExp(`^\\s*(?:\\[\\s*)?${escapedLabel}(?:\\s*\\])?[.)]?\\s*`), "");
    return core.linkifyBareDoi(markdown);
  }

  function buildReferenceIndex(entries, baseUrl) {
    const aliasMap = new Map();
    const labelMap = new Map();
    const duplicateLabels = [];
    const references = entries.map((entry, index) => {
      const label = findReferenceLabel(entry, index);
      const reference = {
        kind: "reference",
        index: index + 1,
        label,
        anchor: `ref-${index + 1}`,
        aliases: referenceAliases(entry, label),
        markdown: cleanReferenceText(entry, label, baseUrl),
      };

      reference.aliases.forEach((alias) => {
        if (!aliasMap.has(alias)) aliasMap.set(alias, reference);
      });
      const numeric = /^\d+$/.test(label) ? label : "";
      if (numeric) {
        const normalized = String(Number(numeric));
        if (labelMap.has(normalized)) duplicateLabels.push(normalized);
        else labelMap.set(normalized, reference);
      }
      return reference;
    });
    return { references, aliasMap, labelMap, duplicateLabels: core.unique(duplicateLabels) };
  }

  function buildFootnoteIndex(document) {
    const container = document.querySelector(".Footnotes, .footnotes, [data-testid='footnotes']");
    const aliasMap = new Map();
    if (!container) return { container: null, footnotes: [], aliasMap };

    const footnotes = Array.from(container.querySelectorAll("dl.footnote")).map((entry, index) => {
      const labelNode = entry.querySelector(".footnote-label");
      const detail = entry.querySelector(".footnote-detail") || entry;
      const label = core.normalizeInlineWhitespace(labelNode && labelNode.textContent) || String(index + 1);
      const backHref = labelNode && labelNode.querySelector("a[href^='#']")
        ? labelNode.querySelector("a[href^='#']").getAttribute("href")
        : "";
      const backTarget = core.normalizeTargetId(backHref);
      const numericSuffix = (backTarget.match(/(\d+)$/) || ["", ""])[1];
      const aliases = core.unique([
        backTarget,
        numericSuffix ? `fn${numericSuffix}` : "",
        numericSuffix ? `bfn${numericSuffix}` : "",
        `fn${String(index + 1)}`,
      ]);
      const footnote = {
        kind: "footnote",
        index: index + 1,
        label,
        anchor: `footnote-${index + 1}`,
        aliases,
        detail,
      };
      aliases.forEach((alias) => {
        const normalized = core.normalizeTargetId(alias);
        if (normalized && !aliasMap.has(normalized)) aliasMap.set(normalized, footnote);
      });
      return footnote;
    });
    return { container, footnotes, aliasMap };
  }

  function citationTargetTokens(element) {
    const values = [];
    const href = element.getAttribute("href") || "";
    if (href.includes("#")) values.push(href.slice(href.lastIndexOf("#") + 1));
    [
      "data-reference-id",
      "data-reference-ids",
      "data-ref-id",
      "data-ref-ids",
      "data-bib-id",
      "data-bib-ids",
      "data-xocs-content-id",
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
        const target = referenceIndex.aliasMap.get(token) || footnoteIndex.aliasMap.get(token);
        if (target && !targets.includes(target)) targets.push(target);
      });

      const signature = [
        element.getAttribute("class") || "",
        element.parentElement ? element.parentElement.getAttribute("class") || "" : "",
        tokens.join(" "),
      ].join(" ");
      const targetLooksBibliographic = tokens.some((token) => /^(?:bb|bib|b|ref|reference)[-_:.]?\d+/i.test(token));
      const targetLooksLikeFootnote = tokens.some((token) => /^(?:b?fn)[-_:.]?\d+/i.test(token));
      const hasCitationClass = /(?:^|[-_\s])(citation|citations|xref|cross-ref)(?:$|[-_\s])/i.test(signature);
      const isCitation =
        targets.length > 0 || targetLooksBibliographic || targetLooksLikeFootnote || hasCitationClass;

      if (isCitation && !targets.length) {
        core.parseCitationNumbers(element.textContent).forEach((number) => {
          const target = referenceIndex.labelMap.get(number);
          if (target && !targets.includes(target)) targets.push(target);
        });
      }
      return { isCitation, targets, rawTarget: tokens.join(", ") };
    };
  }

  function findAbstractNode(document) {
    return core.queryFirst(document, ABSTRACT_SELECTORS, (element) => {
      const text = core.normalizeInlineWhitespace(element.textContent).replace(/^abstract\s*/i, "");
      return text.length > 40;
    });
  }

  function findHighlightsNode(document) {
    return core.queryFirst(document, HIGHLIGHT_SELECTORS, (element) => {
      const text = core.normalizeInlineWhitespace(element.textContent).replace(/^highlights\s*/i, "");
      return text.length > 20;
    });
  }

  function findBodyRoot(document) {
    return core.queryFirst(document, BODY_SELECTORS, (element) => {
      const text = core.normalizeInlineWhitespace(element.textContent);
      return text.length > 100;
    });
  }

  function renderSectionContent(node, context, headingPattern) {
    if (!node) return "";
    const headings = new Set(
      Array.from(node.querySelectorAll("h1, h2, h3, .section-title, .Section-title, .abstract-title")),
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
    if (metadata.pii) lines.push(`pii: ${core.yamlString(metadata.pii)}`);
    if (metadata.url) lines.push(`source_url: ${core.yamlString(metadata.url)}`);
    lines.push('publisher: "Elsevier"', 'source_platform: "ScienceDirect"');
    if (metadata.language) lines.push(`language: ${core.yamlString(metadata.language)}`);
    lines.push(`reference_count: ${referenceCount}`, `extracted_at: ${core.yamlString(new Date().toISOString())}`, "---");
    return lines.join("\n");
  }

  function renderReferences(references) {
    if (!references.length) return "";
    return references
      .map((reference) => {
        const label = core.escapeMarkdown(reference.label || String(reference.index));
        const text = reference.markdown || "Reference text unavailable";
        const labelPrefix = /^\d+$/.test(reference.label) && Number(reference.label) === reference.index
          ? ""
          : `**${label}.** `;
        return `${reference.index}. <a id="${reference.anchor}"></a>${labelPrefix}${text}`;
      })
      .join("\n\n");
  }

  function renderFootnotes(footnotes, context) {
    if (!footnotes.length) return "";
    return footnotes
      .map((footnote) => {
        const detail = core.renderBlocks(footnote.detail, context) ||
          core.normalizeInlineWhitespace(footnote.detail.textContent);
        return `${footnote.index}. <a id="${footnote.anchor}"></a>${detail}`;
      })
      .join("\n\n");
  }

  function extractScienceDirectArticle(document, options) {
    const settings = {
      includeImages: true,
      includeFrontMatter: true,
      locale: i18n.detectLocale(),
      ...(options || {}),
    };
    const metadata = extractMetadata(document);
    const highlightsNode = findHighlightsNode(document);
    const abstractNode = findAbstractNode(document);
    const bodyRoot = findBodyRoot(document);
    const referenceContainer = findReferenceContainer(document);
    const referenceEntries = findReferenceEntries(referenceContainer, document);
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
      highlightsNode,
      abstractNode,
      referenceContainer,
      footnoteIndex.container,
    ].filter(Boolean));
    if (bodyRoot) {
      const titleNode = core.queryFirst(bodyRoot, TITLE_SELECTORS);
      if (titleNode) skipNodes.add(titleNode);
      Array.from(
        bodyRoot.querySelectorAll(
          ':scope > header, .article-header, .ArticleHeader, .AuthorGroups, .author-group, [data-testid="author-list"]',
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

    const highlightsMarkdown = renderSectionContent(highlightsNode, context, /^highlights\s*:?\s*/i);
    const abstractMarkdown = renderSectionContent(abstractNode, context, /^abstract\s*:?\s*/i);
    const bodyMarkdown = bodyRoot ? core.renderBlocks(bodyRoot, context) : "";
    const footnoteMarkdown = renderFootnotes(footnoteIndex.footnotes, context);
    const referenceMarkdown = renderReferences(referenceIndex.references);

    if (!metadata.title) i18n.addWarning(diagnostics, settings.locale, "missingTitle");
    if (!bodyRoot || bodyMarkdown.length < 300) {
      i18n.addWarning(diagnostics, settings.locale, "bodyTooShort");
    }
    if (!referenceIndex.references.length) {
      i18n.addWarning(diagnostics, settings.locale, "missingReferences");
    }
    if (diagnostics.unresolvedCitations.length) {
      i18n.addWarning(diagnostics, settings.locale, "unresolvedCitationCount", {
        count: diagnostics.unresolvedCitations.length,
      });
    }
    if (diagnostics.duplicateReferenceLabels.length) {
      i18n.addWarning(diagnostics, settings.locale, "duplicateReferenceLabels", {
        labels: diagnostics.duplicateReferenceLabels.join(", "),
      });
    }

    const chunks = [];
    if (settings.includeFrontMatter) chunks.push(buildFrontMatter(metadata, referenceIndex.references.length));
    chunks.push(`# ${core.escapeMarkdown(metadata.title || "Untitled paper")}`);
    if (metadata.authors.length) chunks.push(`**Authors:** ${metadata.authors.map(core.escapeMarkdown).join(", ")}`);
    const publication = [metadata.journal, metadata.publicationDate].filter(Boolean).map(core.escapeMarkdown).join(", ");
    if (publication) chunks.push(`**Published in:** ${publication}`);
    if (metadata.doi) chunks.push(`**DOI:** [${metadata.doi}](https://doi.org/${metadata.doi})`);
    if (metadata.keywords.length) chunks.push(`**Keywords:** ${metadata.keywords.map(core.escapeMarkdown).join("; ")}`);
    if (highlightsMarkdown) chunks.push(`## Highlights\n\n${highlightsMarkdown}`);
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

  PaperMd.sciencedirect = {
    extract: extractScienceDirectArticle,
    extractMetadata,
    findReferenceContainer,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PaperMd.sciencedirect;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
