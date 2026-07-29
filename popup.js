(function initPopup(root) {
  "use strict";

  const i18n = root.PaperMdI18n;
  if (!i18n) throw new Error("PaperMd i18n must be loaded before the popup.");

  const LANGUAGE_STORAGE_KEY = "paper4llm.languagePreference";
  const elements = {
    badge: document.querySelector("#site-badge"),
    convert: document.querySelector("#convert"),
    copy: document.querySelector("#copy"),
    download: document.querySelector("#download"),
    frontMatter: document.querySelector("#include-frontmatter"),
    images: document.querySelector("#include-images"),
    language: document.querySelector("#language-preference"),
    markdown: document.querySelector("#markdown"),
    report: document.querySelector("#report"),
    resultPanel: document.querySelector("#result-panel"),
    status: document.querySelector("#status"),
    warnings: document.querySelector("#warnings"),
    referenceCount: document.querySelector("#reference-count"),
    resolvedCount: document.querySelector("#resolved-count"),
    unresolvedCount: document.querySelector("#unresolved-count"),
  };

  let languagePreference = readLanguagePreference();
  let locale = i18n.resolveLocale(languagePreference);
  let activeTab = null;
  let activeSite = null;
  let currentFilename = "paper.md";
  let currentDiagnostics = null;
  let badgeState = { type: "checking", site: "" };
  let statusState = { key: "supportedPageDefault", params: {}, isError: false, raw: "" };

  function readLanguagePreference() {
    try {
      const stored = root.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return i18n.isValidPreference(stored) ? stored : "auto";
    } catch (_error) {
      return "auto";
    }
  }

  function saveLanguagePreference(preference) {
    try {
      root.localStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
    } catch (_error) {
      // The preference remains active for the current popup if storage is unavailable.
    }
  }

  function t(key, params) {
    return i18n.t(locale, key, params);
  }

  function detectSite(url) {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname === "www.sciencedirect.com" &&
        /^\/science\/article\/pii\//.test(parsed.pathname)
      ) {
        return { id: "sciencedirect", label: "ScienceDirect" };
      }
      if (
        (parsed.hostname === "onlinelibrary.wiley.com" ||
          parsed.hostname.endsWith(".onlinelibrary.wiley.com")) &&
        /^\/doi\/(?:full\/|abs\/)?10\./i.test(parsed.pathname)
      ) {
        return { id: "wiley", label: "Wiley" };
      }
      if (
        ((parsed.hostname === "www.nature.com" ||
          parsed.hostname === "nature.com" ||
          parsed.hostname.endsWith(".nature.com")) &&
          /^\/articles\//i.test(parsed.pathname)) ||
        (parsed.hostname === "link.springer.com" && /^\/article\/10\./i.test(parsed.pathname))
      ) {
        return {
          id: "springernature",
          label: parsed.hostname.includes("nature.com") ? "Nature" : "SpringerLink",
        };
      }
      if (
        (parsed.hostname === "www.science.org" || parsed.hostname === "science.org") &&
        /^\/doi\/(?:full\/|abs\/)?10\.1126\//i.test(parsed.pathname)
      ) {
        return { id: "science", label: "Science / AAAS" };
      }
      if ((parsed.hostname === "www.mdpi.com" || parsed.hostname === "mdpi.com") && /^\/\d{4}-\d{3,5}\//.test(parsed.pathname)) {
        return { id: "mdpi", label: "MDPI" };
      }
      if ((parsed.hostname === "www.tandfonline.com" || parsed.hostname === "tandfonline.com") && /^\/doi\/(?:full\/|abs\/)?10\./i.test(parsed.pathname)) {
        return { id: "taylorfrancis", label: "Taylor & Francis" };
      }
      if ((parsed.hostname === "www.frontiersin.org" || parsed.hostname === "frontiersin.org") && /\/articles\/10\.3389\//i.test(parsed.pathname)) {
        return { id: "frontiers", label: "Frontiers" };
      }
      if (parsed.hostname === "academic.oup.com" && /\/article\//i.test(parsed.pathname)) {
        return { id: "oup", label: "Oxford Academic" };
      }
      if (parsed.hostname === "direct.mit.edu" && /^\/[^/]+\/article\//i.test(parsed.pathname)) {
        return { id: "mitpress", label: "MIT Press Direct" };
      }
      if (parsed.hostname === "ieeexplore.ieee.org" && /^\/document\/\d+/i.test(parsed.pathname)) {
        return { id: "ieee", label: "IEEE Xplore" };
      }
      if (
        (parsed.hostname === "www.ovid.com" && /^\/jnls\/.+\/fulltext\//i.test(parsed.pathname)) ||
        (parsed.hostname.endsWith(".lww.com") && /10\.(?:1097|4103)\//i.test(parsed.pathname))
      ) {
        return { id: "wolterskluwer", label: "Wolters Kluwer" };
      }
      if (
        (parsed.hostname === "journals.sagepub.com" || parsed.hostname === "sage.cnpereading.com") &&
        /^\/doi\/(?:full\/|abs\/)?10\.1177\//i.test(parsed.pathname)
      ) {
        return { id: "sage", label: "SAGE" };
      }
      return null;
    } catch (_error) {
      return null;
    }
  }

  function renderBadge() {
    elements.badge.classList.remove("supported", "unsupported");
    if (badgeState.type === "supported") {
      elements.badge.textContent = t("siteRecognized", { site: badgeState.site });
      elements.badge.classList.add("supported");
      return;
    }
    if (badgeState.type === "unsupported") {
      elements.badge.textContent = t("unsupportedPage");
      elements.badge.classList.add("unsupported");
      return;
    }
    elements.badge.textContent = t("checkingPage");
  }

  function renderStatus() {
    elements.status.textContent = statusState.raw || t(statusState.key, statusState.params);
    elements.status.classList.toggle("error", Boolean(statusState.isError));
  }

  function setStatusKey(key, params, isError) {
    statusState = { key, params: params || {}, isError: Boolean(isError), raw: "" };
    renderStatus();
  }

  function setStatusRaw(message, isError) {
    statusState = { key: "", params: {}, isError: Boolean(isError), raw: String(message || "") };
    renderStatus();
  }

  function warningMessages(diagnostics) {
    if (Array.isArray(diagnostics.warningDetails) && diagnostics.warningDetails.length) {
      return diagnostics.warningDetails.map((detail) => t(detail.key, detail.params));
    }
    return diagnostics.warnings || [];
  }

  function renderWarnings() {
    const warnings = currentDiagnostics ? warningMessages(currentDiagnostics) : [];
    elements.warnings.replaceChildren(
      ...warnings.map((warning) => {
        const item = document.createElement("li");
        item.textContent = warning;
        return item;
      }),
    );
    elements.warnings.hidden = warnings.length === 0;
  }

  function applyStaticTranslations() {
    document.documentElement.lang = locale;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
    elements.language.value = languagePreference;
    renderBadge();
    renderStatus();
    renderWarnings();
  }

  function sendMessage(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(response);
      });
    });
  }

  async function ensureContentScript(tabId) {
    try {
      return await sendMessage(tabId, { type: "PAPER_MD_PING" });
    } catch (_error) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          "src/i18n.js",
          "src/core.js",
          "src/sciencedirect.js",
          "src/wiley.js",
          "src/springernature.js",
          "src/science.js",
          "src/publisher-platforms.js",
          "src/content.js",
        ],
      });
      return sendMessage(tabId, { type: "PAPER_MD_PING" });
    }
  }

  function showDiagnostics(diagnostics) {
    currentDiagnostics = diagnostics;
    elements.referenceCount.textContent = String(diagnostics.references || 0);
    elements.resolvedCount.textContent = String(diagnostics.resolvedCitationLinks || 0);
    elements.unresolvedCount.textContent = String((diagnostics.unresolvedCitations || []).length);
    elements.report.hidden = false;
    renderWarnings();
  }

  function responseError(response, fallbackKey) {
    if (response && response.errorCode) return t(response.errorCode, response.errorParams);
    return (response && response.error) || t(fallbackKey);
  }

  async function convertCurrentPage() {
    if (!activeTab || !activeSite) return;
    elements.convert.disabled = true;
    setStatusKey("parsing", {}, false);
    try {
      await ensureContentScript(activeTab.id);
      const response = await sendMessage(activeTab.id, {
        type: "PAPER_MD_CONVERT",
        options: {
          includeFrontMatter: elements.frontMatter.checked,
          includeImages: elements.images.checked,
          locale,
        },
      });
      if (!response || !response.ok) throw new Error(responseError(response, "noResponse"));

      const { result } = response;
      elements.markdown.value = result.markdown;
      currentFilename = result.filename || "paper.md";
      showDiagnostics(result.diagnostics || {});
      elements.resultPanel.hidden = false;
      setStatusKey("conversionComplete", { count: result.markdown.length }, false);
    } catch (error) {
      setStatusRaw(error.message || t("conversionFailed"), true);
    } finally {
      elements.convert.disabled = false;
    }
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(elements.markdown.value);
    setStatusKey("copiedMarkdown", {}, false);
  }

  function downloadMarkdown() {
    const blob = new Blob([elements.markdown.value], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = currentFilename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatusKey("downloadStarted", { filename: currentFilename }, false);
  }

  function changeLanguage() {
    languagePreference = i18n.isValidPreference(elements.language.value)
      ? elements.language.value
      : "auto";
    saveLanguagePreference(languagePreference);
    locale = i18n.resolveLocale(languagePreference);
    applyStaticTranslations();
  }

  async function initialize() {
    applyStaticTranslations();
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0] || null;
    activeSite = activeTab ? detectSite(activeTab.url) : null;
    const supported = Boolean(activeSite);
    badgeState = supported
      ? { type: "supported", site: activeSite.label }
      : { type: "unsupported", site: "" };
    renderBadge();
    elements.convert.disabled = !supported;
    setStatusKey(supported ? "pageReady" : "supportedPageInstruction", {}, !supported);
  }

  elements.convert.addEventListener("click", convertCurrentPage);
  elements.copy.addEventListener("click", () =>
    copyMarkdown().catch((error) => setStatusRaw(error.message, true)),
  );
  elements.download.addEventListener("click", downloadMarkdown);
  elements.language.addEventListener("change", changeLanguage);
  initialize().catch((error) => setStatusRaw(error.message || t("cannotReadTab"), true));
})(typeof globalThis !== "undefined" ? globalThis : window);
