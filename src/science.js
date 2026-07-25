(function initScienceExtractor(root) {
  "use strict";

  const PaperMd = root.PaperMd || (root.PaperMd = {});
  const core = PaperMd.core;
  if (!core) throw new Error("PaperMd core must be loaded before the Science extractor.");
  const i18n = root.PaperMdI18n;
  if (!i18n) throw new Error("PaperMd i18n must be loaded before the Science extractor.");

  const TITLE_SELECTORS = [
    'header[data-extent="frontmatter"] h1[property="name"]',
    'article[typeof~="ScholarlyArticle"] h1[property="name"]',
    "main#main h1",
    "h1",
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

  function structuredAuthors(document) {
    return Array.from(
      document.querySelectorAll(
        'header[data-extent="frontmatter"] .contributors [property="author"][typeof="Person"]',
      ),
    ).map((author) => {
      const given = textFromFirst(author, ['[property="givenName"]']);
      const family = textFromFirst(author, ['[property="familyName"]']);
      return core.normalizeInlineWhitespace([given, family].filter(Boolean).join(" "));
    });
  }

  function extractKeywords(document) {
    const fromMeta = core.metaContents(document, ["citation_keywords", "keywords", "dc.subject"])
      .flatMap((value) => value.split(/[;,]/))
      .map(core.normalizeInlineWhitespace);
    const fromDom = Array.from(
      document.querySelectorAll(
        '[property="keywords"] a, .core-keywords a, [class*="keyword" i] li',
      ),
    ).map((element) => core.normalizeInlineWhitespace(element.textContent));
    return core.unique([...fromMeta, ...fromDom]);
  }

  function extractMetadata(document) {
    const url = pageUrl(document);
    const title =
      core.firstMeta(document, ["dc.title", "citation_title", "og:title"]) ||
      textFromFirst(document, TITLE_SELECTORS) ||
      core.normalizeInlineWhitespace(document.title).replace(/\s*\|\s*Science\s*$/i, "");
    const visibleAuthors = structuredAuthors(document);
    const authors = core.unique(
      visibleAuthors.length
        ? visibleAuthors
        : core.metaContents(document, ["dc.creator", "citation_author"]),
    );
    const affiliations = core.unique(
      core.metaContents(document, ["citation_author_institution", "dc.contributor"]),
    );
    const journal =
      core.firstMeta(document, ["citation_journal_title", "prism.publicationname", "dc.source"]) ||
      textFromFirst(document, ['.core-self-citation [property="name"]']);
    const publicationDate =
      core.firstMeta(document, [
        "dc.date",
        "citation_online_date",
        "citation_publication_date",
        "prism.publicationdate",
        "article:published_time",
      ]) || textFromFirst(document, ['.core-self-citation [property="datePublished"]']);
    const doi = core.normalizeDoi(
      core.firstMeta(document, [
        "publication_doi",
        "citation_doi",
        "dc.identifier",
        "prism.doi",
      ]) ||
      textFromFirst(document, ['.doi [property="sameAs"]']) ||
      url,
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
        "American Association for the Advancement of Science",
      sourcePlatform: "Science / AAAS",
      language:
        core.firstMeta(document, ["citation_language", "dc.language"]) ||
        document.documentElement.getAttribute("lang") ||
        "",
      keywords: extractKeywords(document),
    };
  }

  function findAbstractNode(document) {
    const candidates = Array.from(
      document.querySelectorAll('#abstracts section[role="doc-abstract"], section[role="doc-abstract"]'),
    ).filter((element) => core.normalizeInlineWhitespace(element.textContent).length > 40);
    return (
      candidates.find((element) => element.id.toLowerCase() === "abstract") ||
      candidates.find((element) => !/editor/i.test(element.id || "")) ||
      candidates[0] ||
      null
    );
  }

  function findBodyRoot(document) {
    return (
      document.querySelector(
        '#bodymatter[data-extent="bodymatter"][property="articleBody"] > .core-container',
      ) ||
      document.querySelector('#bodymatter[data-extent="bodymatter"][property="articleBody"]') ||
      null
    );
  }

  function findReferenceContainer(document) {
    return (
      document.querySelector('#bibliography[role="doc-bibliography"]') ||
      document.querySelector("#bibliography") ||
      document.querySelector('[role="doc-bibliography"]')
    );
  }

  function findReferenceEntries(container) {
    if (!container) return [];
    return Array.from(
      container.querySelectorAll(
        ".bibliolist > .biblioentry[data-has~='label'], .bibliolist > .biblioentry, .biblioentry[data-has~='label']",
      ),
    ).filter((entry) => Boolean(entry.querySelector(".citation-content")));
  }

  function referenceLabel(entry, index) {
    return textFromFirst(entry, [".label"]).replace(/[.)]+$/g, "") || String(index + 1);
  }

  function referenceAliases(entry, label) {
    const aliases = new Set();
    const add = (value) => {
      const normalized = core.normalizeTargetId(value);
      if (!normalized) return;
      aliases.add(normalized);
      const match = normalized.match(/^r(\d+)$/i);
      if (match) aliases.add(String(Number(match[1])));
    };
    add(entry.id);
    ["data-xml-rid", "data-reference-id", "data-ref-id"].forEach((attribute) =>
      add(entry.getAttribute(attribute)),
    );
    Array.from(entry.querySelectorAll(".citations[id], [id]")).forEach((element) => add(element.id));
    if (/^\d+$/.test(label)) {
      add(label);
      add(`R${Number(label)}`);
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
    const content = entry.querySelector(".citation-content") || entry;
    let markdown = core.normalizeInlineWhitespace(renderReferenceNode(content, baseUrl));
    const doiLink = entry.querySelector(
      '.external-links .core-xlink-crossref a[href], .external-links a[href*="doi.org"]',
    );
    const doi = core.normalizeDoi((doiLink && doiLink.getAttribute("href")) || "");
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
    const container = document.querySelector("#backmatter") || document;
    const entries = Array.from(
      container.querySelectorAll('[role="doc-footnote"][id], li.footnote[id]'),
    ).filter((entry) => !entry.closest("figcaption"));
    const aliasMap = new Map();
    const footnotes = entries.map((entry, index) => {
      const label = textFromFirst(entry, [".label"]) || String(index + 1);
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
        content: entry,
      };
      aliases.forEach((alias) => {
        if (alias && !aliasMap.has(alias)) aliasMap.set(alias, footnote);
      });
      return footnote;
    });
    return { footnotes, aliasMap };
  }

  function citationTargetTokens(element) {
    const values = [];
    const xmlRid = element.getAttribute("data-xml-rid");
    if (xmlRid) values.push(...xmlRid.split(/[\s,;]+/));
    const href = element.getAttribute("href") || "";
    if (href.includes("#")) values.push(href.slice(href.lastIndexOf("#") + 1));
    ["data-reference-id", "data-ref-id", "aria-describedby"].forEach((attribute) => {
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
      const role = (element.getAttribute("role") || "").toLowerCase();
      const isCitation =
        targets.length > 0 ||
        role === "doc-biblioref" ||
        role === "doc-noteref" ||
        tokens.some((token) => /^r\d+$|^fn\d+$/i.test(token));
      return { isCitation, targets, rawTarget: tokens.join(", ") };
    };
  }

  function renderSectionContent(node, context) {
    if (!node) return "";
    const headings = new Set(
      Array.from(node.querySelectorAll(":scope > h1, :scope > h2, :scope > header > h1, :scope > header > h2")),
    );
    return core.renderBlocks(node, { ...context, skipNodes: headings }).trim();
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
      `publisher: ${core.yamlString(metadata.publisher)}`,
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
        const labelNode = footnote.content.querySelector(".label");
        const skipNodes = new Set(context.skipNodes || []);
        if (labelNode) skipNodes.add(labelNode);
        const detail = core.renderBlocks(footnote.content, { ...context, skipNodes }) ||
          core.normalizeInlineWhitespace(footnote.content.textContent);
        return `${footnote.index}. <a id="${footnote.anchor}"></a>${detail}`;
      })
      .join("\n\n");
  }

  function extractScienceArticle(document, options) {
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

    const denialBlock = bodyRoot && bodyRoot.querySelector(".denial-block");
    const skipNodes = new Set([abstractNode, denialBlock].filter(Boolean));
    if (bodyRoot) {
      Array.from(
        bodyRoot.querySelectorAll(
          ".related-content, .recommended, .article-tools, .social-links, .core-ad-container",
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

    const abstractMarkdown = renderSectionContent(abstractNode, context);
    const bodyMarkdown = bodyRoot ? core.renderBlocks(bodyRoot, context) : "";
    const footnoteMarkdown = renderFootnotes(footnoteIndex.footnotes, context);
    const referenceMarkdown = renderReferences(referenceIndex.references);
    const hasFullText = Boolean(
      bodyRoot &&
      !denialBlock &&
      bodyRoot.querySelector('section[id^="sec-"], div[role="paragraph"]'),
    );

    if (!metadata.title) i18n.addWarning(diagnostics, settings.locale, "missingTitle");
    if (!hasFullText) {
      i18n.addWarning(diagnostics, settings.locale, "sciencePartialBody");
    }
    if (!referenceIndex.references.length) {
      i18n.addWarning(diagnostics, settings.locale, "missingReferences");
    }
    if (diagnostics.unresolvedCitations.length) {
      i18n.addWarning(diagnostics, settings.locale, "unresolvedCitationCount", {
        count: diagnostics.unresolvedCitations.length,
      });
    }
    if (settings.includeImages && document.querySelector("#bodymatter figure img")) {
      i18n.addWarning(diagnostics, settings.locale, "scienceImageSession");
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

  PaperMd.science = {
    extract: extractScienceArticle,
    extractMetadata,
    findReferenceContainer,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PaperMd.science;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
