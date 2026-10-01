import type { jsPDF } from "jspdf";
import type { DoctorSummaryResponse } from "@/types/api";
import robotoRegularUrl from "@/fonts/Roboto-Regular.ttf?url";
import robotoBoldUrl from "@/fonts/Roboto-Bold.ttf?url";
import robotoItalicUrl from "@/fonts/Roboto-Italic.ttf?url";

/**
 * PDF export for the doctor-visit summary.
 *
 * Why not jsPDF's built-in Helvetica? jsPDF writes standard fonts without a
 * /Widths array (see its putFont). Viewers still render, but text extractors
 * (copy/paste, indexing, some print drivers) guess at character advances and
 * scatter spurious spaces through every word. Embedding a real TTF makes
 * jsPDF write proper /Widths + a ToUnicode map, so the PDF is both visually
 * correct and cleanly extractable. The fonts are ~0.5 MB each and only
 * fetched from this lazily-imported module, so the main bundle and the modal
 * chunk never pay for them.
 */

/** Block-level markdown subset the summary prompt produces. */
type Block = { type: "h2" | "li" | "p"; text: string };

function renderMarkdown(md: string): Block[] {
  return md
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("## ")) return { type: "h2" as const, text: line.slice(3) };
      if (line.startsWith("- ") || line.startsWith("* ")) return { type: "li" as const, text: line.slice(2) };
      return { type: "p" as const, text: line };
    });
}

/** Inline markdown runs: **bold**, *italic*, `code`; plain text passes through. */
export type Run = { text: string; bold?: boolean; italic?: boolean };

