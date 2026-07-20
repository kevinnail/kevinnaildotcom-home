// Shared section label: a lit blue tick + tracked caps, matching the project
// cards' category eyebrow so every tab reads as one system.
export default function SectionEyebrow({ label }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-3 w-[3px] bg-neon-blue shadow-[0_0_8px_rgba(47,0,255,0.9)]"
        aria-hidden="true"
      />
      <span className="text-[0.7rem] font-semibold uppercase tracking-[3px] text-white/50">
        {label}
      </span>
    </div>
  );
}
