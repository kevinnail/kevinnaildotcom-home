import { useCallback, useEffect, useRef, useState } from 'react';

// The intro runs as five beats on one canvas clock: rain, converge, decode,
// hold, disperse. The disperse deliberately overlaps the CSS exit — the glyphs
// scatter as the page is already coming up underneath them.
const RAIN_MS = 3000;
const CONVERGE_MS = 1000;
const DECODE_MS = 1800;
const HOLD_MS = 100;
// Long enough to outlast the canvas's own CSS fade (0.45s delay + 0.9s), so the
// glyphs are still travelling when the last of them goes transparent.
const DISPERSE_MS = 1700;
const CLIMAX_MS = CONVERGE_MS + DECODE_MS + HOLD_MS + DISPERSE_MS;
const EXIT_MS = 3000;

// The scatter is the converge run backwards, in polar coordinates: each glyph
// keeps its angle and radius from a pivot, then the radius races outward while
// the angle rotates, which bends the straight escape into a spiral.
//
// The pivot is per letter, not per word. One pivot makes the whole word inflate
// like a single rigid ring; a pivot per letter means each one unwinds on its
// own centre, and since neighbouring letters counter-rotate their expanding
// clouds sweep through each other — the same tangle of crossing paths the
// converge has, run the other way.
const SWIRL_RADIANS = 1.1;
const ESCAPE_SPAN = 0.85; // of the larger viewport axis

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FONT_SIZE = 16;

// Two lines, always. On one line the twelve characters have to span the
// viewport, which leaves lowercase an x-height of about seven cells — too few
// to resolve the counters in "e" and "o" at any stroke weight, so it reads as
// texture. Halving the characters per line roughly doubles their height.
const MESSAGE_LINES = ['W E L C O M E'];

// The word is spelled on a finer grid than the rain falls on, since it has to
// carry the reveal by itself. Glyphs are drawn a little larger than their cell
// so neighbours touch and the strokes join up instead of dotting.
const MESSAGE_CELL_WIDE = 11;
const MESSAGE_CELL_NARROW = 6;
const NARROW_VIEWPORT = 640;
// Proportional, not a fixed number of pixels — a flat +2px is a gentle overlap
// at an 11px cell but a 33% one at 6px, which closes every counter on a phone.
const GLYPH_OVERSIZE = 1.15;

const RAIN_COLOR = '#2ecc71';
const LOCK_COLOR = '#8ea1ff'; // --color-neon-blue-bright

const SWEEP_FRAME_MS = 16;
const RAIN_FRAME_MS = 40;
const GLYPH_CYCLE_MS = 55;

const SESSION_KEY = 'projectsIntroPlayed';

export function shouldPlayIntro() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) !== 'true';
  } catch {
    return true;
  }
}

function markIntroPlayed() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, 'true');
  } catch {
    /* no-op — see shouldPlayIntro */
  }
}

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

/** Centroid of a set of cells, in canvas pixels. */
function cellsCenter(cells, messageCell) {
  if (cells.length === 0) return { x: 0, y: 0 };
  let columnSum = 0;
  let rowSum = 0;
  for (const cell of cells) {
    columnSum += cell.column;
    rowSum += cell.row;
  }
  return {
    x: (columnSum / cells.length) * messageCell,
    y: (rowSum / cells.length + 1) * messageCell,
  };
}

/** Groups cells into runs of the given coordinate separated by an empty slot. */
function splitByGaps(cells, coordinateOf) {
  const cellsByCoordinate = new Map();
  for (const cell of cells) {
    const coordinate = coordinateOf(cell);
    if (!cellsByCoordinate.has(coordinate)) cellsByCoordinate.set(coordinate, []);
    cellsByCoordinate.get(coordinate).push(cell);
  }

  const runs = [];
  let currentRun = null;
  let previousCoordinate = null;
  for (const coordinate of [...cellsByCoordinate.keys()].sort((first, second) => first - second)) {
    if (previousCoordinate === null || coordinate > previousCoordinate + 1) {
      currentRun = [];
      runs.push(currentRun);
    }
    currentRun.push(...cellsByCoordinate.get(coordinate));
    previousCoordinate = coordinate;
  }
  return runs;
}