export function parseInlineRuns(text: string): Run[] {
  const runs: Run[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    const token = m[0];
    if (token.startsWith("**")) runs.push({ text: token.slice(2, -2), bold: true });
    else if (token.startsWith("`")) runs.push({ text: token.slice(1, -1) });
    else runs.push({ text: token.slice(1, -1), italic: true });
    last = m.index + token.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

export type FontStyle = "normal" | "bold" | "italic";

type Layout = {
  /** Draw `text` in the given style at (x, y); returns its measured width. */
  text: (text: string, x: number, y: number, style: FontStyle) => number;
  /** Measured width of `text` in the given style at the active font size. */
  width: (text: string, style: FontStyle) => number;
};

function makeLayout(doc: jsPDF): Layout {
  return {
    text: (text, x, y, style) => {
      doc.setFont("Roboto", style);
      doc.text(text, x, y);
      return doc.getTextWidth(text);
    },
    width: (text, style) => {
      doc.setFont("Roboto", style);
      return doc.getTextWidth(text);
    },
  };
}

const isSpace = (s: string) => /^\s+$/.test(s);

/** Vite gives us the asset URL; jsPDF's addFileToVFS wants base64 content. */
async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load PDF font: ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Word-wrapped writer for a styled line (a sequence of markdown runs). Words
 * keep their run's style even when a wrap moves them to the next line, so
 * **bold** spans stay bold across breaks. Starts a new page when the line
 * would draw below `bottomY`. Returns the y position after the last line.
 */
function writeStyledLine(
  doc: jsPDF,
  layout: Layout,
  runs: Run[],
  opts: { x: number; y: number; size: number; topY: number; bottomY: number; gapAfter?: number }
): number {
  const { x, size, topY, bottomY } = opts;
  let y = opts.y;
  doc.setFontSize(size);
  const lineH = size * 1.5;
  const maxWidth = doc.internal.pageSize.getWidth() - 56 - x;

  type Tok = { text: string; style: FontStyle; w: number };
  const tokens: Tok[] = [];
  for (const run of runs) {
    const style: FontStyle = run.bold ? "bold" : run.italic ? "italic" : "normal";
    for (const part of run.text.split(/(\s+)/)) {
      if (part.length === 0) continue;
      tokens.push({ text: part, style, w: isSpace(part) ? layout.width(" ", style) : layout.width(part, style) });
    }
  }

  let line: Tok[] = [];
  let lineW = 0;
  const flush = () => {
    while (line.length > 0 && isSpace(line[line.length - 1].text)) {
      lineW -= line[line.length - 1].w;
      line.pop();
    }
    if (line.length === 0) return;
    if (y > bottomY) {
      doc.addPage();
      y = topY;
    }
    let cx = x;
    for (const tok of line) {
      layout.text(tok.text, cx, y, tok.style);
      cx += tok.w;
    }
    y += lineH;
    line = [];
    lineW = 0;
  };

  for (const tok of tokens) {
    if (isSpace(tok.text)) {
      if (line.length === 0) continue; // no leading spaces after a wrap
    } else if (line.length > 0 && lineW + tok.w > maxWidth) {
      flush();
    }
    line.push(tok);
    lineW += tok.w;
  }
  flush();

  if (opts.gapAfter) y += opts.gapAfter;
  return y;
}

export async function downloadDoctorSummaryPdf(sessionId: string, summary: DoctorSummaryResponse): Promise<void> {
  const { jsPDF: JsPDF } = await import("jspdf");

  const tierLabel =
    summary.meta.finalTier === 3
      ? "Emergency Care"
      : summary.meta.finalTier === 2
        ? "Specialist Referral"
        : "Self Care";

  const doc = new JsPDF({ unit: "pt", format: "a4" });

  const [robotoRegular, robotoBold, robotoItalic] = await Promise.all([
    fetchFontBase64(robotoRegularUrl),
    fetchFontBase64(robotoBoldUrl),
    fetchFontBase64(robotoItalicUrl),
  ]);
  doc.addFileToVFS("Roboto-Regular.ttf", robotoRegular);
  doc.addFileToVFS("Roboto-Bold.ttf", robotoBold);
  doc.addFileToVFS("Roboto-Italic.ttf", robotoItalic);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.addFont("Roboto-Italic.ttf", "Roboto", "italic");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const topY = 56;
  const bottomY = pageH - 64; // reserve space for the footer disclaimer
  const contentW = pageW - marginX * 2;
  const layout = makeLayout(doc);

  // Letterhead
  doc.setFont("Roboto", "bold");
  doc.setFontSize(17);
  doc.setTextColor(26, 22, 19);
  doc.text("Doctor Visit Summary", marginX, topY);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(168, 162, 158);
  doc.text("SalusCare - clinical handover note generated from the patient's own chat transcript", marginX, topY + 16);

  let y = topY + 38;

  // Metadata block
  doc.setDrawColor(231, 224, 216);
  doc.setLineWidth(1);
  doc.line(marginX, y, pageW - marginX, y);
  y += 14;
  doc.setFontSize(8.5);
  doc.setTextColor(87, 83, 78);
  doc.text(`Session ${sessionId}  |  Generated ${new Date(summary.generatedAt).toLocaleString()}`, marginX, y);
  y += 12;
  doc.text(`Final triage tier: ${tierLabel}  |  Assessments in session: ${summary.meta.assessmentCount}`, marginX, y);
  y += 16;

  // Sections from the markdown narrative, with inline bold/italic rendered
  // for real (the modal shows **bold** too - the PDF used to print the stars).
  for (const block of renderMarkdown(summary.narrative)) {
    if (block.type === "h2") {
      y += 8;
      doc.setTextColor(234, 88, 12); // orange section heads
      y = writeStyledLine(doc, layout, [{ text: block.text.toUpperCase(), bold: true }], {
        x: marginX,
        y,
        size: 11,
        topY,
        bottomY,
        gapAfter: 6,
      });
    } else if (block.type === "li") {
      if (y > bottomY) {
        doc.addPage();
        y = topY;
      }
      doc.setTextColor(26, 22, 19);
      // Bullet as a filled circle path instead of a glyph: immune to the
      // WinAnsi round-trip that would turn U+2022 into a middle dot.
      doc.setFillColor(26, 22, 19);
      doc.circle(marginX + 4, y - 3.4, 1.6, "F");
      y = writeStyledLine(doc, layout, parseInlineRuns(block.text), {
        x: marginX + 16,
        y,
        size: 10.5,
        topY,
        bottomY,
        gapAfter: 4,
      });
    } else {
      doc.setTextColor(87, 83, 78);
      y = writeStyledLine(doc, layout, parseInlineRuns(block.text), {
        x: marginX,
        y,
        size: 10.5,
        topY,
        bottomY,
        gapAfter: 6,
      });
    }
  }

  // Footer disclaimer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(231, 224, 216);
    doc.setLineWidth(1);
    doc.line(marginX, pageH - 44, pageW - marginX, pageH - 44);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 134, 128);
    doc.text(
      "Generated by SalusCare from the patient's own chat transcript. Informational only - not a diagnosis. No medication dosages are included by design.",
      marginX,
      pageH - 30,
      { maxWidth: contentW }
    );
  }

  doc.save(`saluscare-summary-${sessionId.slice(0, 8)}.pdf`);
}
