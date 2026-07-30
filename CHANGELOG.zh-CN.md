# 更新日志

[English](CHANGELOG.md) | 简体中文

Paper for LLMs 的重要变更都会记录在此。

## 尚未发布

- 暂无变更。

## 1.3.0 — 2026-07-30

- 新增 arXiv HTML 全文支持，兼容现代编号与旧式分类编号网址。
- 保留 LaTeXML 文内引用到参考文献的链接、作者与机构、arXiv 版本和分类元数据、公式、图片、表格、图注及隐藏脚注内容。
- 避免将 arXiv 参考文献中的 DOI 误识别为论文本身的 DOI，并移除重复标题／作者块和参考文献回链控件。
- 使用计算机科学、量子物理和生物物理领域的三篇开放获取 arXiv HTML 论文完成验证，并将浏览器回归测试扩展到 108 项断言。

## 1.2.0 — 2026-07-29

- 新增 MIT Press Direct 支持，覆盖 Quantitative Science Studies、Open Mind、Network Neuroscience 以及使用相同论文平台的其他期刊。
- 通过 `data-modal-source-id` 与 `data-content-id` 保留 MIT Press 文内引用到参考文献的准确链接。
- 保留 MIT Press 图片、图注、表格与 MathML 公式，并移除重复查看控件和参考文献检索链接。
- 使用三本 MIT Press 期刊的三篇开放获取论文验证解析器，并将浏览器回归测试扩展到 98 项断言。

## 1.1.0 — 2026-07-29

- 新增 MDPI、Taylor & Francis、Frontiers、Oxford Academic、IEEE Xplore、Wolters Kluwer/Ovid 与 SAGE Journals 的保留引文链接 Markdown 解析。
- 每家新增出版商均使用至少三篇来自不同期刊的开放获取论文进行验证。
- 支持按需加载 IEEE 参考文献，并从出版商结构化数据中恢复 Wolters Kluwer 的完整作者列表。
- 浏览器回归测试扩展到覆盖全部支持平台的 90 项断言。

## 1.0.0 — 2026-07-25

- 发布扩展的首个稳定版本。
- 支持将 ScienceDirect、Wiley Online Library、Nature、SpringerLink 和 Science / AAAS 论文转换为保留引文链接的 Markdown。
- 保留结构化元数据、正文、公式、表格、图片、脚注、参考文献，以及出版商提供的引文关系。
- 添加引用完整性报告、Markdown 复制与下载，以及可选的 YAML 元数据和图片链接。
- 提供自动英文／简体中文界面选择和持久化手动设置。
- 发布完整的双语项目说明、隐私政策、贡献指南、安全政策、商店文案和发布清单。
- 添加本地化的 Chrome Web Store 宣传图和截图。
- 依据 MIT 许可证发布源代码。

## 0.5.0 — 预发布

- 支持将 ScienceDirect、Wiley Online Library、Nature、SpringerLink 和 Science / AAAS 论文转换为 Markdown。
- 保留结构化元数据、正文、公式、表格、图片、脚注、参考文献，以及出版商提供的引文关系。
- 添加引用完整性报告、Markdown 复制与下载，以及可选的 YAML 元数据和图片链接。
- 添加自动英文／简体中文界面选择和持久化手动设置。
- 改进不同出版商页面上的作者列表、引用目标、行内公式、图注和空白规范化处理。
