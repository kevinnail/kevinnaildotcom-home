import { describe, expect, it } from 'vitest';
import resume from '../data/resume';
import { buildResumePdf } from './resumePdf';

// jsPDF writes uncompressed content streams by default, so the drawn strings
// appear verbatim in the output. That makes it possible to assert on what
// actually lands in the file rather than just that a file was produced.
function pdfText(doc) {
  return doc.output();
}

describe('buildResumePdf', () => {
  it('produces a valid PDF containing the résumé content', () => {
    const doc = buildResumePdf({ resume });
    const output = pdfText(doc);

    expect(output.startsWith('%PDF')).toBe(true);
    expect(output).toContain('Kevin Nail');
    expect(output).toContain('SUMMARY');
    expect(output).toContain('PROJECTS');
    expect(output).toContain('TECH STACK');
    expect(output).toContain('WORK EXPERIENCE');
  });

  // A résumé that silently grows to two pages is the main regression risk when
  // content is added to src/data/resume.js.
  it('fits on a single page, with or without the phone line', () => {
    expect(buildResumePdf({ resume }).getNumberOfPages()).toBe(1);
    expect(buildResumePdf({ resume, phone: '555-010-1234' }).getNumberOfPages()).toBe(1);
  });

  it('draws real text rather than an embedded image', () => {
    const output = pdfText(buildResumePdf({ resume }));

    // A rasterized résumé would carry an image XObject and no text operators;
    // ATS parsers cannot read those.
    expect(output).toContain('/Subtype /Type1');
    expect(output).not.toContain('/Subtype /Image');
  });

  it('includes the phone number only when one is supplied', () => {
    const withPhone = pdfText(buildResumePdf({ resume, phone: '555-010-1234' }));
    expect(withPhone).toContain('555-010-1234');
  });

  it('omits the phone number when none is supplied', () => {
    // Guards the privacy rule: the deployed site builds without
    // VITE_RESUME_PHONE, so that download must not carry a number.
    const withoutPhone = pdfText(buildResumePdf({ resume }));
    expect(withoutPhone).not.toMatch(/\d{3}-\d{3}-\d{4}/);
  });

  it('flattens the multi-line template literals in the résumé data', () => {
    const output = pdfText(buildResumePdf({ resume }));

    // The data indents continuation lines for readability; drawing those raw
    // would put runs of spaces into the PDF.
    expect(output).not.toContain('        ');
  });

  it('throws when no résumé data is given', () => {
    expect(() => buildResumePdf({})).toThrow(/requires a resume object/i);
  });
});
