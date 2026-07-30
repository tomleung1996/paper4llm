# Paper for LLMs Privacy Policy

English | [简体中文](PRIVACY.zh-CN.md)

**Effective date:** July 25, 2026

**Last updated:** July 30, 2026

## 1. Scope and single purpose

Paper for LLMs converts a supported scholarly article that the user is already viewing into structured Markdown. Its single purpose is to preserve article content, metadata, citations, references, figures, tables, formulas, and related links in a format suitable for reading, archiving, and language-model workflows.

The extension does not bypass accounts, institutional access, paywalls, or publisher verification.

## 2. Data handled by the extension

To provide the conversion requested by the user, Paper for LLMs handles the following information locally:

- The content and structure of the supported article page, including article text, metadata, citations, references, figures, tables, formulas, and links.
- The current article URL, used to identify the supported site and preserve the source URL in the output.
- The interface-language preference selected by the user, if the automatic language setting is overridden.

Chrome Web Store policy treats website content and URLs as user data even when they are processed only on the user's device. Paper for LLMs therefore discloses this local handling explicitly.

## 3. How data is used

The information above is used only to:

- Detect whether the current tab contains a supported article.
- Generate the Markdown requested by the user.
- Report citation and reference integrity information.
- Remember the user's interface-language preference locally.

Conversion begins only after the user opens the extension and selects **Convert current paper**.

## 4. Local processing, transmission, and retention

- Article content, citation data, reference data, page URLs, and generated Markdown are processed locally in the browser.
- Paper for LLMs does not transmit this information to the developer, an analytics provider, an advertising provider, or another third party.
- Paper for LLMs does not operate a remote database and does not retain a separate copy of converted articles.
- Paper for LLMs does not sell user data, use it for advertising, profiling, credit decisions, or unrelated research, or allow humans to review it.
- The language preference is stored in extension-local browser storage and remains on the user's device unless the user clears extension data or removes the extension.

The user may copy generated Markdown to the clipboard or download it as a local `.md` file. These actions are explicitly initiated and controlled by the user.

## 5. Images and third-party links

When image links are enabled, Paper for LLMs preserves source-hosted image URLs in the generated Markdown. The extension does not proxy or separately download those images. Opening a source URL or rendering a remote image is subject to that site's privacy policy, access controls, cookies, and terms.

## 6. Permissions

Paper for LLMs currently requests:

- `activeTab`: access the article tab after the user invokes the extension.
- `scripting`: inject the packaged converter when it is not already available in the current page.
- Supported-site host access: read the DOM only on the scholarly article URL patterns declared in the extension manifest, including the listed publisher platforms and arXiv HTML.

The extension does not use remotely hosted code. All executable code is included in the extension package.

## 7. Chrome Web Store Limited Use compliance

Paper for LLMs's use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used only to provide or improve the extension's disclosed, user-facing single purpose.

## 8. Data sharing

Paper for LLMs does not share user data with third parties. Data may be disclosed only if required by applicable law; because the extension does not transmit or retain article data, the developer normally does not possess such data to disclose.

## 9. Security

Keeping processing local reduces exposure to external systems. Users should still review generated files before sharing them and should avoid including private or licensed content in public bug reports.

## 10. Changes to this policy

Material changes to this policy will be published in the public project repository and reflected in the policy's update date.

## 11. Contact

For privacy questions, use the Issues or security-reporting channel provided by the public Paper for LLMs repository. Do not include private article content, account information, authentication cookies, or other sensitive data in a public issue.
