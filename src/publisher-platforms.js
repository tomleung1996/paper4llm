(function initPublisherPlatformExtractors(root) {
  "use strict";

  const PaperMd = root.PaperMd || (root.PaperMd = {});
  const core = PaperMd.core;
  const i18n = root.PaperMdI18n;
  if (!core) throw new Error("PaperMd core must be loaded before the publisher extractors.");
  if (!i18n) throw new Error("PaperMd i18n must be loaded before the publisher extractors.");

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

  function parseJson(value) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  function schemaArticles(document) {
    const articles = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      const parsed = parseJson(script.textContent || "");
      const visit = (value) => {
        if (!value) return;
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (typeof value !== "object") return;
        const type = value["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((entry) => /^(?:ScholarlyArticle|Article|NewsArticle)$/i.test(entry || ""))) {
          articles.push(value);
        }
        if (Array.isArray(value["@graph"])) value["@graph"].forEach(visit);
      };
      visit(parsed);
    });
    return articles;
  }

  function schemaNames(value) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return values
      .map((entry) =>
        typeof entry === "string"
          ? entry
          : entry && (entry.name || [entry.givenName, entry.familyName].filter(Boolean).join(" ")),
      )
      .map(core.normalizeInlineWhitespace)
      .filter(Boolean);
  }

  function schemaAffiliations(article) {
    const authors = Array.isArray(article && article.author) ? article.author : [];
    return authors.flatMap((author) => {
      const affiliations = Array.isArray(author && author.affiliation)
        ? author.affiliation
        : author && author.affiliation
          ? [author.affiliation]
          : [];
      return affiliations.map((affiliation) =>
        core.normalizeInlineWhitespace(
          typeof affiliation === "string" ? affiliation : affiliation && affiliation.name,
        ),
      );
    }).filter(Boolean);
  }

  function genericMetadata(document, profile) {
    const url = pageUrl(document);
    const schemas = schemaArticles(document);
    const schema = schemas[0] || {};
    const domAuthors = profile.extractAuthors ? profile.extractAuthors(document) : [];
    const authors = core.unique([
      ...core.metaContents(document, ["citation_author", "dc.creator", "author"]),
      ...schemaNames(schema.author),
      ...domAuthors,
    ]);
    const domAffiliations = profile.extractAffiliations ? profile.extractAffiliations(document) : [];
    const affiliations = core.unique([
      ...core.metaContents(document, ["citation_author_institution", "dc.contributor"]),
      ...schemaAffiliations(schema),
      ...domAffiliations,
    ]);
    const title =
      core.firstMeta(document, ["citation_title", "dc.title", "title", "og:title"]) ||
      core.normalizeInlineWhitespace(schema.headline || schema.name) ||
      textFromFirst(document, profile.titleSelectors || ["h1"]) ||
      core.normalizeInlineWhitespace(document.title).replace(profile.titleSuffix || /$^/, "");
    const journal =
      core.firstMeta(document, ["citation_journal_title", "prism.publicationname", "dc.source"]) ||
      core.normalizeInlineWhitespace(
        schema.isPartOf && (schema.isPartOf.name || schema.isPartOf.headline),
      ) ||
      (profile.extractJournal ? profile.extractJournal(document) : "");
    const publicationDate =
      core.firstMeta(document, [
        "citation_online_date",
        "citation_publication_date",
        "citation_cover_date",
        "prism.publicationdate",
        "dc.date",
        "article:published_time",
      ]) ||
      core.normalizeInlineWhitespace(schema.datePublished) ||
      (profile.extractPublicationDate ? profile.extractPublicationDate(document) : "");
    const doi =
      core.normalizeDoi(core.firstMeta(document, ["citation_doi", "prism.doi", "dc.identifier"])) ||
      core.normalizeDoi(schema.identifier) ||
      core.normalizeDoi(profile.extractDoi ? profile.extractDoi(document) : "") ||
      core.normalizeDoi(url) ||
      core.normalizeDoi(document.body && document.body.textContent);
    const keywords = core.unique([
      ...core.metaContents(document, ["citation_keywords", "keywords", "dc.subject"])
        .flatMap((value) => value.split(/[;,]/)),
      ...String(schema.keywords || "").split(/[;,]/),
      ...(profile.extractKeywords ? profile.extractKeywords(document) : []),
    ].map(core.normalizeInlineWhitespace));

    return {
      title,
      authors,
      affiliations,
      journal,
      publicationDate,
      year: (publicationDate.match(/(?:19|20)\d{2}/) || [""])[0],
      doi,
      url,
      publisher: profile.publisher,
      sourcePlatform: profile.sourcePlatform,
      language:
        core.firstMeta(document, ["citation_language", "dc.language"]) ||
        document.documentElement.getAttribute("lang") ||
        "",
      keywords,
    };
  }

  function referenceLabel(entry, index, profile) {
    if (profile.referenceLabel) return profile.referenceLabel(entry, index);
    const explicit = textFromFirst(entry, [
      ".reference-label",
      ".References__label",
      ".label",
      ".number",
      ".ref-number",
    ]).replace(/[.)\]]+$/g, "");
    const id =
      entry.id ||
      entry.getAttribute("data-legacy-id") ||
      entry.getAttribute("content-id") ||
      entry.getAttribute("data-content-id") ||
      "";
    const match = id.match(/(?:bibr|bib|ref|b)(\d+)/i) || id.match(/(\d+)$/);
    return explicit || (match && String(Number(match[1]))) || String(index + 1);
  }

  function referenceAliases(entry, label) {
    const aliases = new Set();
    const add = (value) => {
      const normalized = core.normalizeTargetId(value);
      if (normalized) aliases.add(normalized);
    };
    add(entry.id);
    [
      "data-legacy-id",
      "content-id",
      "data-reference-id",
      "data-ref-id",
      "data-rid",
      "data-bib-id",
      "data-content-id",
      "data-id",
      "name",
    ].forEach((attribute) => add(entry.getAttribute(attribute)));
    Array.from(
      entry.querySelectorAll("[id], [name], [data-legacy-id], [content-id], [data-content-id]"),
    ).forEach(
      (element) => {
        add(element.id);
        add(element.getAttribute("name"));
        add(element.getAttribute("data-legacy-id"));
        add(element.getAttribute("content-id"));
        add(element.getAttribute("data-content-id"));
      },
    );
    if (/^\d+$/.test(String(label))) {
      const number = String(Number(label));
      [number, `b${number}`, `bib${number}`, `ref${number}`, `bibr${number}`].forEach(add);
    }
    return Array.from(aliases);
  }

  function renderReferenceNode(node, baseUrl, profile) {
    if (!node) return "";
    if (node.nodeType === 3) return core.escapeMarkdown(node.nodeValue || "");
    if (node.nodeType !== 1) return "";
    const element = node;
    const tag = element.tagName;
    if (["BUTTON", "INPUT", "SCRIPT", "STYLE", "SVG"].includes(tag)) return "";
    if (element.getAttribute("aria-hidden") === "true") return "";
    if (profile.referenceNoiseSelectors && element.matches(profile.referenceNoiseSelectors)) return "";

    const children = () =>
      Array.from(element.childNodes)
        .map((child) => renderReferenceNode(child, baseUrl, profile))
        .join("");
    if (tag === "A") {
      const text = core.normalizeInlineWhitespace(children() || element.textContent);
      const href = core.absoluteUrl(element.getAttribute("href"), baseUrl);
      if (!href || href.includes("scholar.google") || href.includes("javascript:")) return text;
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

  function referenceContent(entry, profile) {
    return profile.referenceContentSelector
      ? entry.querySelector(profile.referenceContentSelector) || entry
      : entry;
  }

  function cleanReference(entry, baseUrl, profile) {
    const source = referenceContent(entry, profile);
    const markdown = core.normalizeInlineWhitespace(renderReferenceNode(source, baseUrl, profile));
    return core.linkifyBareDoi(markdown);
  }

  function buildReferenceIndex(entries, baseUrl, profile) {
    const aliasMap = new Map();
    const references = entries.map((entry, index) => {
      const label = referenceLabel(entry, index, profile);
      const reference = {
        kind: "reference",
        index: index + 1,
        label,
        anchor: `ref-${index + 1}`,
        aliases: referenceAliases(entry, label),
        markdown: cleanReference(entry, baseUrl, profile),
      };
      reference.aliases.forEach((alias) => {
        if (!aliasMap.has(alias)) aliasMap.set(alias, reference);
      });
      return reference;
    });
    return { references, aliasMap };
  }

  function citationTokens(element, profile) {
    if (profile.citationTokens) return profile.citationTokens(element).map(core.normalizeTargetId);
    const values = [];
    const href = element.getAttribute("href") || "";
    if (href.includes("#")) values.push(href.slice(href.lastIndexOf("#") + 1));
    [
      "data-rid",
      "data-ref-id",
      "data-reference-id",
      "data-bib-id",
      "data-open",
      "reveal-id",
      "anchor",
      "data-range",
      "aria-describedby",
    ].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value) values.push(...value.split(/[\s,;]+/));
    });
    return core.unique(values.map(core.normalizeTargetId));
  }

  function createCitationResolver(referenceIndex, profile) {
    return function resolveCitation(element) {
      const tokens = citationTokens(element, profile);
      const targets = [];
      tokens.forEach((token) => {
        const target = referenceIndex.aliasMap.get(token);
        if (target && !targets.includes(target)) targets.push(target);
      });
      const isCitation = targets.length > 0 ||
        (profile.isCitation ? profile.isCitation(element, tokens) : tokens.length > 0);
      return { isCitation, targets, rawTarget: tokens.join(", ") };
    };
  }

  function renderReferences(references) {
    return references
      .map((reference) =>
        `${reference.index}. <a id="${reference.anchor}"></a>${reference.markdown || "Reference text unavailable"}`,
      )
      .join("\n\n");
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

  function makeExtractor(profile) {
    function findBody(document) {
      return core.queryFirst(document, profile.bodySelectors, (element) =>
        core.normalizeInlineWhitespace(element.textContent).length > 100,
      );
    }

    function findAbstract(document) {
      if (!profile.abstractSelectors) return null;
      return core.queryFirst(document, profile.abstractSelectors, (element) =>
        core.normalizeInlineWhitespace(element.textContent).length > 40,
      );
    }

    function findReferenceContainer(document) {
      if (profile.referenceContainer) return profile.referenceContainer(document);
      return core.queryFirst(document, profile.referenceContainerSelectors || [], (element) =>
        Boolean(element.querySelector(profile.referenceEntrySelector)) ||
        core.normalizeInlineWhitespace(element.textContent).length > 20,
      );
    }

    function findReferenceEntries(container, document) {
      if (profile.referenceEntries) return profile.referenceEntries(container, document);
      const rootElement = container || document;
      return Array.from(rootElement.querySelectorAll(profile.referenceEntrySelector)).filter(
        (entry) => core.normalizeInlineWhitespace(entry.textContent).length > 10,
      );
    }

    function extract(document, options) {
      const settings = {
        includeImages: true,
        includeFrontMatter: true,
        locale: i18n.detectLocale(),
        ...(options || {}),
      };
      if (profile.prepareDocument) profile.prepareDocument(document);
      const metadata = genericMetadata(document, profile);
      const abstractNode = findAbstract(document);
      const bodyRoot = findBody(document);
      const referenceContainer = findReferenceContainer(document);
      const referenceEntries = findReferenceEntries(referenceContainer, document);
      const referenceIndex = buildReferenceIndex(referenceEntries, metadata.url, profile);
      const diagnostics = {
        references: referenceIndex.references.length,
        footnotes: 0,
        resolvedCitationLinks: 0,
        resolvedFootnoteLinks: 0,
        unresolvedCitations: [],
        duplicateReferenceLabels: [],
        warnings: [],
        warningDetails: [],
      };
      const skipNodes = new Set([abstractNode, referenceContainer].filter(Boolean));
      if (bodyRoot && referenceContainer && bodyRoot.contains(referenceContainer)) {
        let child = referenceContainer;
        while (child.parentElement && child.parentElement !== bodyRoot) child = child.parentElement;
        skipNodes.add(child);
      }
      if (bodyRoot && profile.noiseSelectors) {
        Array.from(bodyRoot.querySelectorAll(profile.noiseSelectors)).forEach((node) => skipNodes.add(node));
      }
      const context = {
        baseUrl: metadata.url,
        includeImages: settings.includeImages,
        resolveCitation: createCitationResolver(referenceIndex, profile),
        diagnostics,
        skipNodes,
      };
      const abstractMarkdown = abstractNode
        ? core.renderBlocks(abstractNode, context).replace(/^abstract\s*:?\s*/i, "").trim()
        : "";
      const bodyMarkdown = bodyRoot ? core.renderBlocks(bodyRoot, context) : "";
      const referenceMarkdown = renderReferences(referenceIndex.references);

      if (!metadata.title) i18n.addWarning(diagnostics, settings.locale, "missingTitle");
      if (!bodyMarkdown || bodyMarkdown.length < 300) {
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
      if (referenceMarkdown) chunks.push(`## References\n\n${referenceMarkdown}`);
      chunks.push(
        `<!-- paper-md-integrity: references=${diagnostics.references}; citation_targets_resolved=${diagnostics.resolvedCitationLinks}; footnotes=0; footnote_targets_resolved=0; citation_targets_unresolved=${diagnostics.unresolvedCitations.length} -->`,
      );

      return {
        markdown: chunks.filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim().concat("\n"),
        metadata,
        diagnostics,
        filename: `${core.sanitizeFileName(metadata.title)}.md`,
      };
    }

    return { extract, extractMetadata: (document) => genericMetadata(document, profile), findReferenceContainer };
  }

  function directChildrenText(element, selectors) {
    return Array.from(element.querySelectorAll(selectors))
      .map((node) => core.normalizeInlineWhitespace(node.textContent))
      .filter(Boolean);
  }

  const mdpiProfile = {
    publisher: "MDPI AG",
    sourcePlatform: "MDPI",
    titleSelectors: ["h1.title.hyp-title", "h1"],
    abstractSelectors: [".art-abstract", ".html-p[data-xml-type='abstract']"],
    bodySelectors: [".html-body"],
    prepareDocument: (document) => {
      document.querySelectorAll(".html-figure").forEach((wrapper) => {
        if (wrapper.tagName === "FIGURE" || wrapper.closest("figure")) return;
        const figure = document.createElement("figure");
        figure.className = `${wrapper.className || ""} paper-md-mdpi-figure`.trim();
        while (wrapper.firstChild) figure.appendChild(wrapper.firstChild);
        wrapper.replaceWith(figure);
      });
    },
    referenceContainerSelectors: [".art-references", ".html-references"],
    referenceEntrySelector: 'li[id^="B"]',
    referenceContentSelector: ".html-p, .reference-text",
    referenceNoiseSelectors: ".html-ref-links, .extra-links, .google-scholar",
    citationTokens: (element) => [element.getAttribute("href") || element.getAttribute("data-ref-id") || ""],
    isCitation: (element) => element.matches("a.html-bibr, a[href^='#B']"),
    noiseSelectors: ".html-back, .art-references, .references, .html-references",
  };

  const taylorFrancisProfile = {
    publisher: "Taylor & Francis",
    sourcePlatform: "Taylor & Francis Online",
    titleSelectors: ["h1.article-title", "h1"],
    abstractSelectors: [".abstractSection", ".abstractInFull", ".abstract"],
    bodySelectors: [".hlFld-Fulltext"],
    referenceContainerSelectors: ["#references-Section1", "section.references", ".references"],
    referenceEntrySelector: "ul.references > li[id], ol.references > li[id]",
    referenceNoiseSelectors: ".extra-links, .ref-links, .metrics, .google-scholar, .openUrl",
    citationTokens: (element) => [element.getAttribute("data-rid") || ""],
    isCitation: (element) => element.matches('a[data-ref-type="bibr"], .ref-lnk.bibr a'),
    noiseSelectors: "#references-Section1, .references, .relatedArticles, .recommendations",
  };

  const oupProfile = {
    publisher: "Oxford University Press",
    sourcePlatform: "Oxford Academic",
    titleSelectors: ["h1.article-title-main", "h1"],
    abstractSelectors: [".abstract", ".abstractInFull", "section.abstract"],
    bodySelectors: [".widget-ArticleFulltext .widget-items", ".article-body.js-content-body"],
    referenceContainerSelectors: [".ref-list", ".references", ".js-splitview-ref-list"],
    referenceEntrySelector: ".js-splitview-ref-item",
    referenceNoiseSelectors: ".ref-links, .js-ref-links, .google-scholar, .link-ref, .reference-links",
    citationTokens: (element) => [
      element.getAttribute("reveal-id") ||
      element.getAttribute("data-open") ||
      element.getAttribute("href") ||
      "",
    ],
    isCitation: (element) => element.matches("a.xref-bibr"),
    noiseSelectors: ".js-splitview-ref-list, .references, .related-articles, .article-metrics",
  };

  const mitPressProfile = {
    publisher: "MIT Press",
    sourcePlatform: "MIT Press Direct",
    titleSelectors: ["h1.article-title-main", "h1"],
    abstractSelectors: [
      ".widget-ArticleFulltext .widget-items > .abstract-title + div",
      ".abstract",
    ],
    bodySelectors: [".widget-ArticleFulltext .widget-items", ".article-body"],
    referenceContainerSelectors: [
      ".widget-ArticleFulltext .backreferences-title + div",
      ".backreferences-title + div",
    ],
    prepareDocument: (document) => {
      document.querySelectorAll(".fig.fig-section").forEach((wrapper) => {
        if (wrapper.tagName === "FIGURE") return;
        const figure = document.createElement("figure");
        figure.className = wrapper.className;
        while (wrapper.firstChild) figure.appendChild(wrapper.firstChild);
        wrapper.replaceWith(figure);
      });
    },
    referenceEntrySelector: '[data-content-id^="bib"]',
    referenceContentSelector: ".ref-content, .ref",
    referenceNoiseSelectors: [
      ".citation-links",
      ".ref-links",
      ".reference-links",
      ".google-scholar",
      ".google-scholar-ref-link",
      ".js-ref-link",
    ].join(", "),
    citationTokens: (element) => [
      element.getAttribute("data-modal-source-id") ||
      element.getAttribute("data-content-id") ||
      element.getAttribute("href") ||
      "",
    ],
    isCitation: (element) => element.matches("a.xref-bibr, a.link-ref[data-modal-source-id]"),
    noiseSelectors: [
      ".abstract-title",
      ".backreferences-title",
      ".backreferences-title + div",
      ".authornotes-section-wrapper",
      ".permissionstatement-section-wrapper",
      ".article-metadata-standalone-panel",
      ".fig-orig",
      ".table-modal",
      "#sr-fig-viewer-action",
    ].join(", "),
  };

  const sageProfile = {
    publisher: "SAGE Publications",
    sourcePlatform: "SAGE Journals",
    titleSelectors: ["#article-title", "h1"],
    abstractSelectors: [".article-summary", ".abstractSection", ".abstract"],
    bodySelectors: ["article.doi-article-content .article-content", ".hlFld-Fulltext"],
    referenceContainerSelectors: [".article-refList", "#references-Section1", ".references"],
    referenceEntrySelector: ".article-refList > div[id^='bibr'], .article-refList [id^='bibr'], ul.references > li[id]",
    referenceContentSelector: ".article-refList-item-content, .reference",
    referenceNoiseSelectors: ".reference-links, .ref-links, .google-scholar",
    citationTokens: (element) => [
      element.getAttribute("data-ref-id") || element.getAttribute("data-rid") || element.getAttribute("href") || "",
    ],
    isCitation: (element) => element.matches("a.bibr, a[data-ref-type='bibr']"),
    noiseSelectors: ".article-refList, .article-footnotes, .relatedArticles, .recommendations",
  };

  const frontiersBaseProfile = {
    publisher: "Frontiers Media SA",
    sourcePlatform: "Frontiers",
    titleSelectors: [".ArticleDetailsV4__main__title", "h1"],
    abstractSelectors: [".ArticleContent > #h1", ".ArticleContent [id='abstract']"],
    bodySelectors: [".ArticleDetailsV4__main__content > .ArticleContent", ".ArticleContent"],
    referenceContainerSelectors: [".ArticleContent ul.References", "ul.References"],
    referenceEntrySelector: "li.References__item[id]",
    referenceContentSelector: ".References__content > p, .References__content",
    referenceNoiseSelectors: ".References__links",
    citationTokens: (element) => [(element.id || "").replace(/-button$/i, "")],
    isCitation: (element) => element.matches("button.ArticleReference"),
    noiseSelectors: "ul.References, .References__links, .ArticleDetailsV4__relatedArticles",
    extractAuthors: (document) => directChildrenText(document, ".PeopleList [data-name], .PeopleList a"),
  };

  const mdpi = makeExtractor(mdpiProfile);
  const taylorfrancis = makeExtractor(taylorFrancisProfile);
  const oup = makeExtractor(oupProfile);
  const mitpress = makeExtractor(mitPressProfile);
  const sage = makeExtractor(sageProfile);
  const frontiersBase = makeExtractor(frontiersBaseProfile);

  function ieeeMetadata(document) {
    const profile = {
      publisher: "Institute of Electrical and Electronics Engineers (IEEE)",
      sourcePlatform: "IEEE Xplore",
      titleSelectors: ["h1.document-title", "h1"],
      extractAuthors: (doc) => {
        const text = textFromFirst(doc, [".authors-info-container"]);
        return text.split(/\s*;\s*/).map(core.normalizeInlineWhitespace).filter(Boolean);
      },
      extractJournal: (doc) => {
        const main = textFromFirst(doc, ["main#xplMainContentLandmark"]);
        const match = main.match(/Published in:\s*([^\n(]+)/i);
        return match ? core.normalizeInlineWhitespace(match[1]) : "";
      },
      extractPublicationDate: (doc) => {
        const main = textFromFirst(doc, ["main#xplMainContentLandmark"]);
        const match = main.match(/Date of Publication:\s*([^\n]+?)(?=\s*(?:Electronic ISSN|DOI|Publisher|Funding Agency):)/i);
        return match ? core.normalizeInlineWhitespace(match[1]) : "";
      },
      extractDoi: (doc) => textFromFirst(doc, ["main#xplMainContentLandmark"]),
    };
    return genericMetadata(document, profile);
  }

  function ieeeReferenceEntries(document) {
    return Array.from(
      document.querySelectorAll(".accordion-body.show .reference-container, #references .reference-container"),
    ).filter((entry, index, entries) => entries.indexOf(entry) === index);
  }

  const ieeeProfile = {
    referenceContentSelector: ".col.u-px-1.text-break > div:first-child, .col.text-break > div:first-child",
    referenceNoiseSelectors: ".ref-links-container, input, button",
    referenceLabel: (entry, index) =>
      textFromFirst(entry, [".number"]).replace(/[^0-9A-Za-z-]/g, "") || String(index + 1),
  };

  function ieeeCitationResolver(referenceIndex) {
    return function resolveCitation(element) {
      let token = core.normalizeTargetId(
        element.getAttribute("anchor") || element.getAttribute("data-range") || "",
      );
      const numeric = (token.match(/ref(\d+)/i) || ["", ""])[1];
      if (numeric) token = String(Number(numeric));
      const target = referenceIndex.aliasMap.get(token) || referenceIndex.aliasMap.get(`ref${token}`);
      return {
        isCitation: element.matches('a[ref-type="bibr"]'),
        targets: target ? [target] : [],
        rawTarget: token,
      };
    };
  }

  function extractIeee(document, options) {
    const settings = {
      includeImages: true,
      includeFrontMatter: true,
      locale: i18n.detectLocale(),
      ...(options || {}),
    };
    const metadata = ieeeMetadata(document);
    const entries = ieeeReferenceEntries(document);
    const referenceIndex = buildReferenceIndex(entries, metadata.url, ieeeProfile);
    const diagnostics = {
      references: referenceIndex.references.length,
      footnotes: 0,
      resolvedCitationLinks: 0,
      resolvedFootnoteLinks: 0,
      unresolvedCitations: [],
      duplicateReferenceLabels: [],
      warnings: [],
      warningDetails: [],
    };
    const body = document.querySelector("#article");
    const context = {
      baseUrl: metadata.url,
      includeImages: settings.includeImages,
      resolveCitation: ieeeCitationResolver(referenceIndex),
      diagnostics,
      skipNodes: new Set(),
    };
    const bodyMarkdown = body ? core.renderBlocks(body, context) : "";
    if (!metadata.title) i18n.addWarning(diagnostics, settings.locale, "missingTitle");
    if (!bodyMarkdown || bodyMarkdown.length < 300) i18n.addWarning(diagnostics, settings.locale, "bodyTooShort");
    if (!entries.length) i18n.addWarning(diagnostics, settings.locale, "missingReferences");
    if (diagnostics.unresolvedCitations.length) {
      i18n.addWarning(diagnostics, settings.locale, "unresolvedCitationCount", {
        count: diagnostics.unresolvedCitations.length,
      });
    }
    const chunks = [];
    if (settings.includeFrontMatter) chunks.push(buildFrontMatter(metadata, entries.length));
    chunks.push(`# ${core.escapeMarkdown(metadata.title || "Untitled paper")}`);
    if (metadata.authors.length) chunks.push(`**Authors:** ${metadata.authors.map(core.escapeMarkdown).join(", ")}`);
    if (metadata.journal || metadata.publicationDate) {
      chunks.push(`**Published in:** ${[metadata.journal, metadata.publicationDate].filter(Boolean).map(core.escapeMarkdown).join(", ")}`);
    }
    if (metadata.doi) chunks.push(`**DOI:** [${metadata.doi}](https://doi.org/${metadata.doi})`);
    if (bodyMarkdown) chunks.push(bodyMarkdown);
    const references = renderReferences(referenceIndex.references);
    if (references) chunks.push(`## References\n\n${references}`);
    chunks.push(`<!-- paper-md-integrity: references=${diagnostics.references}; citation_targets_resolved=${diagnostics.resolvedCitationLinks}; footnotes=0; footnote_targets_resolved=0; citation_targets_unresolved=${diagnostics.unresolvedCitations.length} -->`);
    return {
      markdown: chunks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim().concat("\n"),
      metadata,
      diagnostics,
      filename: `${core.sanitizeFileName(metadata.title)}.md`,
    };
  }

  async function prepareIeee(document, timeoutMs) {
    if (ieeeReferenceEntries(document).length) return;
    const link = Array.from(document.querySelectorAll("a")).find(
      (anchor) => core.normalizeInlineWhitespace(anchor.textContent) === "References",
    );
    if (!link) return;
    link.click();
    await new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (ieeeReferenceEntries(document).length || Date.now() - started >= timeoutMs) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  }

  function hydrateProps(document, key) {
    const element = document.querySelector(`[data-hydrate-key="${key}"][data-hydrate-props]`);
    return element ? parseJson(element.getAttribute("data-hydrate-props")) : null;
  }

  function woltersAuthors(document) {
    const props = hydrateProps(document, "contributors-section");
    return (props && Array.isArray(props.authors) ? props.authors : []).map((author) => {
      const name = author && author.content && author.content.name;
      const first = name && name.firstName && (name.firstName.plainText || name.firstName.value);
      const last = name && name.lastName && (name.lastName.plainText || name.lastName.value);
      return core.normalizeInlineWhitespace([first, last].filter(Boolean).join(" "));
    }).filter(Boolean);
  }

  function woltersAffiliations(document) {
    const props = hydrateProps(document, "contributors-section");
    return (props && Array.isArray(props.affiliationList) ? props.affiliationList : [])
      .map((affiliation) => {
        const parts = Array.isArray(affiliation.fullText) ? affiliation.fullText : [];
        return core.normalizeInlineWhitespace(parts.filter((part) => typeof part === "string").join(" "));
      })
      .filter(Boolean);
  }

  const woltersProfile = {
    publisher: "Wolters Kluwer Health",
    sourcePlatform: "Ovid / Lippincott Williams & Wilkins",
    titleSelectors: ["#omni-article-title", "h1"],
    abstractSelectors: [".lww-article__abstract", "section[aria-labelledby*='abstract']"],
    bodySelectors: ["article.lww-article .lww-article__body"],
    referenceContainerSelectors: ["section.lww-article__references"],
    referenceEntrySelector: "li[id^='R']",
    referenceContentSelector: ".lww-article__reference-text, .lww-article__reference-content",
    referenceNoiseSelectors: ".lww-article__reference-links",
    citationTokens: (element) => {
      const props = parseJson(element.getAttribute("data-hydrate-props") || "");
      const fromProps = props && props.content && props.content.refId;
      const fromClass = (element.className || "").match(/js-cite-([A-Za-z0-9_-]+)/);
      return [fromProps || (fromClass && fromClass[1]) || ""];
    },
    isCitation: (element) => element.matches('[data-hydrate-key="citation"], .lww-article__citation'),
    noiseSelectors: "section.lww-article__references, .lww-article__reference-links, .related-articles",
    extractAuthors: woltersAuthors,
    extractAffiliations: woltersAffiliations,
    extractJournal: (document) => textFromFirst(document, [".lww-article__citation-info-title"]),
    extractPublicationDate: (document) => {
      const text = textFromFirst(document, [".lww-article__citation-info"]);
      const match = text.match(/,\s*([^,|]+\d{4})\.?\s*\|/);
      return match ? core.normalizeInlineWhitespace(match[1]) : "";
    },
  };

  PaperMd.mdpi = mdpi;
  PaperMd.taylorfrancis = taylorfrancis;
  PaperMd.frontiers = frontiersBase;
  PaperMd.oup = oup;
  PaperMd.mitpress = mitpress;
  PaperMd.ieee = { extract: extractIeee, extractMetadata: ieeeMetadata, prepare: prepareIeee };
  PaperMd.wolterskluwer = makeExtractor(woltersProfile);
  PaperMd.sage = sage;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      mdpi: PaperMd.mdpi,
      taylorfrancis: PaperMd.taylorfrancis,
      frontiers: PaperMd.frontiers,
      oup: PaperMd.oup,
      mitpress: PaperMd.mitpress,
      ieee: PaperMd.ieee,
      wolterskluwer: PaperMd.wolterskluwer,
      sage: PaperMd.sage,
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
