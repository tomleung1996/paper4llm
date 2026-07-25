# Paper for LLMs（Paper4LLM）

[English](README.md) | 简体中文

Paper for LLMs 是一个 Chrome Manifest V3 扩展，用于将浏览器中已经打开的学术论文转换为结构化、保留引文链接的 Markdown。所有转换都在当前标签页本地完成。

目前支持：

- Elsevier ScienceDirect
- Wiley Online Library
- Nature
- SpringerLink
- Science / AAAS

## 功能

- 提取标题、作者、机构、期刊元数据、出版日期、DOI、PII、摘要、Highlights 和关键词。
- 保留标题层级、段落、列表、表格、公式、图片、图注和脚注。
- 在出版商提供可靠 DOM 目标时，将文内引用链接到对应参考文献。
- 保留参考文献顺序、显示标签、文本、DOI 和外部链接。
- 明确报告已映射和未映射的引用目标，不进行静默猜测。
- 支持复制 Markdown 或下载本地 `.md` 文件。
- 自动跟随 Chrome 界面语言，并提供持久化的中文／英文手动设置。
- 不上传论文内容，不使用分析、追踪或远程代码。

## 支持的论文网址

```text
https://www.sciencedirect.com/science/article/pii/...
https://onlinelibrary.wiley.com/doi/10....
https://*.onlinelibrary.wiley.com/doi/10....
https://www.nature.com/articles/...
https://link.springer.com/article/10....
https://www.science.org/doi/10.1126/...
https://www.science.org/doi/full/10.1126/...
https://www.science.org/doi/abs/10.1126/...
```

## 本地安装

1. 下载或克隆本仓库。
2. 在 Chrome 中打开 `chrome://extensions/`。
3. 开启右上角的**开发者模式**。
4. 点击**加载已解压的扩展程序**。
5. 选择包含 `manifest.json` 的仓库根目录。

## 使用方法

1. 打开一篇你有权访问的受支持论文。
2. 点击 Paper for LLMs 扩展图标。
3. 选择是否包含 YAML 元数据和图片链接。
4. 点击**转换当前论文**。
5. 检查引用完整性摘要，然后复制 Markdown 或下载 `.md` 文件。

如果扩展是在论文标签页打开之后才加载的，转换前刷新论文页面最为稳妥。

## 引用完整性

Paper for LLMs 优先使用出版商页面提供的标识符，而不是根据作者或年份文本猜测引用关系：

- ScienceDirect：将文内引用目标映射到参考文献 ID 及出版商提供的别名。
- Wiley：将引文链接映射到对应的 `data-bib-id` 条目。
- Nature 与 SpringerLink：将 `ref-CR30` 等 fragment 映射到参考文献容器。
- Science / AAAS：将 `data-xml-rid` 映射到参考文献条目 ID。

生成的 Markdown 末尾包含类似以下审计标记：

```markdown
<!-- paper-md-integrity: references=42; citation_targets_resolved=81; footnotes=3; footnote_targets_resolved=3; citation_targets_unresolved=0 -->
```

如果 `citation_targets_unresolved` 不为零，应人工复核相关引用。

## 隐私

论文内容和当前论文网址仅在本地处理，用于完成用户主动发起的转换。扩展不会将这些数据发送给开发者，也不会出售、共享或保留这些数据。

请参阅完整的[隐私政策](PRIVACY.zh-CN.md)或 [English Privacy Policy](PRIVACY.md)。

## 开发

扩展本身无需构建步骤，也不依赖第三方运行时软件包。

运行语法检查和单元测试：

```bash
npm run check
npm test
```

运行浏览器 DOM 集成测试：

```bash
npm run test:browser
```

然后打开 `http://127.0.0.1:4173/tests/browser-test.html`。

生成 Chrome Web Store ZIP：

```bash
npm run package:extension
```

运行完整发布检查：

```bash
npm run release:check
```

## 项目结构

```text
manifest.json            扩展清单
popup.html/css/js        弹窗界面
_locales/                Chrome 清单本地化
src/core.js              通用 DOM 到 Markdown 渲染器
src/sciencedirect.js     ScienceDirect 解析器
src/wiley.js             Wiley 解析器
src/springernature.js    Nature 与 SpringerLink 解析器
src/science.js           Science / AAAS 解析器
tests/                   单元测试和浏览器 DOM 样例
store/                   Chrome Web Store 文案与发布清单
CONTRIBUTING*.md          贡献指南
SECURITY*.md              安全报告政策
CHANGELOG*.md             版本记录
```

## 已知限制

- 扩展不会绕过账户、机构访问、付费墙或出版商验证页面。
- 出版商页面结构会持续变化，新的页面变体可能需要更新选择器。
- 当出版商要求会话 Cookie 或人机验证时，远程图片链接可能无法在浏览器外加载。
- 部分 SpringerLink 表格位于单独的详情页面；扩展会保留链接，不额外抓取页面。
- 完全由图片表示的公式、交互式图表和补充材料不会被下载。
- 第一版保留远程图片 URL，不会将图片文件与 Markdown 一起打包。

## 贡献与安全

提交 Pull Request 前请阅读 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。安全问题请按照 [SECURITY.zh-CN.md](SECURITY.zh-CN.md) 报告，不要在公开 Issue 中发布敏感细节。

版本记录见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)，Chrome Web Store 发布材料维护在 [store/](store/) 目录中。

## 免责声明

Paper for LLMs 是独立项目，与 Elsevier、Wiley、Springer Nature 或 AAAS 不存在隶属、合作或背书关系。出版商和期刊名称仅用于说明兼容性。用户有责任遵守所转换内容适用的访问条款和许可协议。

## 许可证

Paper for LLMs 依据 [MIT 许可证](LICENSE)开源。
