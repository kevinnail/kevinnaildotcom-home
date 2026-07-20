import { useEffect, useRef, useState } from 'react';

const GLYPHS = '!<>-_\\/[]{}=+*^?#§$%&';

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Renders `text`, but when `start` first flips true it scrambles each character
 * through random glyphs and resolves them left-to-right — a "decoding" reveal.
 * Runs once. Same character count throughout, so there's no layout shift.
 */
export default function DecodeText({ text, start, className }) {
  const [output, setOutput] = useState(text);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!start || hasRun.current) return;
    hasRun.current = true;

    // output already initializes to the final text, so reduced-motion needs no
    // work — just skip the scramble.
    if (prefersReducedMotion()) return;

    const characters = [...text];
    const totalFrames = 34;
    // Each non-space character locks in at a staggered frame, so the word
    // resolves progressively rather than all at once.
    const resolveFrame = characters.map(
      (_character, index) =>
        Math.floor((index / characters.length) * (totalFrames * 0.7)) +
        Math.floor(Math.random() * 6),
    );

    let frame = 0;
    const intervalId = setInterval(() => {
      setOutput(
        characters
          .map((character, index) => {
            if (character === ' ') return ' ';
            if (frame >= resolveFrame[index]) return character;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join(''),
      );

      frame += 1;
      if (frame > totalFrames) {
        clearInterval(intervalId);
        setOutput(text);
      }
    }, 45);

    return () => clearInterval(intervalId);
  }, [start, text]);

  // A full-width block spacer holds the final text's exact box — it lays out
  // identically to the plain title (same wrap points) and is what screen readers
  // announce. The scrambling layer is absolutely positioned on top and clipped,
  // so wider glyphs during decode can neither reflow siblings nor overlap them.
  return (
    <span className={'relative block overflow-hidden ' + (className ?? '')}>
      <span className="opacity-0">{text}</span>
      <span className="absolute inset-0" aria-hidden="true">
        {output}
      </span>
    </span>
  );
}