/**
 * Splits the lit cells into one group per letter: first by the blank rows
 * between lines, then by the blank columns between characters. Two letters
 * whose strokes touch land in a single group, which only makes that group's
 * scatter a little wider — it degrades, it does not break.
 */
function groupCellsIntoLetters(cells) {
  const letters = [];
  for (const lineCells of splitByGaps(cells, (cell) => cell.row)) {
    letters.push(...splitByGaps(lineCells, (cell) => cell.column));
  }
  return letters;
}

/**
 * Rasterizes the message into the message grid and returns one target cell per
 * lit pixel. The text is rasterized tens of pixels tall, not hundreds, on
 * purpose: at this scale one source pixel is one falling glyph, so the word is
 * only ever spelled by the rain itself — nothing is drawn over the top of it.
 */
function buildMessageCells(columns, rows) {
  const lines = MESSAGE_LINES;
  const raster = document.createElement('canvas');
  raster.width = Math.max(columns, 1);
  raster.height = Math.max(rows, 1);
  const rasterContext = raster.getContext('2d');

  // Grow the type until the widest line spans most of the grid, or until the
  // block runs out of vertical room. The height budget is generous because
  // height is exactly what makes the letters resolve.
  let cellFontSize = 3;
  while (cellFontSize < rows) {
    const candidate = cellFontSize + 1;
    rasterContext.font = `bold ${candidate}px ui-monospace, monospace`;
    const widest = Math.max(...lines.map((line) => rasterContext.measureText(line).width));
    if (widest > columns * 0.82) break;
    if (candidate * 1.25 * lines.length > rows * 0.72) break;
    cellFontSize = candidate;
  }

  rasterContext.font = `bold ${cellFontSize}px ui-monospace, monospace`;
  rasterContext.textAlign = 'center';
  rasterContext.textBaseline = 'middle';
  rasterContext.fillStyle = '#fff';
  // A light outline on top of the fill widens the stems by about a cell either
  // side, so they converge as strokes rather than dotted lines. Kept light on
  // purpose — much more than this and the counters in "e" and "o" close up and
  // the word turns back into a slab.
  rasterContext.strokeStyle = '#fff';
  rasterContext.lineWidth = cellFontSize * 0.06;
  rasterContext.lineJoin = 'round';

  const cellLineHeight = cellFontSize * 1.25;
  const firstLineY = rows / 2 - ((lines.length - 1) * cellLineHeight) / 2;
  lines.forEach((line, lineIndex) => {
    const lineY = firstLineY + lineIndex * cellLineHeight;
    rasterContext.fillText(line, columns / 2, lineY);
    rasterContext.strokeText(line, columns / 2, lineY);
  });

  const { data } = rasterContext.getImageData(0, 0, raster.width, raster.height);
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // A low threshold on purpose: it keeps the antialiased edge pixels, which
      // thickens the strokes by a cell either side.
      const alpha = data[(row * raster.width + column) * 4 + 3];
      if (alpha > 55) cells.push({ column, row });
    }
  }

  return cells;
}

/**
 * One glyph per lit cell, each starting somewhere random on screen. The rain
 * has already filled the viewport by this point, so pulling start positions
 * from anywhere reads as the glyphs that are up there gathering, rather than as
 * new ones appearing.
 */
