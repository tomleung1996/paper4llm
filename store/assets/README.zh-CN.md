# Chrome Web Store 商店素材

[English](README.md) | 简体中文

本目录保存为 Paper for LLMs Chrome Web Store 页面准备的本地化视觉素材。

## 生成的文件

- `promo-small-en-440x280.png` 和 `promo-small-zh-CN-440x280.png`：英文和中文小型宣传图。
- `screenshot-1-*-1280x800.png`：从论文到 Markdown 的转换过程及实际扩展界面。
- `screenshot-2-*-1280x800.png`：文内引用与参考文献关联及完整性报告。
- `screenshot-3-*-1280x800.png`：支持的出版商和本地处理方式。

## 重新生成

运行：

```bash
npm run assets:store
```

脚本使用本机安装的 Chrome 或 Chromium。如果无法自动找到浏览器，请设置 `CHROME_BIN`。可编辑源文件为 `source/render.html`，生成的 PNG 写入 `generated/`。

如需只重新生成一类素材，可在命令前设置 `STORE_ASSET_SCOPE=promo` 或 `STORE_ASSET_SCOPE=screenshots`。

Chrome Web Store 接受的尺寸和必需素材类型可能变化，上传前应再次核对当时控制台显示的要求。
