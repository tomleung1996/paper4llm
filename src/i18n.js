(function initPaperMdI18n(root) {
  "use strict";

  const DEFAULT_LOCALE = "en";
  const SUPPORTED_LOCALES = ["en", "zh-CN"];
  const LANGUAGE_PREFERENCES = ["auto", ...SUPPORTED_LOCALES];

  const messages = {
    en: {
      tagline: "Turn papers into citation-linked Markdown.",
      checkingPage: "Checking page…",
      conversionOptions: "Conversion options",
      yamlMetadata: "YAML metadata",
      imageLinks: "Image links",
      interfaceLanguage: "Language",
      languageAuto: "Auto",
      convertCurrentPaper: "Convert current paper",
      metricReferences: "References",
      metricResolved: "Linked citations",
      metricUnresolved: "Unlinked citations",
      supportedPageDefault: "Open a supported paper page to use this extension.",
      markdownOutput: "Markdown output",
      copyMarkdown: "Copy Markdown",
      downloadMarkdown: "Download .md",
      parsing: "Parsing the article, citations, and references…",
      noResponse: "The page did not return a conversion result.",
      conversionComplete: "Conversion complete: {count} characters.",
      conversionFailed: "Conversion failed.",
      copiedMarkdown: "Markdown copied to the clipboard.",
      downloadStarted: "Started downloading {filename}.",
      siteRecognized: "{site} recognized",
      unsupportedPage: "Unsupported page",
      pageReady: "Page ready. Conversion runs locally in the current tab.",
      supportedPageInstruction:
        "Open a supported paper detail page in the current tab.",
      cannotReadTab: "Could not read the active tab.",
      unsupportedArticlePage: "The current page is not a supported paper detail page.",
      converterNotLoaded:
        "The converter did not load correctly. Refresh the paper page and try again.",
      missingTitle: "Could not identify the paper title.",
      bodyTooShort:
        "The article body is short. The page may contain only an abstract, or the full text may not have finished loading.",
      missingReferences: "Could not identify the reference list.",
      wileyReferencesDelayed:
        "Wiley references may not have finished loading. Expand REFERENCES on the page and try again.",
      unresolvedCitationCount: "Unmapped in-text citations: {count}.",
      duplicateReferenceLabels: "Duplicate reference labels detected: {labels}.",
      springerPartialBody:
        "No complete article body was detected. This page may be an abstract, subscription preview, or still loading.",
      sciencePartialBody:
        "This Science page does not provide the complete article body. Only the loaded metadata, abstract, and references will be exported.",
      scienceImageSession:
        "Science image links may depend on the browser's human-verification session and may not load directly in external apps such as Typora.",
    },
    "zh-CN": {
      tagline: "将论文转换为保留引文链接的 Markdown。",
      checkingPage: "正在检查页面…",
      conversionOptions: "转换选项",
      yamlMetadata: "YAML 元数据",
      imageLinks: "图片链接",
      interfaceLanguage: "界面语言",
      languageAuto: "自动",
      convertCurrentPaper: "转换当前论文",
      metricReferences: "参考文献",
      metricResolved: "已映射引用",
      metricUnresolved: "未映射引用",
      supportedPageDefault: "请在受支持的论文页面使用。",
      markdownOutput: "Markdown 输出",
      copyMarkdown: "复制 Markdown",
      downloadMarkdown: "下载 .md",
      parsing: "正在解析正文、文内引用与参考文献……",
      noResponse: "页面没有返回转换结果。",
      conversionComplete: "转换完成：{count} 个字符。",
      conversionFailed: "转换失败。",
      copiedMarkdown: "Markdown 已复制到剪贴板。",
      downloadStarted: "已开始下载 {filename}。",
      siteRecognized: "{site} 已识别",
      unsupportedPage: "不支持此页面",
      pageReady: "页面已就绪。转换过程完全在当前页面本地执行。",
      supportedPageInstruction:
        "请在当前标签页打开受支持的论文详情页。",
      cannotReadTab: "无法读取当前标签页。",
      unsupportedArticlePage: "当前页面不是受支持的论文详情页。",
      converterNotLoaded: "转换器脚本未正确加载，请刷新论文页面后重试。",
      missingTitle: "未识别到论文标题。",
      bodyTooShort: "正文较短，页面可能只提供摘要，或全文尚未加载完成。",
      missingReferences: "未识别到参考文献列表。",
      wileyReferencesDelayed:
        "Wiley 参考文献可能尚未延迟加载，请在页面展开 REFERENCES 后重试。",
      unresolvedCitationCount: "有 {count} 个文内引用未能映射到参考文献。",
      duplicateReferenceLabels: "检测到重复参考文献编号：{labels}。",
      springerPartialBody:
        "未检测到完整正文；当前页面可能是摘要、订阅预览，或全文尚未加载完成。",
      sciencePartialBody:
        "当前 Science 页面未提供完整正文；将仅导出页面已加载的元数据、摘要和参考文献。",
      scienceImageSession:
        "Science 图片链接可能依赖浏览器的人机验证会话，在 Typora 等外部软件中可能无法直接加载。",
    },
  };

  function normalizeLocale(value) {
    const locale = String(value || "")
      .trim()
      .replace(/_/g, "-")
      .toLowerCase();
    return locale === "zh" || locale.startsWith("zh-") ? "zh-CN" : DEFAULT_LOCALE;
  }

  function detectLocale() {
    let browserLocale = "";
    try {
      if (root.chrome && root.chrome.i18n && typeof root.chrome.i18n.getUILanguage === "function") {
        browserLocale = root.chrome.i18n.getUILanguage();
      }
    } catch (_error) {
      browserLocale = "";
    }
    return normalizeLocale(browserLocale || (root.navigator && root.navigator.language));
  }

  function resolveLocale(preference) {
    return preference === "auto" ? detectLocale() : normalizeLocale(preference);
  }

  function isValidPreference(preference) {
    return LANGUAGE_PREFERENCES.includes(preference);
  }

  function formatValue(value, locale) {
    if (typeof value === "number") return new Intl.NumberFormat(locale).format(value);
    return value == null ? "" : String(value);
  }

  function t(locale, key, params) {
    const resolvedLocale = normalizeLocale(locale);
    const dictionary = messages[resolvedLocale] || messages[DEFAULT_LOCALE];
    const template = dictionary[key] || messages[DEFAULT_LOCALE][key] || key;
    const values = params || {};
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name) =>
      formatValue(values[name], resolvedLocale),
    );
  }

  function addWarning(diagnostics, locale, key, params) {
    const detail = { key, params: { ...(params || {}) } };
    if (!Array.isArray(diagnostics.warningDetails)) diagnostics.warningDetails = [];
    if (!Array.isArray(diagnostics.warnings)) diagnostics.warnings = [];
    diagnostics.warningDetails.push(detail);
    diagnostics.warnings.push(t(locale, key, detail.params));
  }

  const api = {
    DEFAULT_LOCALE,
    LANGUAGE_PREFERENCES,
    SUPPORTED_LOCALES,
    addWarning,
    detectLocale,
    isValidPreference,
    messages,
    normalizeLocale,
    resolveLocale,
    t,
  };

  root.PaperMdI18n = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
