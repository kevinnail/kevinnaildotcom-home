// Builds the downloadable résumé PDF in the browser from src/data/resume.js.
//
// Text is drawn with jsPDF's text API, not rasterized from the DOM, so the
// output is real selectable/searchable text that applicant tracking systems can
// parse. The layout is deliberately single-column for the same reason — ATS
// parsers routinely mangle multi-column résumés, so this does not mirror the
// two-column web layout.
//
// Nothing is stored: the file is generated at click time from the same data the
// page renders, so it cannot drift out of sync.
import { jsPDF } from 'jspdf';

// Letter at 72dpi, in points — jsPDF's native unit here.
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = [17, 17, 17];
const MUTED = [110, 110, 110];
const LINK = [29, 78, 216];
const RULE = [165, 165, 165];

const BULLET_INDENT = 12;
const BULLET_TEXT_INDENT = 22;

// The résumé data uses multi-line template literals for readability. The browser
// collapses that indentation as HTML whitespace; a PDF will not, so it has to be
// flattened before measuring or drawing.
function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildResumePdf({ resume, phone } = {}) {
  if (!resume) throw new Error('buildResumePdf requires a resume object');

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let cursorY = MARGIN;

  const lineHeightFor = (fontSize) => fontSize * 1.22;

  function ensureSpace(height) {
    if (cursorY + height <= PAGE_HEIGHT - MARGIN) return;
    doc.addPage();
    cursorY = MARGIN;
  }

  function setStyle(fontSize, fontStyle, color) {
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
  }

  function writeParagraph(text, { fontSize, fontStyle = 'normal', color = INK, indent = 0 }) {
    setStyle(fontSize, fontStyle, color);
    const lines = doc.splitTextToSize(normalizeWhitespace(text), CONTENT_WIDTH - indent);
    const lineHeight = lineHeightFor(fontSize);
    lines.forEach((line) => {
      ensureSpace(lineHeight);
      doc.text(line, MARGIN + indent, cursorY + fontSize);
      cursorY += lineHeight;
    });
  }

  function writeBullets(items, fontSize) {
    const lineHeight = lineHeightFor(fontSize);
    items.forEach((item) => {
      setStyle(fontSize, 'normal', INK);
      const lines = doc.splitTextToSize(
        normalizeWhitespace(item),
        CONTENT_WIDTH - BULLET_TEXT_INDENT,
      );
      lines.forEach((line, lineIndex) => {
        ensureSpace(lineHeight);
        if (lineIndex === 0) doc.text('•', MARGIN + BULLET_INDENT, cursorY + fontSize);
        doc.text(line, MARGIN + BULLET_TEXT_INDENT, cursorY + fontSize);
        cursorY += lineHeight;
      });
    });
  }

  // Contact details and project links: laid out by advancing x so each piece can
  // carry its own clickable annotation.
  function writeInlineSegments(segments, fontSize, { indent = 0, separator = '  ·  ' } = {}) {
    const lineHeight = lineHeightFor(fontSize);
    ensureSpace(lineHeight);
    let cursorX = MARGIN + indent;
    segments.forEach((segment, index) => {
      if (index > 0) {
        setStyle(fontSize, 'normal', MUTED);
        doc.text(separator, cursorX, cursorY + fontSize);
        cursorX += doc.getTextWidth(separator);
      }
      if (segment.href) {
        setStyle(fontSize, 'normal', LINK);
        doc.textWithLink(segment.label, cursorX, cursorY + fontSize, { url: segment.href });
      } else {
        setStyle(fontSize, 'normal', INK);
        doc.text(segment.label, cursorX, cursorY + fontSize);
      }
      cursorX += doc.getTextWidth(segment.label);
    });
    cursorY += lineHeight;
  }

  function writeSectionHeading(title) {
    ensureSpace(26);
    cursorY += 7;
    setStyle(9.5, 'bold', INK);
    doc.text(title.toUpperCase(), MARGIN, cursorY + 9.5);
    cursorY += lineHeightFor(9.5) - 2;
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.7);
    doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY);
    cursorY += 5;
  }

  // ── Header ────────────────────────────────────────────────────────────────
  setStyle(19, 'bold', INK);
  doc.text(resume.name, MARGIN, cursorY + 19);
  cursorY += lineHeightFor(19) - 3;

  writeParagraph(resume.title, { fontSize: 9.5, color: MUTED });

  const contactSegments = [{ label: resume.location }];
  if (phone) contactSegments.push({ label: phone });
  contactSegments.push({ label: resume.email, href: `mailto:${resume.email}` });
  resume.links.forEach((link) => contactSegments.push({ label: link.label, href: link.href }));
  cursorY += 2;
  writeInlineSegments(contactSegments, 8.5);

  cursorY += 4;
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(1);
  doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY);

  // ── Summary ───────────────────────────────────────────────────────────────
  writeSectionHeading('Summary');
  writeParagraph(resume.summary, { fontSize: 8.5, color: INK });

  // ── Projects ──────────────────────────────────────────────────────────────
  writeSectionHeading('Projects');
  resume.projects.forEach((project, index) => {
    if (index > 0) cursorY += 5;
    writeParagraph(project.title, { fontSize: 9.4, fontStyle: 'bold' });
    writeParagraph(project.description, { fontSize: 8.5, color: MUTED });
    cursorY += 1;
    writeBullets(project.highlights, 8.5);
    cursorY += 2;
    writeInlineSegments(
      project.links.map((link) => ({ label: link.label, href: link.href })),
      7.5,
      { indent: BULLET_TEXT_INDENT, separator: '   ' },
    );
  });

  // ── Tech stack ────────────────────────────────────────────────────────────
  writeSectionHeading('Tech Stack');
  resume.techStack.forEach((group) => {
    const lineHeight = lineHeightFor(8.5);
    setStyle(8.5, 'bold', INK);
    const labelText = `${group.label}: `;
    const labelWidth = doc.getTextWidth(labelText);
    const lines = doc.splitTextToSize(
      normalizeWhitespace(group.items),
      CONTENT_WIDTH - BULLET_TEXT_INDENT - labelWidth,
    );
    lines.forEach((line, lineIndex) => {
      ensureSpace(lineHeight);
      if (lineIndex === 0) {
        setStyle(8.5, 'normal', INK);
        doc.text('•', MARGIN + BULLET_INDENT, cursorY + 8.5);
        setStyle(8.5, 'bold', INK);
        doc.text(labelText, MARGIN + BULLET_TEXT_INDENT, cursorY + 8.5);
      }
      setStyle(8.5, 'normal', INK);
      doc.text(
        line,
        MARGIN + BULLET_TEXT_INDENT + (lineIndex === 0 ? labelWidth : 0),
        cursorY + 8.5,
      );
      cursorY += lineHeight;
    });
    cursorY += 2;
  });

  // ── Work experience ───────────────────────────────────────────────────────
  writeSectionHeading('Work Experience');
  resume.experience.forEach((role, index) => {
    if (index > 0) cursorY += 5;
    writeParagraph(`${role.role}, ${role.company}`, { fontSize: 9.4, fontStyle: 'bold' });
    writeParagraph(role.description, { fontSize: 8.5, color: MUTED });
    cursorY += 1;
    writeBullets(role.highlights, 8.5);
  });

  return doc;
}

export function downloadResumePdf({ resume, phone, filename = 'kevin-nail-resume.pdf' } = {}) {
  const doc = buildResumePdf({ resume, phone });
  doc.save(filename);
  return doc;
}
