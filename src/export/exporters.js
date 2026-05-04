import { createCsv, createMarkdown, createPlainText } from "./markdown.js";
import { filenameSafe } from "../astro/format.js";

export function exportWorkbook(workbook, format, mode = "full") {
  const chart = workbook.natal || workbook;
  const base = filenameSafe(chart.input.profileName || "chart");
  if (format === "md") return downloadText(`${base}.md`, createMarkdown(workbook, mode), "text/markdown;charset=utf-8");
  if (format === "txt") return downloadText(`${base}.txt`, createPlainText(workbook, mode), "text/plain;charset=utf-8");
  if (format === "csv") return downloadText(`${base}.csv`, createCsv(workbook), "text/csv;charset=utf-8");
  if (format === "json") return downloadText(`${base}.json`, JSON.stringify(workbook, null, 2), "application/json;charset=utf-8");
  if (format === "png") return exportPng(`${base}.png`);
  if (format === "pdf") return exportPdf(workbook, mode);
}

export function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportPng(filename) {
  const svg = document.querySelector(".chart-svg");
  if (!svg) return;
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1440;
    canvas.height = 1440;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fffdf8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (!png) return;
      const pngUrl = URL.createObjectURL(png);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };
  image.src = url;
}

function exportPdf(workbook, mode) {
  const markdown = createMarkdown(workbook, mode);
  const html = markdownToPrintableHtml(markdown);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function markdownToPrintableHtml(markdown) {
  const body = markdown
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("### ")) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
      if (line.startsWith("|")) return `<pre>${escapeHtml(line)}</pre>`;
      if (line.startsWith("- ")) return `<p>${escapeHtml(line)}</p>`;
      return line ? `<p>${escapeHtml(line)}</p>` : "<br />";
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>星盘 PDF</title><style>body{font-family:"Microsoft YaHei",sans-serif;line-height:1.55;padding:32px;color:#1f2933}h1,h2,h3{page-break-after:avoid}pre{font-family:Consolas,"Microsoft YaHei",monospace;font-size:11px;white-space:pre-wrap;margin:0}</style></head><body>${body}</body></html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
