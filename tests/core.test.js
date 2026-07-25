const test = require("node:test");
const assert = require("node:assert/strict");
const i18n = require("../src/i18n.js");
const core = require("../src/core.js");

test("i18n normalizes browser locales and resolves automatic preferences", () => {
  assert.equal(i18n.normalizeLocale("zh-TW"), "zh-CN");
  assert.equal(i18n.normalizeLocale("en-GB"), "en");
  assert.equal(i18n.resolveLocale("zh-CN"), "zh-CN");
});

test("i18n translates parameterized messages and preserves warning keys", () => {
  assert.deepEqual(Object.keys(i18n.messages.en).sort(), Object.keys(i18n.messages["zh-CN"]).sort());
  assert.equal(i18n.t("en", "unresolvedCitationCount", { count: 3 }), "Unmapped in-text citations: 3.");
  assert.equal(i18n.t("zh-CN", "unresolvedCitationCount", { count: 3 }), "有 3 个文内引用未能映射到参考文献。");
  const diagnostics = { warnings: [] };
  i18n.addWarning(diagnostics, "en", "missingTitle");
  assert.deepEqual(diagnostics.warningDetails, [{ key: "missingTitle", params: {} }]);
  assert.equal(diagnostics.warnings[0], "Could not identify the paper title.");
});

test("parseCitationNumbers expands ranges and removes duplicates", () => {
  assert.deepEqual(core.parseCitationNumbers("[1, 3–5, 5]"), ["1", "3", "4", "5"]);
});

test("normalizeDoi extracts a DOI and removes trailing punctuation", () => {
  assert.equal(core.normalizeDoi("doi:10.1016/j.respol.2026.105000."), "10.1016/j.respol.2026.105000");
  assert.equal(core.normalizeDoi("https://doi.org/10.1000%2Fencoded.1"), "10.1000/encoded.1");
});

test("normalizeTargetId accepts full fragment URLs", () => {
  assert.equal(core.normalizeTargetId("https://example.test/paper#Bib12"), "bib12");
});

test("normalizeLatexSource removes math delimiters and their inner edge spaces", () => {
  assert.equal(core.normalizeLatexSource("$$ x $$"), "x");
  assert.equal(core.normalizeLatexSource("$ y + z $"), "y + z");
  assert.equal(core.normalizeLatexSource("\\( q \\)"), "q");
});

test("escapeMarkdown keeps square brackets out of Typora math mode", () => {
  assert.equal(core.escapeMarkdown("evidence [1]"), "evidence &#91;1&#93;");
  assert.ok(!core.escapeMarkdown("[1]").includes("\\["));
});

test("mathmlToLatex handles common inline and display structures", () => {
  const text = (value) => ({ nodeType: 3, nodeValue: value });
  const element = (localName, children = [], attributes = {}) => ({
    nodeType: 1,
    localName,
    children,
    childNodes: children,
    textContent: children.map((child) => child.textContent || child.nodeValue || "").join(""),
    getAttribute(name) {
      return attributes[name] || null;
    },
  });
  const mi = (value) => element("mi", [text(value)]);
  const mn = (value) => element("mn", [text(value)]);
  assert.equal(core.mathmlToLatex(element("msubsup", [mi("x"), mi("i"), mn("2")])), "x_{i}^{2}");
  assert.equal(core.mathmlToLatex(element("mfrac", [mi("a"), mi("b")])), "\\frac{a}{b}");
});

test("sanitizeFileName removes reserved path characters", () => {
  assert.equal(core.sanitizeFileName('A paper: evidence / results?'), "A paper- evidence - results-");
});
