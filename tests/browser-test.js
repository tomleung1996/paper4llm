(async function runBrowserTests() {
  "use strict";

  const summary = document.querySelector("#summary");
  const assertionsList = document.querySelector("#assertions");
  const output = document.querySelector("#output");
  const assertions = [];

  function assert(name, condition) {
    assertions.push({ name, pass: Boolean(condition) });
  }

  try {
    const fixtureHtml = await fetch("fixtures/sciencedirect-sample.html").then((response) => response.text());
    const fixtureDocument = new DOMParser().parseFromString(fixtureHtml, "text/html");
    const result = globalThis.PaperMd.sciencedirect.extract(fixtureDocument, {
      includeFrontMatter: true,
      includeImages: true,
      locale: "zh-CN",
    });

    assert("extracts the title", result.metadata.title === "A representative ScienceDirect paper");
    assert("extracts all references", result.diagnostics.references === 3);
    assert("maps all bibliography targets", result.diagnostics.resolvedCitationLinks === 8);
    assert("maps the footnote target", result.diagnostics.resolvedFootnoteLinks === 2);
    assert("has no unresolved citations", result.diagnostics.unresolvedCitations.length === 0);
    assert("links citation 1 to reference 1", result.markdown.includes("(#ref-1)"));
    assert("links citations to references 2 and 3", result.markdown.includes("(#ref-2)") && result.markdown.includes("(#ref-3)"));
    assert("links the inline footnote", result.markdown.includes("(#footnote-1)"));
    assert("preserves DOI links", result.markdown.includes("https://doi.org/10.1000/example.1"));
    assert("does not include Google Scholar UI links", !result.markdown.includes("scholar.google.com"));
    assert("keeps citations inside block quotes", result.markdown.includes("> A quotation citing [Example, 2022](#ref-1)."));
    assert(
      "keeps legacy paraNNNN paragraphs inline",
      result.markdown.includes(
        "Diversity remains one paragraph ([Example, 2022](#ref-1)). [1](#footnote-1) **Variety** continues inline after the citation and footnote.",
      ),
    );
    assert(
      "keeps citations inline before a nested hypothesis list",
      result.markdown.includes(
        "Size matters and prior work supports this claim ([Example, 2022](#ref-1); [Example, 2023](#ref-2)). Thus, we hypothesize that:\n\n- H2 *Larger collaborations produce more diverse work*.",
      ),
    );
    assert("renders a Markdown table", result.markdown.includes("| | Score |"));
    assert("renders inline math", result.markdown.includes("$E=mc^2$"));
    assert("extracts highlights separately", result.markdown.includes("## Highlights"));
    assert("omits related-content noise", !result.markdown.includes("Recommended articles"));

    const mixedAuthorFixtureHtml = await fetch("fixtures/sciencedirect-mixed-authors.html").then(
      (response) => response.text(),
    );
    const mixedAuthorDocument = new DOMParser().parseFromString(mixedAuthorFixtureHtml, "text/html");
    const mixedAuthorResult = globalThis.PaperMd.sciencedirect.extract(mixedAuthorDocument, {
      includeFrontMatter: true,
      includeImages: false,
      locale: "zh-CN",
    });
    assert(
      "ScienceDirect: extracts authors rendered as mixed buttons and links",
      mixedAuthorResult.metadata.authors.join("|") ===
        "Zhentao Liang|Nees Jan van Eck|Xuehua Wu|Jin Mao|Gang Li",
    );
    assert(
      "ScienceDirect: ignores icon-only author controls",
      mixedAuthorResult.metadata.authors.length === 5,
    );

    const wileyFixtureHtml = await fetch("fixtures/wiley-sample.html").then((response) => response.text());
    const wileyDocument = new DOMParser().parseFromString(wileyFixtureHtml, "text/html");
    const wileyResult = globalThis.PaperMd.wiley.extract(wileyDocument, {
      includeFrontMatter: true,
      includeImages: true,
      locale: "zh-CN",
    });

    assert("Wiley: extracts the title", wileyResult.metadata.title === "A representative Wiley paper");
    assert("Wiley: extracts all references", wileyResult.diagnostics.references === 3);
    assert("Wiley: maps all bibliography targets", wileyResult.diagnostics.resolvedCitationLinks === 5);
    assert("Wiley: maps the footnote target", wileyResult.diagnostics.resolvedFootnoteLinks === 1);
    assert("Wiley: has no unresolved citations", wileyResult.diagnostics.unresolvedCitations.length === 0);
    assert("Wiley: links body citations", wileyResult.markdown.includes("[2025](#ref-2)") && wileyResult.markdown.includes("[2026](#ref-3)"));
    assert(
      "Wiley: links grouped numeric citations",
      wileyResult.markdown.includes(
        "Numeric evidence is also reported &#91;[1](#ref-1), [2](#ref-2)&#93;.",
      ),
    );
    assert("Wiley: does not turn citation brackets into Typora math", !wileyResult.markdown.includes("\\[[1](#ref-1)"));
    assert("Wiley: links the inline footnote", wileyResult.markdown.includes("(#footnote-1)"));
    assert("Wiley: preserves a hidden DOI", wileyResult.markdown.includes("https://doi.org/10.1002/example.2"));
    assert("Wiley: omits reference UI links", !wileyResult.markdown.includes("Google Scholar"));
    assert("Wiley: omits figure controls", !wileyResult.markdown.includes("Open in figure viewer") && !wileyResult.markdown.includes("PowerPoint"));
    assert("Wiley: renders tables", wileyResult.markdown.includes("| Method | Score |"));
    assert("Wiley: renders inline and display math", wileyResult.markdown.includes("$x$") && wileyResult.markdown.includes("$$\nx=y\n$$"));
    assert("Wiley: declares the source platform", wileyResult.markdown.includes('source_platform: "Wiley Online Library"'));

    const springerFixtureHtml = await fetch("fixtures/springernature-sample.html").then((response) => response.text());
    const springerDocument = new DOMParser().parseFromString(springerFixtureHtml, "text/html");
    const springerResult = globalThis.PaperMd.springernature.extract(springerDocument, {
      includeFrontMatter: true,
      includeImages: true,
      locale: "zh-CN",
    });

    assert("Springer Nature: extracts the title", springerResult.metadata.title === "A representative Springer Nature paper");
    assert("Springer Nature: extracts all references", springerResult.diagnostics.references === 3);
    assert("Springer Nature: maps all bibliography targets", springerResult.diagnostics.resolvedCitationLinks === 3);
    assert("Springer Nature: maps the footnote target", springerResult.diagnostics.resolvedFootnoteLinks === 1);
    assert("Springer Nature: has no unresolved citations", springerResult.diagnostics.unresolvedCitations.length === 0);
    assert("Springer Nature: links author-year citations", springerResult.markdown.includes("[2025](#ref-2)"));
    assert(
      "Springer Nature: keeps grouped superscript citations clickable",
      springerResult.markdown.includes("[1](#ref-1),[3](#ref-3)") &&
        !springerResult.markdown.includes("<sup>[1](#ref-1)"),
    );
    assert(
      "Springer Nature: removes visually hidden footnote prose",
      springerResult.markdown.includes("[1](#footnote-1)") && !springerResult.markdown.includes("Footnote 1"),
    );
    assert("Springer Nature: supplements DOI links", springerResult.markdown.includes("https://doi.org/10.1000/springer.2"));
    assert("Springer Nature: omits reference UI links", !springerResult.markdown.includes("Google Scholar"));
    assert(
      "Springer Nature: preserves figure image and description",
      springerResult.markdown.includes("https://media.springernature.com/example-fig1.png") &&
        springerResult.markdown.includes("A complete figure description."),
    );
    assert(
      "Springer Nature: preserves remote table links",
      springerResult.markdown.includes("https://link.springer.com/article/10.1007/example-2026-1/tables/1"),
    );
    assert(
      "Springer Nature: renders inline and display math",
      springerResult.markdown.includes("$x$") && springerResult.markdown.includes("$$\nx=y\n$$"),
    );
    assert("Springer Nature: omits recommendations", !springerResult.markdown.includes("Recommended article"));
    assert("Springer Nature: declares the source platform", springerResult.markdown.includes('source_platform: "Springer Nature Link"'));

    const scienceFixtureHtml = await fetch("fixtures/science-sample.html").then((response) => response.text());
    const scienceDocument = new DOMParser().parseFromString(scienceFixtureHtml, "text/html");
    const scienceResult = globalThis.PaperMd.science.extract(scienceDocument, {
      includeFrontMatter: true,
      includeImages: true,
      locale: "zh-CN",
    });

    assert("Science: extracts the title", scienceResult.metadata.title === "A representative Science paper");
    assert("Science: extracts all references", scienceResult.diagnostics.references === 3);
    assert("Science: maps all bibliography targets", scienceResult.diagnostics.resolvedCitationLinks === 3);
    assert("Science: maps the footnote target", scienceResult.diagnostics.resolvedFootnoteLinks === 1);
    assert("Science: has no unresolved citations", scienceResult.diagnostics.unresolvedCitations.length === 0);
    assert(
      "Science: preserves citation punctuation and ranges in one paragraph",
      scienceResult.markdown.includes(
        "Evidence ([1](#ref-1), [2](#ref-2)–[3](#ref-3)) remains one paragraph with clickable references.",
      ),
    );
    assert("Science: does not italicize citation labels", !scienceResult.markdown.includes("[*1*](#ref-1)"));
    assert(
      "Science: converts inline and display MathML",
      scienceResult.markdown.includes("$x_{i}^{2}$") &&
        scienceResult.markdown.includes("$$\n\\frac{a}{b}\n$$"),
    );
    assert(
      "Science: resolves relative image URLs",
      scienceResult.markdown.includes(
        "https://www.science.org/cms/10.1126/sciadv.example1/asset/example-f1.jpg",
      ),
    );
    assert(
      "Science: keeps nested figure-caption inline text on one line",
      scienceResult.markdown.includes(
        "Fig. 1. A Science figure caption. (**A** and **B**) Phenotypic analysis with *n* = 50.",
      ) &&
        !scienceResult.markdown.includes("Fig. 1\\n\\n. A Science") &&
        !scienceResult.markdown.includes("(\\n\\n**A**"),
    );
    assert("Science: supplements Crossref DOI links", scienceResult.markdown.includes("https://doi.org/10.1000/science.1"));
    assert("Science: omits Google Scholar UI links", !scienceResult.markdown.includes("Google Scholar"));
    assert("Science: omits related-content noise", !scienceResult.markdown.includes("Recommended stories"));
    assert("Science: declares the source platform", scienceResult.markdown.includes('source_platform: "Science / AAAS"'));
    assert(
      "Science: warns that external image hotlinks may require a browser session",
      scienceResult.diagnostics.warnings.some((warning) => warning.includes("人机验证会话")),
    );

    const paywalledScienceDocument = new DOMParser().parseFromString(
      `<!doctype html><html><head>
        <meta name="dc.Title" content="A paywalled Science paper" />
        <link rel="canonical" href="https://www.science.org/doi/10.1126/science.paywall" />
      </head><body><main id="main" data-doi="10.1126/science.paywall"><article typeof="ScholarlyArticle">
        <div id="abstracts"><section id="abstract" role="doc-abstract"><h2>Abstract</h2><div role="paragraph">This abstract remains available even though the representative Science body is behind an access-control page.</div></section></div>
        <section id="bodymatter" data-extent="bodymatter" property="articleBody"><div class="core-container"><section class="denial-block">Access the full article through a subscription.</section></div></section>
        <section id="backmatter"><section id="bibliography" role="doc-bibliography"><div class="bibliolist"><div class="biblioentry" data-has="label"><div class="label">1</div><div class="citations" id="R1"><div class="citation-content">A visible reference.</div></div></div></div></section></section>
      </article></main></body></html>`,
      "text/html",
    );
    const paywalledScienceResult = globalThis.PaperMd.science.extract(paywalledScienceDocument, {
      includeFrontMatter: false,
      includeImages: false,
      locale: "zh-CN",
    });
    assert(
      "Science: reports an abstract-only or paywalled page",
      paywalledScienceResult.diagnostics.warnings.some((warning) => warning.includes("未提供完整正文")),
    );
    const englishPaywalledScienceResult = globalThis.PaperMd.science.extract(paywalledScienceDocument, {
      includeFrontMatter: false,
      includeImages: false,
      locale: "en",
    });
    assert(
      "Science: localizes diagnostic warnings in English",
      englishPaywalledScienceResult.diagnostics.warnings.some((warning) =>
        warning.includes("does not provide the complete article body"),
      ) &&
        englishPaywalledScienceResult.diagnostics.warningDetails.some(
          (warning) => warning.key === "sciencePartialBody",
        ),
    );
    assert("Science: omits access-control boilerplate", !paywalledScienceResult.markdown.includes("Access the full article"));

    const publisherFixturesHtml = await fetch("fixtures/publisher-platforms.html").then(
      (response) => response.text(),
    );
    const publisherFixturesDocument = new DOMParser().parseFromString(
      publisherFixturesHtml,
      "text/html",
    );
    const extractFixture = (templateId, extractor, options = {}) => {
      const source = publisherFixturesDocument.querySelector(`#${templateId}`).innerHTML.trim();
      const fixture = new DOMParser().parseFromString(source, "text/html");
      return extractor.extract(fixture, {
        includeFrontMatter: true,
        includeImages: true,
        locale: "en",
        ...options,
      });
    };

    const mdpiResult = extractFixture("mdpi-fixture", globalThis.PaperMd.mdpi);
    assert("MDPI: extracts metadata", mdpiResult.metadata.journal === "Sensors" && mdpiResult.metadata.doi === "10.3390/example1");
    assert("MDPI: maps bibliography targets", mdpiResult.markdown.includes("[&#91;1&#93;](#ref-1)") && mdpiResult.diagnostics.unresolvedCitations.length === 0);
    assert("MDPI: keeps image URLs", mdpiResult.markdown.includes("https://www.mdpi.com/image/example.png"));

    const taylorFrancisResult = extractFixture(
      "taylorfrancis-fixture",
      globalThis.PaperMd.taylorfrancis,
    );
    assert("Taylor & Francis: extracts metadata", taylorFrancisResult.metadata.journal === "Cogent Social Sciences");
    assert("Taylor & Francis: maps data-rid citations", taylorFrancisResult.markdown.includes("[Author, 2025](#ref-1)"));
    assert("Taylor & Francis: omits reference controls", !taylorFrancisResult.markdown.includes("Google Scholar"));

    const frontiersResult = extractFixture("frontiers-fixture", globalThis.PaperMd.frontiers);
    assert("Frontiers: extracts metadata", frontiersResult.metadata.journal === "Frontiers in Psychology");
    assert("Frontiers: maps button citations", frontiersResult.markdown.includes("[Author, 2025](#ref-1)"));
    assert("Frontiers: omits reference controls", !frontiersResult.markdown.includes("Google Scholar"));

    const oupResult = extractFixture("oup-fixture", globalThis.PaperMd.oup);
    assert("Oxford: extracts metadata", oupResult.metadata.journal === "Nucleic Acids Research");
    assert("Oxford: maps reveal-id citations", oupResult.markdown.includes("[Author, 2025](#ref-1)"));

    const ieeeResult = extractFixture("ieee-fixture", globalThis.PaperMd.ieee);
    assert("IEEE: extracts visible metadata", ieeeResult.metadata.journal === "IEEE Access" && ieeeResult.metadata.doi === "10.1109/ACCESS.2026.1");
    assert("IEEE: extracts all displayed authors", ieeeResult.metadata.authors.join("|") === "IEEE Author One|IEEE Author Two");
    assert("IEEE: maps anchor citations", ieeeResult.markdown.includes("[&#91;1&#93;](#ref-1)"));
    assert("IEEE: omits reference controls", !ieeeResult.markdown.includes("Google Scholar"));

    const woltersResult = extractFixture("wolters-fixture", globalThis.PaperMd.wolterskluwer);
    assert("Wolters Kluwer: extracts hydrated authors", woltersResult.metadata.authors.join("|") === "Wolters Author");
    assert("Wolters Kluwer: extracts journal metadata", woltersResult.metadata.journal === "Medicine" && woltersResult.metadata.doi === "10.1097/example.1");
    assert("Wolters Kluwer: maps hydrated citations", woltersResult.markdown.includes("[1](#ref-1)"));
    assert("Wolters Kluwer: omits reference controls", !woltersResult.markdown.includes("Cited Here"));

    const sageResult = extractFixture("sage-fixture", globalThis.PaperMd.sage);
    assert("SAGE: extracts schema.org metadata", sageResult.metadata.journal === "SAGE Open" && sageResult.metadata.authors[0] === "SAGE Author");
    assert("SAGE: maps domestic-platform bibr citations", sageResult.markdown.includes("[1](#ref-1)"));

    const delayedWileyDocument = new DOMParser().parseFromString(
      `<!doctype html>
      <html lang="en">
        <head>
          <meta name="citation_title" content="Delayed Wiley references" />
          <link rel="canonical" href="https://onlinelibrary.wiley.com/doi/10.1111/example.1" />
        </head>
        <body>
          <article>
            <section class="article-section__full">
              <h2>1 INTRODUCTION</h2>
              <p>This deliberately long paragraph represents article content that has already loaded while its reference section is still arriving asynchronously. Delayed evidence [<span><a href="#example-bib-0001" class="bibLink tab-link">1</a></span>].</p>
            </section>
          </article>
        </body>
      </html>`,
      "text/html",
    );
    const delayedPreparation = globalThis.PaperMd.wiley.prepare(delayedWileyDocument, 1000);
    setTimeout(() => {
      delayedWileyDocument.body.insertAdjacentHTML(
        "beforeend",
        `<section class="article-section article-section__references" id="article-references-section-1">
          <div class="accordion__content"><ul class="rlist"><li data-bib-id="example-bib-0001">
            Example, A. (2026). A delayed reference.
          </li></ul></div>
        </section>`,
      );
    }, 20);
    await delayedPreparation;
    const delayedWileyResult = globalThis.PaperMd.wiley.extract(delayedWileyDocument, {
      includeFrontMatter: false,
      includeImages: false,
      locale: "zh-CN",
    });
    assert("Wiley: waits for a delayed reference container", delayedWileyResult.diagnostics.references === 1);
    assert("Wiley: resolves citations after delayed loading", delayedWileyResult.markdown.includes("[1](#ref-1)"));

    output.textContent = `${result.markdown}\n\n${wileyResult.markdown}\n\n${springerResult.markdown}\n\n${scienceResult.markdown}\n\n${paywalledScienceResult.markdown}\n\n${delayedWileyResult.markdown}\n\n${mdpiResult.markdown}\n\n${taylorFrancisResult.markdown}\n\n${frontiersResult.markdown}\n\n${oupResult.markdown}\n\n${ieeeResult.markdown}\n\n${woltersResult.markdown}\n\n${sageResult.markdown}`;
  } catch (error) {
    assertions.push({ name: error.stack || error.message, pass: false });
  }

  assertionsList.replaceChildren(
    ...assertions.map(({ name, pass }) => {
      const item = document.createElement("li");
      item.className = pass ? "pass" : "fail";
      item.textContent = `${pass ? "PASS" : "FAIL"}: ${name}`;
      return item;
    }),
  );

  const failed = assertions.filter((assertion) => !assertion.pass).length;
  summary.className = failed ? "fail" : "pass";
  summary.textContent = failed
    ? `${failed} of ${assertions.length} assertions failed.`
    : `All ${assertions.length} assertions passed.`;
  document.documentElement.dataset.testStatus = failed ? "failed" : "passed";
})();
