import SectionEyebrow from './SectionEyebrow';

export default function ResumeEmbed() {
  return (
    <div className="px-5 py-6 sm:px-6">
      <SectionEyebrow label="Résumé" />

      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-neutral-950 p-2 sm:p-3">
        <div
          className="relative w-full overflow-hidden rounded-xl"
          style={{ paddingTop: '129.4118%' }}
        >
          <iframe
            loading="lazy"
            className="absolute inset-0 w-full h-full border-none p-0 m-0"
            src="https://www.canva.com/design/DAGnMhN9Dp0/YVWP0lSsTgW5hkJ_V9zwHA/view?embed"
            title="Kevin Nail Resume"
          />
        </div>
      </div>
    </div>
  );
}
