# Chrome Web Store Assets

English | [简体中文](README.zh-CN.md)

This directory contains the localized artwork prepared for the Paper for LLMs Chrome Web Store listing.

## Generated files

- `promo-small-en-440x280.png` and `promo-small-zh-CN-440x280.png`: localized small promotional tiles.
- `screenshot-1-*-1280x800.png`: article-to-Markdown conversion and the actual extension interface.
- `screenshot-2-*-1280x800.png`: citation-to-reference linking and integrity reporting.
- `screenshot-3-*-1280x800.png`: supported publishers and local-processing explanation.

## Regenerate

Run:

```bash
npm run assets:store
```

The script uses a locally installed Chrome or Chromium browser. Set `CHROME_BIN` if it cannot detect the executable automatically. The editable source is `source/render.html`; generated PNG files are written to `generated/`.

Review the current Chrome Web Store dashboard requirements before uploading because accepted dimensions and required asset types may change.
