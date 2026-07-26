import { useState } from 'react';

// One-time walkthrough shown the first time a visitor opens a photo on the map.
// Two steps: the zoom control (top-left of the globe) and the photo dock
// (bottom-centre). Each step dims the map and shows a bright callout with a
// pointer aimed at the element it describes.
//
// Positions mirror the targets' own placement — the zoom control's `left-3 top-3`
// in HikeGlobe and the dock's bottom strip (max-h-[40vh] + p-4) in HikePhotoDock.
// If either target moves, move its callout with it.
const STORAGE_KEY = 'hikeMapInstructionsSeen';

// localStorage throws in some privacy modes; a walkthrough is not worth breaking
// the page over, so a failed read just means "show it" and a failed write means
// it may show again.
function hasSeenInstructions() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markInstructionsSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Ignore — worst case the walkthrough shows again on the next visit.
  }
}

const STEPS = [
  {
    key: 'zoom',
    title: 'Set how close the map flies in',
    body: 'The − and + buttons pick how far the camera sits from the photo’s location. Press them any time to re-frame the spot you are looking at.',
    // Sits just below the zoom control, pointer up toward it.
    boxClassName: 'absolute left-3 top-20 max-w-xs',
    pointerClassName: 'absolute -top-1.5 left-6 h-3 w-3 rotate-45',
  },
  {
    key: 'dock',
    title: 'Step through the hike’s photos',
    body: 'The ‹ and › arrows move to the previous or next photo, and the map flies to each new location. Your zoom level stays where you last set it, so every photo is framed the same way.',
    // Desktop: sits above the photo dock. Mobile: the dock eats most of the
    // short viewport, so anchoring above it pushes the callout off the top where
    // it can't be scrolled back — pin it to the top of the map area instead and
    // let the pointer gesture down toward the dock.
    boxClassName:
      'absolute inset-x-3 top-3 md:inset-x-auto md:top-auto md:bottom-[42vh] md:left-1/2 md:max-w-xs md:-translate-x-1/2',
    pointerClassName: 'absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45',
  },
];

export default function HikeCoachMarks() {
  // Read once at mount. The parent only mounts this while the photo dock is open,
  // so a dismissed walkthrough stays dismissed: the next open remounts, re-reads
  // localStorage, and starts at null.
  const [stepIndex, setStepIndex] = useState(() => (hasSeenInstructions() ? null : 0));

  if (stepIndex == null) return null;

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  function dismiss() {
    markInstructionsSeen();
    setStepIndex(null);
  }

  function advance() {
    if (isLastStep) dismiss();
    else setStepIndex(stepIndex + 1);
  }

  return (
    <div
      className="absolute inset-0 z-40 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-mark-title"
    >
      <div
        className={`${step.boxClassName} rounded-lg bg-neon-blue-bright p-4 text-black shadow-xl`}
      >
        <div className={`${step.pointerClassName} bg-neon-blue-bright`} aria-hidden="true" />
        <h2 id="coach-mark-title" className="font-display text-lg font-bold">
          {step.title}
        </h2>
        <p className="mt-1 font-body text-sm leading-snug">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="font-body text-sm underline underline-offset-2"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={advance}
            className="rounded-full bg-black px-4 py-1.5 font-body text-sm text-white transition-colors hover:bg-neon-blue"
          >
            {isLastStep ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
