import { useState } from 'react';
import resume from '../../data/resume';
import SectionLabel from './SectionLabel';

// The phone number stays out of git. Set VITE_RESUME_PHONE in .env.local
// (gitignored) and it renders here and in the generated PDF, so a copy exported
// for job applications carries it. Vite inlines env vars into the bundle, so
// anything set here is public on the deployed site.
const localPhone = import.meta.env.VITE_RESUME_PHONE;

// Section heading inside the résumé: tracked caps over a hairline rule, which
// is what the printed version reads as too.
function ResumeSection({ title, children }) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="m-0 pb-1.5 border-b border-white/15 font-display font-bold uppercase tracking-[3px] text-base sm:text-lg">
        {title}
      </h2>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function HighlightList({ items, columns = 1 }) {
  return (
    <ul
      className={
        'm-0 mt-2 pl-5 list-disc space-y-1 text-[0.88rem] leading-[1.55] text-white/80 ' +
        (columns === 2 ? 'sm:columns-2 sm:gap-8 sm:space-y-0' : '')
      }
    >
      {items.map((item) => (
        <li key={item} className={columns === 2 ? 'break-inside-avoid sm:mb-1' : ''}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function ResumeLinks({ links }) {
  return (
    <ul className="resume-links m-0 mt-2 p-0 list-none space-y-0.5">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="text-[0.8rem] text-neon-blue-bright underline decoration-white/20 underline-offset-2 hover:decoration-current break-words"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function Resume() {
  const [downloadState, setDownloadState] = useState('idle');

  // jsPDF is only needed once someone actually wants the file, so it is loaded
  // on demand rather than shipped in the initial bundle.
  async function handleDownload() {
    setDownloadState('working');
    try {
      const { downloadResumePdf } = await import('../../lib/resumePdf');
      downloadResumePdf({ resume, phone: localPhone });
      setDownloadState('idle');
    } catch (error) {
      setDownloadState('error');
      console.error('Résumé PDF generation failed', error);
    }
  }

  return (
    <div className="px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <SectionLabel label="Résumé" />

        <div className="flex items-center gap-3">
          {downloadState === 'error' && (
            <span role="alert" className="text-sm text-red-400">
              Couldn&apos;t build the PDF — try again.
            </span>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadState === 'working'}
            className="px-4 py-2 rounded-md border border-white/20 bg-black font-display tracking-[2px] text-sm cursor-pointer transition-colors duration-300 hover:bg-white hover:text-black hover:border-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-blue disabled:opacity-50 disabled:cursor-default"
          >
            {downloadState === 'working' ? 'Building…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <article className="resume-document mt-5 rounded-2xl border border-white/[0.08] bg-neutral-950 p-6 sm:p-9">
        <header className="pb-3 border-b border-white/25">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="m-0 font-display font-bold tracking-[1px] text-3xl sm:text-4xl leading-none">
              {resume.name}
            </h1>
            <p className="resume-role m-0 font-display uppercase tracking-[3px] text-sm sm:text-base text-white/70">
              {resume.title}
            </p>
          </div>

          <p className="resume-contact m-0 mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.85rem] text-white/70">
            <span>{resume.location}</span>
            {localPhone && (
              <a href={`tel:${localPhone.replace(/-/g, '')}`} className="hover:text-white">
                {localPhone}
              </a>
            )}
            <a href={`mailto:${resume.email}`} className="hover:text-white">
              {resume.email}
            </a>
            {resume.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-neon-blue-bright hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </p>
        </header>

        <ResumeSection title="Summary">
          <p className="m-0 max-w-[80ch] text-[0.9rem] leading-[1.65] text-white/80">
            {resume.summary}
          </p>
        </ResumeSection>

        <ResumeSection title="Projects">
          <div className="space-y-6">
            {resume.projects.map((project) => (
              <div
                key={project.title}
                className="resume-entry grid gap-x-8 gap-y-2 sm:grid-cols-[1fr_minmax(0,240px)]"
              >
                <div>
                  <h3 className="m-0 font-display font-bold tracking-[0.5px] text-lg">
                    {project.title}
                  </h3>
                  <p className="m-0 mt-1 text-[0.85rem] leading-[1.55] text-white/70">
                    {project.description}
                  </p>
                  <HighlightList items={project.highlights} columns={project.columns} />
                </div>

                <ResumeLinks links={project.links} />
              </div>
            ))}
          </div>
        </ResumeSection>

        <ResumeSection title="Tech Stack">
          <ul className="m-0 pl-5 list-disc space-y-2 text-[0.88rem] leading-[1.55] text-white/80">
            {resume.techStack.map((group) => (
              <li key={group.label}>
                <span className="font-semibold text-white">{group.label}:</span> {group.items}
              </li>
            ))}
          </ul>
        </ResumeSection>

        <ResumeSection title="Work Experience">
          <div className="space-y-5">
            {resume.experience.map((role) => (
              <div key={`${role.company}-${role.role}`} className="resume-entry">
                <h3 className="m-0 font-display font-bold tracking-[0.5px] text-lg">
                  {role.role}, {role.company}
                </h3>
                <p className="m-0 mt-1 max-w-[80ch] text-[0.85rem] leading-[1.55] text-white/70">
                  {role.description}
                </p>
                <HighlightList items={role.highlights} />
              </div>
            ))}
          </div>
        </ResumeSection>
      </article>
    </div>
  );
}
