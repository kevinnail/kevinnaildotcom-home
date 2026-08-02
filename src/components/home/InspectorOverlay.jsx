/**
 * Devtools-style self-inspection overlay: on sustained hover the card outlines
 * its own structure the way an element inspector would, labelling the real
 * elements and classes that build this panel.
 *
 * Opt in per card with `inspector: true` in data/homeCards.js — it is the
 * coding card's payoff, and would be noise on the photography tiles.
 *
 * Deliberately NOT behind `motion-safe:`. Nothing here moves — it is a plain
 * cross-fade — and gating it hid the whole effect on any machine with Windows
 * animation effects switched off, which reports `prefers-reduced-motion: reduce`.
 *
 * The delay is pure CSS. Each region fades in on `group-hover` behind a
 * staggered `transition-delay`, so a cursor passing through leaves the card
 * untouched while someone who lingers gets the teardown. Nothing here runs on
 * a timer, holds state, or re-renders.
 */

/**
 * Region tones borrowed from the box-model colours a browser inspector uses:
 * blue for the element box, green for padding, orange for the text run.
 */
const TONES = {
  element: { box: 'border-[#6fa8dc] bg-[#6fa8dc]/10', tag: 'bg-[#1d3a57] text-[#bcd9f5]' },
  padding: { box: 'border-[#93c47d] bg-[#93c47d]/10', tag: 'bg-[#24401c] text-[#cfe8c2]' },
  text: { box: 'border-[#f6b26b] bg-[#f6b26b]/10', tag: 'bg-[#4a2f12] text-[#f7d7b0]' },
};

/**
 * Boxes are positioned in percentages so they track the tile as it resizes,
 * and they nest the way a real inspector's do: panel, then content column,
 * then the heading run inside it. The three labels take different corners
 * because the outer two boxes share a top-left origin.
 *
 * These approximate the layout in Card.jsx rather than measuring it. Sizes are
 * tuned against the `hero` tile, which is the only size that opts in today —
 * a ResizeObserver per card to shave pixels off a decorative overlay is not a
 * trade worth making.
 */
const REGIONS = [
  {
    key: 'article',
    label: '<article class="spotlight">',
    tone: 'element',
    delay: 'group-hover:delay-[420ms]',
    labelEdge: 'top',
    position: { inset: 0 },
  },
  {
    // Matches the `lg:w-3/4` content column. Below `lg` that column is full
    // width, but the overlay is hover-gated and so never renders on touch.
    key: 'content',
    label: '<div class="lg:w-3/4">',
    tone: 'padding',
    delay: 'group-hover:delay-[0ms]',
    labelEdge: 'bottom',
    position: { left: 0, top: 0, bottom: 0, width: '75%' },
  },
  {
    key: 'heading',
    label: '<h2 class="font-display">',
    tone: 'text',
    delay: 'group-hover:delay-[700ms]',
    labelEdge: 'top',
    position: { left: '3.5%', right: '45%', top: '42%', height: '13%' },
  },
];

export default function InspectorOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden" aria-hidden="true">
      {REGIONS.map(({ key, label, tone, delay, labelEdge, position }) => (
        <div
          key={key}
          style={position}
          className={
            'absolute border border-dashed opacity-0 transition-opacity duration-300 ' +
            'group-hover:opacity-100 ' +
            TONES[tone].box +
            ' ' +
            delay
          }
        >
          <span
            className={
              'absolute left-0 whitespace-nowrap px-1.5 py-0.5 font-mono text-[9px] ' +
              'leading-tight tracking-tight md:text-[10px] ' +
              (labelEdge === 'bottom' ? 'bottom-0 rounded-tr' : 'top-0 rounded-br') +
              ' ' +
              TONES[tone].tag
            }
          >
            {label}
          </span>
        </div>
      ))}

      {/* Closing beat: the thing the whole overlay exists to say. */}
      <span
        className={
          'absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 font-mono text-[9px] ' +
          'leading-tight text-neon-blue-bright opacity-0 transition-opacity duration-300 ' +
          'md:text-[10px] group-hover:opacity-100 group-hover:delay-[840ms]'
        }
      >
        no libraries — just CSS
      </span>
    </div>
  );
}
