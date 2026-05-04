# 本地高精度星盘工作台

纯前端、本地优先的专业占星排盘工具。当前版本使用本地 vendored `swisseph-wasm` / Swiss Ephemeris 2.10.03 计算，不需要把出生资料上传服务器。

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

- 本命盘：日期、时间、地点、时区、经纬度、夏令时偏移、坐标精度标注。
- 地点库：中国地级市/区县离线搜索，自动填入经纬度和 IANA 时区偏移。
- 盘面显示：十二星座、十二宫、行星、四轴、相位线、逆行标记。
- 表格数据：行星落点、宫位、度数、速度、逆行、宫头、相位、容许度。
- 参数设置：宫位制、黄道制、相位类型、容许度、显示星体、小行星/虚点开关。
- 文字版星盘：完整、本命、预测、合盘、古典、自定义模板。
- 保存档案：个人档案、合盘对象类型、备注、标签、历史记录。
- 导出：PNG、PDF 打印、Markdown、TXT、CSV、JSON。
- 第二版模块：行运、次限、太阳弧、太阳返照、月亮返照、比较盘、组合中点盘、时空中点盘。
- 统计模块：元素/模式、群星、主要相位格局、中点、阿拉伯点。
- 古典模块：入庙/失势/擢升/落陷、界、面、昼夜得时、灼伤/光下、互容。
- 其他模块：恒星、行星时、星历表、90 天重要行运时间线。

## 专业性说明

- 行星、宫位、恒星位置由 Swiss Ephemeris WASM 计算。
- 次限盘采用常用的“一日一年”换算。
- 太阳弧采用次限太阳与本命太阳的弧距。
- 返照采用目标日前后搜索并细化到最近回归点。
- PDF 使用浏览器打印为 PDF；这是纯前端方案下最稳的中文 PDF 路线。

## License

本项目原创代码采用 MIT License，见 `LICENSE`。

第三方组件保留各自授权，见 `THIRD_PARTY_NOTICES.md`。

## 授权提醒

`vendor/swisseph` 来自 `prolaxu/swisseph-wasm`，包装库为 GPL-3.0-or-later，底层 Swiss Ephemeris 采用 GPL / 商业授权双许可。个人本地使用通常没有问题；如果后续做闭源商业产品，需要确认 Swiss Ephemeris Professional License。
