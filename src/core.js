(function initPaperMarkdownCore(root) {
  "use strict";

  const PaperMd = root.PaperMd || (root.PaperMd = {});

  const BLOCK_TAGS = new Set([
    "ARTICLE",
    "ASIDE",
    "BLOCKQUOTE",
    "DIV",
    "DL",
    "FIGURE",
    "FOOTER",
    "FORM",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HEADER",
    "HR",
    "LI",
    "MAIN",
    "NAV",
    "OL",
    "P",
    "PRE",
    "SECTION",
    "TABLE",
    "UL",
  ]);

  const SKIP_TAGS = new Set([
    "BUTTON",
    "CANVAS",
    "FORM",
    "IFRAME",
    "INPUT",
    "NOSCRIPT",
    "SCRIPT",
    "SELECT",
    "STYLE",
    "TEMPLATE",
    "TEXTAREA",
  ]);

  const NOISE_RE = /(?:^|[-_\s])(advert|banner|breadcrumb|cookie|download|footer|header-actions|menu|metrics|navigation|recommend|related|screen-reader(?:-only)?|share|social|toolbar|visually-hidden)(?:$|[-_\s])/i;

  const DIRECT_BLOCK_TAGS = new Set([
    "BLOCKQUOTE",
    "DIV",
    "DL",
    "FIGURE",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HR",
    "OL",
    "P",
    "PRE",
    "SECTION",
    "TABLE",
    "UL",
  ]);

  function normalizeWhitespace(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeInlineWhitespace(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeMarkdown(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/([`*_{}<>])/g, "\\$1")
      // Typora interprets \[ and \] as display-math delimiters. HTML
      // entities preserve literal brackets without turning citation targets
      // such as #ref-1 into invalid TeX macro parameters.
      .replace(/\[/g, "&#91;")
      .replace(/\]/g, "&#93;");
  }

  function escapeTableCell(value) {
    return normalizeInlineWhitespace(value)
      .replace(/\|/g, "\\|")
      .replace(/\n/g, "<br>");
  }

  function yamlString(value) {
    return JSON.stringify(String(value == null ? "" : value));
  }

  function sanitizeFileName(value) {
    const safe = normalizeInlineWhitespace(value)
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\.+$/g, "")
      .slice(0, 120)
      .trim();
    return safe || "paper";
  }

  function normalizeDoi(value) {
    let source = String(value || "");
    try {
      source = decodeURIComponent(source);
    } catch (_error) {
      // Keep malformed URLs unchanged and attempt extraction from the raw value.
    }
    const match = source.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
    return match ? match[0].replace(/[.,;:)>\]}]+$/g, "") : "";
  }

  function absoluteUrl(value, baseUrl) {
    const raw = String(value || "").trim();
    if (!raw || /^(?:javascript|data):/i.test(raw)) return "";
    try {
      return new URL(raw, baseUrl || undefined).href;
    } catch (_error) {
      return raw;
    }
  }

  function normalizeTargetId(value) {
    let target = String(value || "").trim();
    const hashIndex = target.lastIndexOf("#");
    if (hashIndex >= 0) target = target.slice(hashIndex + 1);
    try {
      target = decodeURIComponent(target);
    } catch (_error) {
      // Keep the original fragment when it is not valid percent-encoding.
    }
    return target.replace(/^#/, "").trim().toLowerCase();
  }

  function parseCitationNumbers(value) {
    const cleaned = String(value || "")
      .replace(/[\[\](){}]/g, " ")
      .replace(/[–—−]/g, "-");
    const result = [];
    const tokenRe = /(\d+)\s*-\s*(\d+)|(\d+)/g;
    let match;
    while ((match = tokenRe.exec(cleaned))) {
      if (match[1] && match[2]) {
        const start = Number(match[1]);
        const end = Number(match[2]);
        if (end >= start && end - start <= 100) {
          for (let number = start; number <= end; number += 1) {
            result.push(String(number));
          }
        }
      } else if (match[3]) {
        result.push(String(Number(match[3])));
      }
    }
    return Array.from(new Set(result));
  }

  function elementSignature(element) {
    if (!element || element.nodeType !== 1) return "";
    return [
      element.getAttribute("class") || "",
      element.getAttribute("id") || "",
      element.getAttribute("role") || "",
      element.getAttribute("data-testid") || "",
      element.getAttribute("aria-label") || "",
    ].join(" ");
  }

  function isHidden(element) {
    if (!element || element.nodeType !== 1) return false;
    return (
      element.hasAttribute("hidden") ||
      element.getAttribute("aria-hidden") === "true" ||
      element.getAttribute("role") === "presentation"
    );
  }

  function isNoiseElement(element) {
    if (!element || element.nodeType !== 1) return false;
    if (SKIP_TAGS.has(element.tagName)) return true;
    if (element.tagName === "NAV" || element.tagName === "FOOTER") return true;
    if (isHidden(element)) return true;
    return NOISE_RE.test(elementSignature(element));
  }

  function queryFirst(documentOrElement, selectors, predicate) {
    for (const selector of selectors) {
      let matches = [];
      try {
        matches = Array.from(documentOrElement.querySelectorAll(selector));
      } catch (_error) {
        continue;
      }
      for (const match of matches) {
        if (!predicate || predicate(match)) return match;
      }
    }
    return null;
  }

  function metaContents(document, names) {
    const lowered = names.map((name) => name.toLowerCase());
    return Array.from(document.querySelectorAll("meta"))
      .filter((meta) => {
        const key = (meta.getAttribute("name") || meta.getAttribute("property") || "").toLowerCase();
        return lowered.includes(key);
      })
      .map((meta) => normalizeInlineWhitespace(meta.getAttribute("content")))
      .filter(Boolean);
  }

  function firstMeta(document, names) {
    return metaContents(document, names)[0] || "";
  }

  function unique(values) {
    const seen = new Set();
    return values.filter((value) => {
      const key = normalizeInlineWhitespace(value).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const GREEK_LATEX = {
    "Α": "A", "Β": "B", "Γ": "\\Gamma", "Δ": "\\Delta", "Ε": "E", "Ζ": "Z",
    "Η": "H", "Θ": "\\Theta", "Ι": "I", "Κ": "K", "Λ": "\\Lambda", "Μ": "M",
    "Ν": "N", "Ξ": "\\Xi", "Ο": "O", "Π": "\\Pi", "Ρ": "P", "Σ": "\\Sigma",
    "Τ": "T", "Υ": "\\Upsilon", "Φ": "\\Phi", "Χ": "X", "Ψ": "\\Psi", "Ω": "\\Omega",
    "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta", "ε": "\\epsilon",
    "ϵ": "\\varepsilon", "ζ": "\\zeta", "η": "\\eta", "θ": "\\theta", "ϑ": "\\vartheta",
    "ι": "\\iota", "κ": "\\kappa", "λ": "\\lambda", "μ": "\\mu", "ν": "\\nu",
    "ξ": "\\xi", "ο": "o", "π": "\\pi", "ϖ": "\\varpi", "ρ": "\\rho",
    "ϱ": "\\varrho", "σ": "\\sigma", "ς": "\\varsigma", "τ": "\\tau", "υ": "\\upsilon",
    "φ": "\\phi", "ϕ": "\\varphi", "χ": "\\chi", "ψ": "\\psi", "ω": "\\omega",
  };

  const OPERATOR_LATEX = {
    "−": " - ", "–": " - ", "—": " - ", "×": " \\times ", "·": " \\cdot ",
    "÷": " \\div ", "±": " \\pm ", "∓": " \\mp ", "≤": " \\le ", "≥": " \\ge ",
    "≠": " \\ne ", "≈": " \\approx ", "≃": " \\simeq ", "≡": " \\equiv ",
    "∞": "\\infty", "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∂": "\\partial",
    "√": "\\sqrt{}", "∈": " \\in ", "∉": " \\notin ", "⊂": " \\subset ",
    "⊆": " \\subseteq ", "∪": " \\cup ", "∩": " \\cap ", "→": " \\to ",
    "←": " \\leftarrow ", "↔": " \\leftrightarrow ", "⇒": " \\Rightarrow ",
    "⇔": " \\Leftrightarrow ", "∧": " \\land ", "∨": " \\lor ", "¬": "\\neg ",
    "∇": "\\nabla", "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}",
    "ℚ": "\\mathbb{Q}", "ℂ": "\\mathbb{C}", "⁢": "", "⁣": ",", "⁡": "",
  };

  function escapeLatexText(value) {
    return String(value || "")
      .replace(/\\/g, "\\textbackslash{}")
      .replace(/([#$%&_{}])/g, "\\$1")
      .replace(/\^/g, "\\textasciicircum{}")
      .replace(/~/g, "\\textasciitilde{}");
  }

  function mathmlToLatex(node) {
    if (!node) return "";
    if (node.nodeType === 3) return normalizeInlineWhitespace(node.nodeValue);
    if (node.nodeType !== 1) return "";

    const element = node;
    const tag = String(element.localName || element.tagName || "").toLowerCase();
    const elementChildren = Array.from(element.children || []);
    const renderChildren = (separator) =>
      elementChildren.map((child) => mathmlToLatex(child)).filter(Boolean).join(separator || "");
    const childLatex = (index) => mathmlToLatex(elementChildren[index]);

    if (tag === "annotation") return "";
    if (tag === "semantics") {
      const primary = elementChildren.find((child) =>
        !["annotation", "annotation-xml"].includes(String(child.localName || "").toLowerCase()),
      );
      return mathmlToLatex(primary);
    }
    if (["math", "mrow", "mstyle", "mpadded", "merror", "maction"].includes(tag)) {
      return renderChildren("");
    }
    if (tag === "mi") {
      const value = normalizeInlineWhitespace(element.textContent);
      if (GREEK_LATEX[value]) return GREEK_LATEX[value];
      if (value.length > 1 && element.getAttribute("mathvariant") === "normal") {
        return `\\mathrm{${escapeLatexText(value)}}`;
      }
      return escapeLatexText(value);
    }
    if (tag === "mn") return normalizeInlineWhitespace(element.textContent);
    if (tag === "mtext") return `\\text{${escapeLatexText(normalizeInlineWhitespace(element.textContent))}}`;
    if (tag === "mo") {
      const value = normalizeInlineWhitespace(element.textContent);
      return OPERATOR_LATEX[value] || value;
    }
    if (tag === "msup") return `${childLatex(0)}^{${childLatex(1)}}`;
    if (tag === "msub") return `${childLatex(0)}_{${childLatex(1)}}`;
    if (tag === "msubsup") return `${childLatex(0)}_{${childLatex(1)}}^{${childLatex(2)}}`;
    if (tag === "mfrac") return `\\frac{${childLatex(0)}}{${childLatex(1)}}`;
    if (tag === "msqrt") return `\\sqrt{${renderChildren("")}}`;
    if (tag === "mroot") return `\\sqrt[${childLatex(1)}]{${childLatex(0)}}`;
    if (tag === "mover") return `\\overset{${childLatex(1)}}{${childLatex(0)}}`;
    if (tag === "munder") return `\\underset{${childLatex(1)}}{${childLatex(0)}}`;
    if (tag === "munderover") {
      return `\\overset{${childLatex(2)}}{\\underset{${childLatex(1)}}{${childLatex(0)}}}`;
    }
    if (tag === "mfenced") {
      const open = element.getAttribute("open") || "(";
      const close = element.getAttribute("close") || ")";
      const separators = element.getAttribute("separators") || ",";
      const values = elementChildren.map((child) => mathmlToLatex(child)).filter(Boolean);
      const joined = values.map((value, index) => {
        if (!index) return value;
        const separator = separators[Math.min(index - 1, separators.length - 1)] || ",";
        return `${separator} ${value}`;
      }).join("");
      return `${open}${joined}${close}`;
    }
    if (tag === "mtable") {
      return `\\begin{matrix}${renderChildren(" \\\\ ")}\\end{matrix}`;
    }
    if (tag === "mtr" || tag === "mlabeledtr") return renderChildren(" & ");
    if (tag === "mtd") return renderChildren("");
    if (tag === "mspace") return "\\;";
    if (["none", "mprescripts", "mphantom"].includes(tag)) return "";

    const rendered = renderChildren("");
    return rendered || escapeLatexText(normalizeInlineWhitespace(element.textContent));
  }

  function isUsableLatexCandidate(value) {
    const normalized = normalizeInlineWhitespace(value);
    return Boolean(
      normalized &&
      !/^(?:equation|formula|math|no alternative text(?: is)? available)$/i.test(normalized),
    );
  }

  function extractLatex(element) {
    if (!element || element.nodeType !== 1) return "";
    const direct = [
      element.getAttribute("alttext"),
      element.getAttribute("data-latex"),
      element.getAttribute("data-tex"),
      element.getAttribute("aria-label"),
    ].find(isUsableLatexCandidate);
    if (direct) return normalizeInlineWhitespace(direct);

    const annotation = element.querySelector(
      'annotation[encoding="application/x-tex"], annotation[encoding="application/tex"]',
    );
    if (annotation) return normalizeInlineWhitespace(annotation.textContent);

    const texSource = element.matches(
      '.mathjax-tex, .math-tex, .tex-math, script[type^="math/tex"]',
    )
      ? element
      : element.querySelector(
          '.mathjax-tex, .math-tex, .tex-math, script[type^="math/tex"]',
        );
    if (texSource) return normalizeInlineWhitespace(texSource.textContent);

    const mathNode = String(element.tagName || "").toUpperCase() === "MATH"
      ? element
      : element.querySelector("math");
    if (mathNode) return normalizeInlineWhitespace(mathmlToLatex(mathNode));

    const altImage = element.querySelector("img[alt]");
    if (altImage && isUsableLatexCandidate(altImage.getAttribute("alt"))) {
      return normalizeInlineWhitespace(altImage.getAttribute("alt"));
    }
    return "";
  }

  function normalizeLatexSource(value) {
    let source = String(value || "").trim();
    if (source.startsWith("$$") && source.endsWith("$$") && source.length >= 4) {
      source = source.slice(2, -2);
    } else if (source.startsWith("$") && source.endsWith("$") && source.length >= 2) {
      source = source.slice(1, -1);
    } else if (source.startsWith("\\(") && source.endsWith("\\)")) {
      source = source.slice(2, -2);
    } else if (source.startsWith("\\[") && source.endsWith("\\]")) {
      source = source.slice(2, -2);
    }
    return source.trim();
  }

  function isMathElement(element) {
    if (!element || element.nodeType !== 1) return false;
    if (String(element.tagName || "").toUpperCase() === "MATH") return true;
    const signature = elementSignature(element);
    return /(?:^|[-_\s])(equation|formula|math|mathjax|tex)(?:$|[-_\s])/i.test(signature);
  }

  function childNodesArray(node) {
    return node && node.childNodes ? Array.from(node.childNodes) : [];
  }

  function renderInlineChildren(node, context) {
    return childNodesArray(node)
      .map((child) => renderInline(child, context))
      .join("");
  }

  function renderCitation(element, context) {
    if (!context || typeof context.resolveCitation !== "function") return null;
    const resolution = context.resolveCitation(element);
    if (!resolution || !resolution.isCitation) return null;

    const sourceText = normalizeInlineWhitespace(element.textContent || renderPlainText(element)) || "citation";
    const visibleSourceText = normalizeInlineWhitespace(renderPlainText(element)) || sourceText;
    if (!resolution.targets.length) {
      if (context.diagnostics) {
        context.diagnostics.unresolvedCitations.push({
          text: sourceText,
          target: resolution.rawTarget || "",
        });
      }
      return escapeMarkdown(sourceText);
    }

    if (context.diagnostics) {
      resolution.targets.forEach((target) => {
        if (target.kind === "footnote") {
          context.diagnostics.resolvedFootnoteLinks =
            (context.diagnostics.resolvedFootnoteLinks || 0) + 1;
        } else {
          context.diagnostics.resolvedCitationLinks += 1;
        }
      });
    }

    if (resolution.targets.length === 1) {
      return `[${escapeMarkdown(visibleSourceText)}](#${resolution.targets[0].anchor})`;
    }

    const isBracketed = /^\s*[[(]/.test(visibleSourceText) && /[\])]\s*$/.test(visibleSourceText);
    const links = resolution.targets
      .map((target) => `[${escapeMarkdown(target.label || String(target.index))}](#${target.anchor})`)
      .join(", ");
    return isBracketed ? `[${links}]` : links;
  }

  function renderElementCitation(element, context) {
    return renderCitation(element, context);
  }

  function renderPlainText(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1 || isHidden(node) || SKIP_TAGS.has(node.tagName)) return "";
    if (node.tagName === "NAV" || node.tagName === "FOOTER") return "";
    const className = typeof node.className === "string" ? node.className : "";
    if (/(?:^|\s)(?:u-)?visually-hidden(?:\s|$)|(?:^|\s)sr-only(?:\s|$)/i.test(className)) return "";
    if (node.tagName === "IMG") return node.getAttribute("alt") || "";
    return childNodesArray(node).map(renderPlainText).join("");
  }

  function renderInline(node, context) {
    if (!node) return "";
    if (node.nodeType === 3) return escapeMarkdown(node.nodeValue || "");
    if (node.nodeType !== 1) return "";

    const element = node;
    if (context && context.skipNodes && context.skipNodes.has(element)) return "";
    const citation = renderCitation(element, context);
    if (citation !== null) return citation;
    if (isNoiseElement(element)) return "";

    const tag = element.tagName;
    if (
      element.getAttribute("role") === "math" ||
      element.matches("math, .mathjax-tex, .math-tex, .tex-math")
    ) {
      const latex = normalizeLatexSource(extractLatex(element));
      if (latex) return `$${latex}$`;
    }
    if (isMathElement(element)) {
      const latex = normalizeLatexSource(extractLatex(element));
      if (latex) return `$${latex}$`;
    }

    if (tag === "A") {
      const text = normalizeInlineWhitespace(renderInlineChildren(element, context) || element.textContent);
      const href = absoluteUrl(element.getAttribute("href"), context && context.baseUrl);
      if (!text) return href ? `<${href}>` : "";
      return href ? `[${text}](${href})` : text;
    }
    if (tag === "BR") return "\n";
    if (tag === "CODE") return `\`${normalizeInlineWhitespace(element.textContent).replace(/`/g, "\\`")}\``;
    if (tag === "EM" || tag === "I") return `*${renderInlineChildren(element, context).trim()}*`;
    if (tag === "STRONG" || tag === "B") return `**${renderInlineChildren(element, context).trim()}**`;
    if (tag === "DEL" || tag === "S") return `~~${renderInlineChildren(element, context).trim()}~~`;
    if (tag === "SUB") return `<sub>${normalizeInlineWhitespace(element.textContent)}</sub>`;
    if (tag === "SUP") {
      // Nature/Springer and Science commonly place one or more citation
      // anchors inside <sup>. Markdown links nested in raw HTML are not
      // parsed consistently by Typora/CommonMark renderers, so keep the
      // punctuation and links but flatten citation superscripts.
      const hasCitationAnchor =
        context &&
        typeof context.resolveCitation === "function" &&
        Array.from(element.querySelectorAll("a")).some((anchor) => {
          const resolution = context.resolveCitation(anchor);
          return Boolean(resolution && resolution.isCitation);
        });
      const rendered = renderInlineChildren(element, context).trim();
      return hasCitationAnchor ? rendered : `<sup>${rendered}</sup>`;
    }
    if (tag === "IMG") {
      const alt = normalizeInlineWhitespace(element.getAttribute("alt")) || "image";
      const src = absoluteUrl(
        element.getAttribute("src") ||
        element.getAttribute("data-src") ||
        element.getAttribute("data-original") ||
        element.getAttribute("data-lazy-src"),
        context && context.baseUrl,
      );
      return src && (!context || context.includeImages !== false) ? `![${escapeMarkdown(alt)}](${src})` : escapeMarkdown(alt);
    }
    if (BLOCK_TAGS.has(tag)) return normalizeInlineWhitespace(element.textContent);
    return renderInlineChildren(element, context);
  }

  function renderTable(table, context) {
    const rows = Array.from(table.querySelectorAll("tr"));
    if (!rows.length) return normalizeWhitespace(table.textContent);
    const matrix = rows
      .map((row) =>
        Array.from(row.querySelectorAll(":scope > th, :scope > td")).map((cell) => {
          const rendered = renderInlineChildren(cell, context);
          const value = rendered || (cell.children.length ? "" : cell.textContent);
          return escapeTableCell(value);
        }),
      )
      .filter((row) => row.length);
    if (!matrix.length) return normalizeWhitespace(table.textContent);

    const width = Math.max(...matrix.map((row) => row.length));
    const padded = matrix.map((row) => row.concat(Array(Math.max(0, width - row.length)).fill("")));
    const header = padded[0];
    const body = padded.slice(1);
    return [
      `| ${header.join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`),
    ].join("\n");
  }

  function isParagraphLike(element) {
    if (!element || element.nodeType !== 1 || element.tagName !== "DIV") return false;
    if (hasDirectBlockChild(element)) {
      return false;
    }
    if ((element.getAttribute("role") || "").toLowerCase() === "paragraph") return true;
    // ScienceDirect uses both compact paragraph ids (p0045/np0005) and the
    // older para0025 form. Without treating the latter as one inline block,
    // each citation or emphasis child is rendered as a separate paragraph.
    if (hasPublisherParagraphId(element)) return true;
    const className = typeof element.className === "string" ? element.className : "";
    if (!/(?:^|\s)u-margin-s-bottom(?:\s|$)/.test(className)) return false;
    return true;
  }

  function hasDirectBlockChild(element) {
    return Array.from(element.children).some((child) => DIRECT_BLOCK_TAGS.has(child.tagName));
  }

  function hasPublisherParagraphId(element) {
    return /^(?:p|np|para)\d+$/i.test(element.id || "");
  }

  function isMixedParagraph(element) {
    if (!element || element.nodeType !== 1 || element.tagName !== "DIV") return false;
    const className = typeof element.className === "string" ? element.className : "";
    return (
      /(?:^|\s)paragraph-element(?:\s|$)/.test(className) ||
      ((element.getAttribute("role") || "").toLowerCase() === "paragraph" && hasDirectBlockChild(element)) ||
      (hasPublisherParagraphId(element) && hasDirectBlockChild(element))
    );
  }

  function renderMixedParagraph(element, context) {
    const chunks = [];
    let inline = [];
    const flushInline = () => {
      const rendered = normalizeInlineWhitespace(inline.join(""));
      if (rendered) chunks.push(rendered);
      inline = [];
    };

    childNodesArray(element).forEach((child) => {
      if (
        child.nodeType === 1 &&
        DIRECT_BLOCK_TAGS.has(child.tagName) &&
        !isMathElement(child)
      ) {
        flushInline();
        const rendered = normalizeWhitespace(renderBlock(child, context));
        if (rendered) chunks.push(rendered);
        return;
      }
      if (child.nodeType === 1 && child.tagName === "DIV" && isMathElement(child)) {
        flushInline();
        const rendered = normalizeWhitespace(renderBlock(child, context));
        if (rendered) chunks.push(rendered);
        return;
      }
      inline.push(renderInline(child, context));
    });
    flushInline();
    return chunks.join("\n\n");
  }

  function renderList(list, context, depth) {
    const ordered = list.tagName === "OL";
    const items = Array.from(list.children).filter((child) => child.tagName === "LI");
    return items
      .map((item, index) => {
        const inlineParts = [];
        const nestedLists = [];
        childNodesArray(item).forEach((child) => {
          if (child.nodeType === 1 && (child.tagName === "UL" || child.tagName === "OL")) {
            nestedLists.push(child);
          } else if (
            child.nodeType === 1 &&
            /(?:^|\s)list-label(?:\s|$)/.test(typeof child.className === "string" ? child.className : "")
          ) {
            inlineParts.push(`${renderInline(child, context).trim()} `);
          } else if (
            child.nodeType === 1 &&
            /(?:^|\s)list-content(?:\s|$)/.test(typeof child.className === "string" ? child.className : "")
          ) {
            inlineParts.push(renderBlocks(child, context) || renderInline(child, context));
          } else if (
            child.nodeType === 1 &&
            (child.tagName === "P" || isParagraphLike(child))
          ) {
            inlineParts.push(renderInlineChildren(child, context));
          } else {
            inlineParts.push(renderInline(child, context));
          }
        });
        const marker = ordered ? `${index + 1}.` : "-";
        const indent = "  ".repeat(depth || 0);
        const main = `${indent}${marker} ${normalizeInlineWhitespace(inlineParts.join(""))}`.trimEnd();
        const nested = nestedLists.map((nestedList) => renderList(nestedList, context, (depth || 0) + 1)).join("\n");
        return nested ? `${main}\n${nested}` : main;
      })
      .join("\n");
  }

  function renderFigure(figure, context) {
    const parts = [];
    const images = Array.from(figure.querySelectorAll("img"));
    if (context.includeImages !== false) {
      images.forEach((image) => {
        const rendered = renderInline(image, context);
        if (rendered) parts.push(rendered);
      });
    }
    Array.from(figure.querySelectorAll("table")).forEach((table) => {
      const rendered = renderTable(table, context);
      if (rendered) parts.push(rendered);
    });
    const captionNodes = Array.from(
      figure.querySelectorAll(
        'figcaption, [data-test="bottom-caption"], .c-article-section__figure-description, .caption, .Caption, .captions, .Captions',
      ),
    ).filter(
      (candidate, index, nodes) =>
        !nodes.some((other, otherIndex) => otherIndex !== index && other.contains(candidate)),
    );
    captionNodes.forEach((caption) => {
      const captionText = renderCaptionNode(caption, context);
      if (captionText && !parts.includes(captionText)) parts.push(captionText);
    });
    if (!figure.querySelector("table")) {
      const tableLink = figure.querySelector(
        'a[data-test="table-link"], a[aria-label^="Full size table" i]',
      );
      if (tableLink) {
        const href = absoluteUrl(tableLink.getAttribute("href"), context && context.baseUrl);
        if (href) parts.push(`[Full size table](${href})`);
      }
    }
    if (!parts.length) {
      const fallback = normalizeInlineWhitespace(figure.textContent);
      if (fallback) parts.push(fallback);
    }
    return parts.join("\n\n");
  }

  function renderCaptionNode(caption, context) {
    if (!caption) return "";

    // Science wraps the title and long notes in block-looking DIVs even
    // though all of their descendants are inline. Render those pieces as
    // inline content so each bold/italic letter does not become a paragraph.
    if (caption.tagName === "FIGCAPTION") {
      const title = caption.querySelector(":scope > .caption, :scope > [data-test=\"caption\"]");
      const notes = caption.querySelector(":scope > .notes, :scope > [data-test=\"bottom-caption\"]");
      if (title || notes) {
        const note = notes && notes.querySelector(":scope > [role=\"doc-footnote\"]");
        const noteSource = note || notes;
        return [title, noteSource]
          .filter(Boolean)
          .map((node) => normalizeInlineWhitespace(renderInlineChildren(node, context)))
          .filter(Boolean)
          .join(" ");
      }
    }

    if (!hasDirectBlockChild(caption)) {
      return normalizeInlineWhitespace(renderInlineChildren(caption, context));
    }
    return normalizeWhitespace(renderBlocks(caption, context) || caption.textContent);
  }

  function renderBlock(node, context) {
    if (!node) return "";
    if (node.nodeType === 3) return normalizeInlineWhitespace(node.nodeValue);
    if (node.nodeType !== 1) return "";

    const element = node;
    if (context.skipNodes && context.skipNodes.has(element)) return "";
    if (isNoiseElement(element)) return "";

    const tag = element.tagName;
    if (
      element.getAttribute("role") === "math" ||
      element.matches("math, .mathjax-tex, .math-tex, .tex-math")
    ) {
      const latex = normalizeLatexSource(extractLatex(element));
      if (latex) return `$$\n${latex}\n$$`;
    }
    if (isMathElement(element)) {
      const latex = normalizeLatexSource(extractLatex(element));
      if (latex) return `$$\n${latex}\n$$`;
    }

    if (/^H[1-6]$/.test(tag)) {
      const sourceLevel = Number(tag.slice(1));
      const level = Math.min(6, Math.max(2, sourceLevel));
      const text = normalizeInlineWhitespace(renderInlineChildren(element, context) || element.textContent);
      return text ? `${"#".repeat(level)} ${text}` : "";
    }
    if (tag === "P") return normalizeInlineWhitespace(renderInlineChildren(element, context));
    if (isMixedParagraph(element)) return renderMixedParagraph(element, context);
    if (isParagraphLike(element)) {
      return normalizeInlineWhitespace(renderInlineChildren(element, context));
    }
    if (tag === "UL" || tag === "OL") return renderList(element, context, 0);
    if (tag === "TABLE") return renderTable(element, context);
    if (tag === "FIGURE") return renderFigure(element, context);
    if (tag === "PRE") {
      const code = String(element.textContent || "").replace(/^\n|\n$/g, "");
      return `\`\`\`\n${code}\n\`\`\``;
    }
    if (tag === "BLOCKQUOTE") {
      return normalizeWhitespace(renderBlocks(element, context))
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }
    if (tag === "HR") return "---";
    if (tag === "DL") {
      return Array.from(element.children)
        .map((child) => {
          const text = normalizeInlineWhitespace(renderInlineChildren(child, context) || child.textContent);
          return child.tagName === "DT" ? `**${text}**` : text;
        })
        .filter(Boolean)
        .join("\n\n");
    }
    if (tag === "IMG") return renderInline(element, context);

    // A generic wrapper containing only inline descendants (for example a
    // Science figure's `.caption` DIV) is one inline run, not many blocks.
    if (!hasDirectBlockChild(element)) {
      return normalizeInlineWhitespace(renderInlineChildren(element, context));
    }
    return renderBlocks(element, context);
  }

  function renderBlocks(container, context) {
    const chunks = [];
    childNodesArray(container).forEach((child) => {
      if (child.nodeType === 3) {
        const text = normalizeInlineWhitespace(child.nodeValue);
        if (text) chunks.push(escapeMarkdown(text));
        return;
      }
      const rendered = normalizeWhitespace(renderBlock(child, context));
      if (rendered) chunks.push(rendered);
    });
    return chunks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function linkifyBareDoi(markdown) {
    return String(markdown || "").replace(
      /(^|[\s(])(?!(?:https?:\/\/doi\.org\/))(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)(?=$|[\s),.;])/gi,
      (_match, prefix, doi) => `${prefix}[${doi}](https://doi.org/${doi.replace(/[.,;]+$/g, "")})`,
    );
  }

  PaperMd.core = {
    absoluteUrl,
    escapeMarkdown,
    firstMeta,
    linkifyBareDoi,
    mathmlToLatex,
    metaContents,
    normalizeLatexSource,
    normalizeDoi,
    normalizeInlineWhitespace,
    normalizeTargetId,
    normalizeWhitespace,
    parseCitationNumbers,
    queryFirst,
    renderBlock,
    renderBlocks,
    renderElementCitation,
    renderInline,
    renderInlineChildren,
    sanitizeFileName,
    unique,
    yamlString,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PaperMd.core;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