function buildParticles(cells, columns, width, height, messageCell) {
  const particles = [];

  groupCellsIntoLetters(cells).forEach((letterCells, letterIndex) => {
    const pivot = cellsCenter(letterCells, messageCell);
    // Alternating so adjacent letters always turn against each other, with the
    // magnitude jittered so they are not obviously mirrored.
    const letterSpin =
      (letterIndex % 2 === 0 ? 1 : -1) * SWIRL_RADIANS * (0.7 + Math.random() * 0.6);

    for (const cell of letterCells) {
      const targetX = cell.column * messageCell;
      const targetY = (cell.row + 1) * messageCell;
      const offsetX = targetX - pivot.x;
      const offsetY = targetY - pivot.y;
      const radius = Math.hypot(offsetX, offsetY);

      particles.push({
        startX: Math.random() * width,
        startY: Math.random() * height,
        targetX,
        targetY,
        glyph: randomGlyph(),
        // Left-to-right with jitter — the same resolve order as DecodeText.
        lockAt: (cell.column / Math.max(columns, 1)) * 0.7 + Math.random() * 0.25,
        // Polar form of the same target about this letter's pivot, precomputed
        // so the scatter costs one cos/sin per glyph per frame and nothing else.
        pivotX: pivot.x,
        pivotY: pivot.y,
        // A glyph sitting on the pivot has no meaningful angle to leave along,
        // so give it one rather than letting atan2(0, 0) send it due east.
        angle: radius < messageCell ? Math.random() * Math.PI * 2 : Math.atan2(offsetY, offsetX),
        radius,
        spin: letterSpin * (0.85 + Math.random() * 0.3),
        escape: 0.6 + Math.random() * 0.8,
      });
    }
  });

  return particles;
}

