# Security Policy

English | [简体中文](SECURITY.zh-CN.md)

## Supported versions

Until the first stable release, security fixes are applied only to the latest code on the default branch. After public releases begin, this section will list the maintained versions explicitly.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue, discussion, screenshot, or article sample.

Use [Report a vulnerability](https://github.com/tomleung1996/paper4llm/security/advisories/new) in the repository's Security tab to submit a private GitHub Security Advisory. If private reporting is temporarily unavailable, open a public issue containing only a request for a private contact route and no technical or sensitive details.

Include, when possible:

- The affected extension version and browser version.
- A concise description of the impact and the conditions required to trigger it.
- Minimal reproduction steps using synthetic or non-sensitive content.
- Whether the issue involves extension permissions, page-script isolation, DOM injection, local storage, clipboard or download output, generated Markdown, or unintended data transmission.
- Any suggested mitigation.

Never include account credentials, cookies, access tokens, institutional session data, private URLs, full paywalled articles, or personal information in a report.

## Scope and expectations

Relevant reports include unintended access beyond the active supported article, data leaving the browser unexpectedly, unsafe handling of hostile page markup, privilege escalation, remote-code execution, or generated files that can cause unintended behavior when opened.

Publisher access controls, paywalls, availability of third-party image URLs, and parsing differences caused solely by a publisher markup change are normally compatibility issues rather than security vulnerabilities.

The maintainer will acknowledge a private report, investigate it, and coordinate disclosure in good faith. Exact response targets will be added after a stable public maintenance process is established.
