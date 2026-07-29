# Chrome Web Store Release Checklist

English | [简体中文](PUBLISHING_CHECKLIST.zh-CN.md)

Use this checklist for the first public release and for later updates. Chrome Web Store fields and asset requirements can change, so the Developer Dashboard remains authoritative.

## 1. Open-source repository

- [ ] Confirm that the final source archive includes the MIT `LICENSE` file.
- [ ] Create the public repository and confirm that no credentials, cookies, private article content, or local-only files are present.
- [ ] Keep `backups/` out of the public repository; it contains local rollback copies rather than release assets.
- [ ] Confirm that the homepage, support, privacy-policy, and security-reporting links point to the public repository.
- [ ] Enable GitHub Issues for public support and private vulnerability reporting through GitHub Security Advisories.
- [ ] Confirm that every public-facing document has an English and Simplified Chinese version with working language links.

## 2. Extension package

- [ ] Confirm that the release version is `1.2.0` in `manifest.json`, `package.json`, and release documentation.
- [ ] Review `activeTab`, `scripting`, host permissions, and content-script matches. Remove any access that is not necessary for the submitted implementation.
- [ ] Confirm that the permission explanations in `STORE_LISTING.md` exactly match the uploaded `manifest.json`.
- [ ] Confirm that all executable code is packaged locally and that no remote code is loaded.
- [ ] Run `npm run release:check`.
- [ ] Load the unpacked extension in a clean Chrome profile and test every supported publisher.
- [ ] Test English, Simplified Chinese, and automatic language selection.
- [ ] Test copy, `.md` download, YAML on/off, image links on/off, long output, and unresolved-citation reporting.
- [ ] Verify expected behavior on sign-in, paywall, cookie, and human-verification pages. The extension must not bypass them.
- [ ] Inspect the generated ZIP and confirm that `manifest.json` is at its root and that no development-only or private files are included.

## 3. Store assets

- [ ] Use the final 128×128 extension icon.
- [ ] Select the matching 440×280 small promotional tile from `store/assets/generated/`.
- [ ] Select the 1280×800 store screenshots from `store/assets/generated/`.
- [ ] Upload the matching English or Simplified Chinese localized assets for each listing.
- [ ] Show the actual extension interface and representative Markdown output; do not imply unsupported capabilities.
- [ ] Check all images at their final uploaded size for legibility, safe margins, and consistent branding.
- [ ] Reconfirm required dimensions in the Developer Dashboard immediately before upload.

## 4. Developer Dashboard

### Store Listing

- [ ] Enter the localized name, summary, detailed description, category, language, icon, screenshots, homepage, and support URL.
- [ ] Use the matching text from `STORE_LISTING.md` and `STORE_LISTING.zh-CN.md`.
- [ ] Include the independent-project and publisher non-affiliation disclaimer.

### Privacy

- [ ] State the single purpose: convert the current supported scholarly article into citation-linked Markdown.
- [ ] Provide a public HTTPS privacy-policy URL.
- [ ] Explain every requested permission in plain language.
- [ ] Declare remote code as **No**.
- [ ] Disclose website content as locally processed for the requested conversion.
- [ ] Answer the current-URL or web-history question conservatively and consistently: the active article URL is handled locally for publisher detection and source attribution, while cross-tab or long-term browsing history is not collected.
- [ ] Disclose the locally stored language preference if the dashboard asks about user settings.
- [ ] Certify compliance with the Chrome Web Store User Data Policy and Limited Use requirements only after checking the final package and privacy policy.

### Distribution and review

- [ ] Choose public visibility and the intended regions.
- [ ] Add the reviewer instructions and representative URLs from the store-listing draft.
- [ ] Confirm that no account or credentials are required from the reviewer beyond any access the publisher itself requires.
- [ ] Upload the final ZIP.
- [ ] Use deferred publishing if you want to choose the public release time after approval.

## 5. After submission

- [ ] Monitor review status and answer reviewer questions promptly.
- [ ] Keep the privacy policy, support URL, and security-reporting route publicly reachable.
- [ ] Tag the exact source commit used for the submitted package and attach the matching ZIP to the release if desired.
- [ ] For every later upload, increment the version, update both changelogs, rerun the complete release check, and archive the submitted package.
