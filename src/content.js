(function initPaperMarkdownContentScript(root) {
  "use strict";

  if (root.__paperMarkdownContentLoaded) return;
  const i18n = root.PaperMdI18n;
  if (!i18n) throw new Error("PaperMd i18n must be loaded before the content script.");
  root.__paperMarkdownContentLoaded = true;

  function localizedError(locale, key, params) {
    const error = new Error(i18n.t(locale, key, params));
    error.paperMdErrorCode = key;
    error.paperMdErrorParams = params || {};
    return error;
  }

  function errorResponse(locale, key, params) {
    return {
      ok: false,
      errorCode: key,
      errorParams: params || {},
      error: i18n.t(locale, key, params),
    };
  }

  function detectSite() {
    if (
      location.hostname === "www.sciencedirect.com" &&
      /^\/science\/article\/pii\//.test(location.pathname)
    ) {
      return "sciencedirect";
    }
    if (
      (location.hostname === "onlinelibrary.wiley.com" ||
        location.hostname.endsWith(".onlinelibrary.wiley.com")) &&
      /^\/doi\/(?:full\/|abs\/)?10\./i.test(location.pathname)
    ) {
      return "wiley";
    }
    if (
      ((location.hostname === "www.nature.com" ||
        location.hostname === "nature.com" ||
        location.hostname.endsWith(".nature.com")) &&
        /^\/articles\//i.test(location.pathname)) ||
      (location.hostname === "link.springer.com" && /^\/article\/10\./i.test(location.pathname))
    ) {
      return "springernature";
    }
    if (
      (location.hostname === "www.science.org" || location.hostname === "science.org") &&
      /^\/doi\/(?:full\/|abs\/)?10\.1126\//i.test(location.pathname)
    ) {
      return "science";
    }
    return "";
  }

  function waitForArticle(timeoutMs) {
    const hasArticle = () =>
      Boolean(
        document.querySelector(
          'meta[name="citation_title"], h1#screen-reader-main-title, h1.article-title, article h1, main h1',
        ),
      );
    if (hasArticle()) return Promise.resolve();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeoutMs);
      const observer = new MutationObserver(() => {
        if (!hasArticle()) return;
        clearTimeout(timeout);
        observer.disconnect();
        resolve();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === "PAPER_MD_PING") {
      const site = detectSite();
      sendResponse({ ok: true, supported: Boolean(site), site });
      return false;
    }

    if (message.type !== "PAPER_MD_CONVERT") return false;
    const requestedOptions = message.options || {};
    const locale = i18n.normalizeLocale(requestedOptions.locale || i18n.detectLocale());
    const site = detectSite();
    if (!site) {
      sendResponse(errorResponse(locale, "unsupportedArticlePage"));
      return false;
    }

    waitForArticle(5000)
      .then(() => {
        const extractor = root.PaperMd && root.PaperMd[site];
        if (!extractor || typeof extractor.extract !== "function") {
          throw localizedError(locale, "converterNotLoaded");
        }
        const prepare = typeof extractor.prepare === "function"
          ? extractor.prepare(document, 5000)
          : Promise.resolve();
        return prepare.then(() => extractor.extract(document, { ...requestedOptions, locale }));
      })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          errorCode: error && error.paperMdErrorCode ? error.paperMdErrorCode : "",
          errorParams: error && error.paperMdErrorParams ? error.paperMdErrorParams : {},
          error: error && error.message ? error.message : i18n.t(locale, "conversionFailed"),
        }),
      );
    return true;
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
