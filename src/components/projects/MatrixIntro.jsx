import { useCallback, useEffect, useRef, useState } from 'react';

const BLACK_MS = 200;
const RAIN_MS = 2250;

const EXIT_MS = 550;

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FONT_SIZE = 16;

const RAIN_COLOR = '#2ecc71';

const MIN_FALL_SPEED = 0.5;
const MAX_FALL_SPEED = 1.1;

const RAIN_FRAME_MS = 40;

const STORAGE_KEY = 'projectsIntroPlayed';

const REMEMBER_INTRO = true;

export function shouldPlayIntro() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}

function markIntroPlayed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    /* no-op — see shouldPlayIntro */
  }
}

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
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

  const skipRef = useRef(skip);
  useEffect(() => {
    skipRef.current = skip;
  }, [skip]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    let drops = [];
    let speeds = [];
    let width = 0;
    let height = 0;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const columnCount = Math.floor(width / FONT_SIZE);
      const rowCount = Math.max(Math.floor(height / FONT_SIZE), 1);
      drops = Array.from({ length: columnCount }, () => -Math.random() * rowCount);
      speeds = Array.from(
        { length: columnCount },
        () => MIN_FALL_SPEED + Math.random() * (MAX_FALL_SPEED - MIN_FALL_SPEED),
      );
    }

    resize();
    window.addEventListener('resize', resize);

    let animationId = 0;
    let lastFrameAt = 0;
    let startedAt = 0;

    function drawRain() {
      context.fillStyle = 'rgba(0, 0, 0, 0.06)';
      context.fillRect(0, 0, width, height);
      context.fillStyle = RAIN_COLOR;
      context.font = `${FONT_SIZE}px ui-monospace, monospace`;

      for (let column = 0; column < drops.length; column++) {
        context.fillText(randomGlyph(), column * FONT_SIZE, drops[column] * FONT_SIZE);
        if (drops[column] * FONT_SIZE > height && Math.random() > 0.975) drops[column] = 0;
        drops[column] += speeds[column];
      }
    }

    function draw(timestamp) {
      animationId = window.requestAnimationFrame(draw);
      if (timestamp - lastFrameAt < RAIN_FRAME_MS) return;
      lastFrameAt = timestamp;
      if (startedAt === 0) startedAt = timestamp;

      const elapsed = timestamp - startedAt;
      if (elapsed < BLACK_MS) return;

      drawRain();
      if (elapsed - BLACK_MS >= RAIN_MS) skipRef.current();
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
      isExiting ? EXIT_MS : BLACK_MS + RAIN_MS + 600,
    );
    return () => window.clearTimeout(timerId);
  }, [isExiting, skip, onFinish]);

  useEffect(() => {
    if (REMEMBER_INTRO) markIntroPlayed();
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
