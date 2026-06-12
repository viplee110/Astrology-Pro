# Astrology Pro

本地隐私优先的开源高精度星盘工具。

在线版：https://astrology-pro.vercel.app/

Astrology Pro 使用本地 vendored `swisseph-wasm` / Swiss Ephemeris 计算本命盘、行运、合盘与长期结构，并生成适合复制到 AI 工具中解读的结构化星盘资料。

## 产品定位

- 本地计算：出生资料在浏览器中处理，默认不上传服务器。
- 开源透明：源码公开，便于检查计算逻辑和隐私处理。
- 快速解释：内置基础星象含义库，帮助新手理解太阳、月亮、上升、宫位和重点相位。
- AI-ready：一键复制本命盘、行运、合盘、古典占星 Prompt。
- 专业排盘：Swiss Ephemeris、宫位制、黄道制、相位、四轴、虚点、恒星、宫主飞宫等结构化输出。

## 运行

双击：

```text
start-astrology.bat
```

它会启动本地服务器并打开 `http://localhost:4173`。如果电脑没有 Node.js，会提示是否安装 Node.js LTS。

也可以手动运行：

```powershell
cd "C:\Users\viplee\Dropbox\Vibe coding\Astrology"
& "C:\Users\viplee\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\scripts\server.mjs
```

然后打开 `http://localhost:4173`。

## 已实现

- 本命盘：日期、时间、地点、时区、经纬度、坐标精度标注。
- 地点库：中国地级市/区县离线搜索，自动填入经纬度和 IANA 时区偏移。
- 盘面显示：十二星座、十二宫、行星、四轴、相位线、逆行标记。
- 表格数据：行星落点、宫位、度数、速度、逆行、宫头、相位、容许度。
- 参数设置：宫位制、黄道制、相位类型、容许度、显示星体、小行星/虚点开关。
- 快速解释：核心落点、四轴、重点相位、宫位集中和相位格局的入门提示。
- AI 解读助手：复制本命盘、预测、合盘、古典占星 Prompt。
- 文字版星盘：完整、本命、预测、合盘、古典、自定义模板。
- 保存档案：个人档案、合盘对象类型、备注、标签、历史记录，全部保存在浏览器本地。
- 导出：PNG、PDF 打印、Markdown、TXT、CSV、JSON。
- 预测模块：行运、次限、太阳弧、太阳返照、月亮返照、90 天重要行运时间线。
- 关系模块：比较盘、组合中点盘、时空中点盘。
- 统计与古典模块：元素/模式、群星、相位格局、中点、阿拉伯点、庙旺弱陷、界、面、昼夜得时、接纳、互容。

## 验证

运行排盘回归检查：

```powershell
& "C:\Users\viplee\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\scripts\verify-chart.mjs
```

该脚本会检查默认样例的 UTC 换算、Swiss Ephemeris 初始化、核心星体位置、宫位、相位、虚点、Markdown 与 AI Prompt 生成，并将包装层结果与直接 Swiss Ephemeris 调用结果比对。

## 专业性说明

- 行星、宫位、恒星位置由 Swiss Ephemeris WASM 计算。
- 次限盘采用常用的“一日一年”换算。
- 太阳弧采用次限太阳与本命太阳的弧距。
- 返照采用目标日前后搜索并细化到最近回归点。
- PDF 使用浏览器打印为 PDF；这是纯前端方案下较稳的中文 PDF 路线。

## 隐私与免责声明

- 隐私政策：`privacy.html`
- 免责声明：`disclaimer.html`
- 开源说明：`NOTICE.md`
- 第三方声明：`THIRD_PARTY_NOTICES.md`

Astrology Pro 不主动上传出生资料。使用 AI Prompt 时，只有当你主动粘贴到第三方 AI 平台后，相关内容才会由对应平台处理。

## License

本项目公开版本采用 AGPL-3.0-or-later 路线，见 `LICENSE` 和 `NOTICE.md`。

`vendor/swisseph` 来自 `prolaxu/swisseph-wasm`，包装库为 GPL-3.0-or-later，底层 Swiss Ephemeris 采用 AGPL / Swiss Ephemeris Professional License 双路线。若后续做闭源或专有商业产品，需要确认 Swiss Ephemeris Professional License。
