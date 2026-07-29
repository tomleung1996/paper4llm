# Chrome Web Store 商店文案——简体中文

[English](STORE_LISTING.md) | 简体中文

本文档用于向 Chrome Web Store Developer Dashboard 复制文案。

## 产品信息

- **名称：** Paper for LLMs：论文转 Markdown
- **简称：** Paper4LLM
- **简短说明：** 将论文页面转换为干净的 Markdown，并保留文内引用、参考文献、图片、表格和公式。
- **主要类别：** 效率工具（Productivity）
- **语言：** 简体中文
- **价格：** 免费
- **主页网址：** `https://github.com/tomleung1996/paper4llm`
- **支持网址：** `https://github.com/tomleung1996/paper4llm/issues`
- **隐私政策网址：** `https://github.com/tomleung1996/paper4llm/blob/main/PRIVACY.md`

## 详细说明

Paper for LLMs 将用户当前有权访问的学术论文页面转换为结构化 Markdown，适用于阅读、存档和大模型工作流。

主要功能：

- 保留标题、作者、机构、期刊元数据、摘要、关键词、标题层级、列表、表格、公式、图片、图注和脚注。
- 将文内引用链接到对应参考文献，并保留参考文献顺序、文本、DOI 和外部链接。
- 明确报告未映射的引用目标，不进行静默猜测。
- 支持 ScienceDirect、Wiley Online Library、Nature、SpringerLink、Science / AAAS、MDPI、Taylor & Francis、Frontiers、Oxford Academic、MIT Press Direct、IEEE Xplore、Wolters Kluwer/Ovid 与 SAGE 论文页面。
- 自动跟随 Chrome 界面语言，并提供持久化的中文／英文手动设置。
- 支持复制生成的 Markdown 或下载本地 `.md` 文件。

所有转换均由用户主动发起，并在当前浏览器标签页本地完成。Paper for LLMs 不会绕过登录、机构权限、付费墙或出版商验证，也不会上传论文内容。

Paper for LLMs 是独立项目，与所支持的出版商不存在隶属、合作或背书关系。出版商名称仅用于说明兼容性。

## 单一用途

将当前打开的受支持学术论文页面转换为结构化 Markdown，并保留文内引用到参考文献的链接。

## 权限用途说明

- **activeTab：** 用户调用扩展后访问当前论文标签页，判断页面是否受支持并启动转换。
- **scripting：** 当论文页面在扩展加载前已经打开，或页面中尚无可用内容脚本时，注入扩展包内的转换代码。
- **出版商特定的网站访问权限：** 仅在上列受支持出版商的论文网址上读取 DOM，以提取用户主动请求转换的论文内容。

提交前应确认本节与最终上传的 `manifest.json` 权限完全一致。

## 隐私披露

- **远程代码：** 不使用。所有可执行代码均包含在上传的扩展包中。
- **网页内容：** 仅在本地处理，用于生成用户主动请求的 Markdown。扩展不会上传、出售、共享或保留网页内容。
- **浏览记录／当前网址：** 当前论文网址仅在本地用于识别出版商和保留来源网址。扩展不会跨标签页或跨会话收集浏览历史。
- **用户设置：** 用户手动选择的界面语言偏好保存在本地，不会上传。
- **Limited Use：** 扩展对通过 Chrome API 获得的信息的使用符合 Chrome Web Store 用户数据政策，包括 Limited Use 要求。

## 审核员测试说明

Paper for LLMs 不需要账户或测试凭据。

1. 安装提交的扩展包。
2. 打开一篇代表性论文，建议优先使用：
   - `https://www.nature.com/articles/s41597-025-06434-2`
   - `https://link.springer.com/article/10.1007/s11192-024-05163-4`
   - `https://www.sciencedirect.com/science/article/pii/S0048733320301475`
   - `https://asistdl.onlinelibrary.wiley.com/doi/10.1002/asi.70104`
   - `https://www.science.org/doi/10.1126/sciadv.ads7738`
   - `https://direct.mit.edu/qss/article/doi/10.1162/qss_a_00346/126307/Teaching-counts-Open-Educational-Resources-as-an`
3. 如果出版商显示 Cookie 或人机验证页面，请先完成验证；扩展不会绕过该流程。
4. 点击 Paper for LLMs 图标，然后点击**转换当前论文**。
5. 确认输出包含 Markdown 标题和参考文献章节。
6. 确认完整性摘要显示参考文献数量以及已映射／未映射引用数量。
7. 将**界面语言**从**自动**切换为 English，再切换回中文，确认界面立即更新。
8. 复制 Markdown 或下载 `.md` 文件。

如果论文受到付费墙限制，扩展只转换审核员浏览器会话中当前可访问的内容。