export default function MatrixIntro({ onReveal, onFinish }) {
  const canvasRef = useRef(null);
  const [isExiting, setIsExiting] = useState(false);

  const hasRevealedRef = useRef(false);
  const skip = useCallback(() => {
    if (hasRevealedRef.current) return;
    hasRevealedRef.current = true;
    setIsExiting(true);
    onReveal();
  }, [onReveal]);

  // The canvas loop owns the clock and triggers the exit when the bloom lands,
  // but it must not restart if the callback identity ever changes.
  const skipRef = useRef(skip);
  useEffect(() => {
    skipRef.current = skip;
  }, [skip]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    let drops = [];
    let messageCell = MESSAGE_CELL_WIDE;
    let messageColumns = 0;
    let messageRows = 0;
    let width = 0;
    let height = 0;
    let frameInterval = SWEEP_FRAME_MS;

    let particles = null;
    // A resize mid-climax re-gathers the word from scratch rather than trying to
    // remap targets onto a grid that no longer has the same cells.
    let needsRebuild = true;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drops = new Array(Math.floor(width / FONT_SIZE)).fill(1);
      messageCell = width < NARROW_VIEWPORT ? MESSAGE_CELL_NARROW : MESSAGE_CELL_WIDE;
      messageColumns = Math.floor(width / messageCell);
      messageRows = Math.floor(height / messageCell);
      needsRebuild = true;
    }

    resize();
    window.addEventListener('resize', resize);

    let animationId = 0;
    let lastFrameAt = 0;
    let lastGlyphSwapAt = 0;
    let startedAt = 0;
    let climaxStartedAt = 0;

    function drawRain() {
      if (drops.some((row) => row * FONT_SIZE > height)) frameInterval = RAIN_FRAME_MS;

      context.fillStyle = 'rgba(0, 0, 0, 0.06)';
      context.fillRect(0, 0, width, height);
      context.fillStyle = RAIN_COLOR;
      context.font = `${FONT_SIZE}px ui-monospace, monospace`;

      for (let column = 0; column < drops.length; column++) {
        context.fillText(randomGlyph(), column * FONT_SIZE, drops[column] * FONT_SIZE);
        if (drops[column] * FONT_SIZE > height && Math.random() > 0.975) drops[column] = 0;
        drops[column]++;
      }
    }

    function drawClimax(elapsed, timestamp) {
      const convergeProgress = clamp01(elapsed / CONVERGE_MS);
      const decodeProgress = clamp01((elapsed - CONVERGE_MS) / DECODE_MS);
      const disperseProgress = clamp01((elapsed - CONVERGE_MS - DECODE_MS - HOLD_MS) / DISPERSE_MS);

      // A heavier wash than the rain uses, so the leftover trails clear out
      // while the word assembles instead of smearing underneath it. It thins
      // again for the scatter, where smearing is the point — that is what draws
      // the motion streaks behind the escaping glyphs.
      const washAlpha = 0.06 + convergeProgress * 0.2 - disperseProgress * 0.16;
      context.fillStyle = `rgba(0, 0, 0, ${washAlpha})`;
      context.fillRect(0, 0, width, height);

      const shouldSwapGlyphs = timestamp - lastGlyphSwapAt > GLYPH_CYCLE_MS;
      if (shouldSwapGlyphs) lastGlyphSwapAt = timestamp;

      const gather = easeOutCubic(convergeProgress);
      // Ease-in-out, and both halves are load-bearing. The slow opening lets
      // each letter visibly unwind on its own pivot while it is still a
      // recognisable letter; the fast tail then throws everything outward so
      // the paths cross and the word is gone. A pure ease-in spends the whole
      // beat shearing and then vanishes; a pure ease-out scatters so fast that
      // the per-letter rotation never reads at all.
      const flight = easeInOutCubic(disperseProgress);
      const escapeDistance = flight * Math.max(width, height) * ESCAPE_SPAN;
      context.font = `${Math.round(messageCell * GLYPH_OVERSIZE)}px ui-monospace, monospace`;
      // Held on its own curve so the glyphs stay legible through the fast part
      // of the throw instead of dimming with it.
      context.globalAlpha = 1 - disperseProgress * disperseProgress;

      for (const particle of particles) {
        const isLocked = decodeProgress >= particle.lockAt;
        // Once they break formation they start flickering again, dissolving
        // back into the rain they came out of.
        if (shouldSwapGlyphs && (!isLocked || disperseProgress > 0)) {
          particle.glyph = randomGlyph();
        }

        let x = particle.startX + (particle.targetX - particle.startX) * gather;
        let y = particle.startY + (particle.targetY - particle.startY) * gather;

        if (disperseProgress > 0) {
          const angle = particle.angle + particle.spin * flight;
          const radius = particle.radius + escapeDistance * particle.escape;
          x = particle.pivotX + Math.cos(angle) * radius;
          y = particle.pivotY + Math.sin(angle) * radius;
        }

        context.fillStyle = isLocked ? LOCK_COLOR : RAIN_COLOR;
        context.fillText(particle.glyph, x, y);
      }

      context.globalAlpha = 1;
    }

    function draw(timestamp) {
      animationId = window.requestAnimationFrame(draw);
      if (timestamp - lastFrameAt < frameInterval) return;
      lastFrameAt = timestamp;
      if (startedAt === 0) startedAt = timestamp;

      // Skipping early cancels the climax, but never interrupts one already
      // running — the exit fade plays out over the top of it.
      if (climaxStartedAt === 0) {
        if (timestamp - startedAt < RAIN_MS || hasRevealedRef.current) {
          drawRain();
          return;
        }
        climaxStartedAt = timestamp;
        frameInterval = SWEEP_FRAME_MS;
      }

      if (needsRebuild) {
        const cells = buildMessageCells(messageColumns, messageRows);
        particles = buildParticles(cells, messageColumns, width, height, messageCell);
        needsRebuild = false;
      }

      // Nothing legible fits (a viewport smaller than a few cells) — keep the
      // rain and hand straight off to the exit.
      if (particles.length === 0) {
        drawRain();
        skipRef.current();
        return;
      }

      // The exit is triggered as the scatter begins, not after it, so the page
      // is already fading up while the glyphs are still flying apart.
      const elapsed = timestamp - climaxStartedAt;
      drawClimax(Math.min(elapsed, CLIMAX_MS), timestamp);
      if (elapsed >= CONVERGE_MS + DECODE_MS + HOLD_MS) skipRef.current();
    }

    animationId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(
      isExiting ? onFinish : skip,
      isExiting ? EXIT_MS : RAIN_MS + CLIMAX_MS + 600,
    );
    return () => window.clearTimeout(timerId);
  }, [isExiting, skip, onFinish]);

  useEffect(() => {
    //! markIntroPlayed();  // commented for testing/ development REMOVE COMMENT FOR PROD
    window.addEventListener('keydown', skip);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', skip);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [skip]);

  return (
    <div
      className={`matrix-intro${isExiting ? ' is-exiting' : ''}`}
      onClick={skip}
      role="presentation"
    >
      <div className="matrix-intro-backdrop" />
      <canvas ref={canvasRef} className="matrix-intro-canvas" aria-hidden="true" />
      <button type="button" className="matrix-intro-skip" onClick={skip}>
        skip intro →
      </button>
    </div>
  );
}
