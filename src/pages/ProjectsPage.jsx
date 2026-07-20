import { Helmet } from 'react-helmet-async';
import { useState } from 'react';
import Banner from '../components/layout/Banner';
import ScrollToTop from '../components/layout/ScrollToTop';
import BioSection from '../components/projects/BioSection';
import ResumeEmbed from '../components/projects/ResumeEmbed';
import ProjectList from '../components/projects/ProjectList';
import DiagramsSection from '../components/projects/DiagramsSection';
import SectionEyebrow from '../components/projects/SectionEyebrow';

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState('projects');

  const tabs = [
    { key: 'projects', label: 'Projects' },
    { key: 'about', label: 'About' },
    { key: 'resume', label: 'Resume' },
    { key: 'diagrams', label: 'Diagrams' },
  ];

  return (
    <>
      <Helmet>
        <title>Kevin Nail | Projects</title>
        <meta
          name="description"
          content="Kevin Nail's web development portfolio featuring React, Node.js, Express projects, AI assistants, and more."
        />
        <link rel="canonical" href="https://kevinnail.com/projects" />
      </Helmet>

      {/* Blurred background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{
          backgroundImage: "url('/images/code.png')",
          filter: 'blur(8px)',
        }}
      />

      <div className="flex flex-col min-h-screen">
        <Banner />

        <div className="bg-black w-full">
          <main className="bg-black pb-5 max-w-[1100px] mx-auto w-full">
            <nav
              className="bg-black border-b border-white/10"
              role="tablist"
              aria-label="Projects page sections"
            >
              <div className="grid grid-cols-2 gap-2 p-3 sm:flex sm:flex-wrap sm:justify-center">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      id={`tab-${tab.key}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`tab-panel-${tab.key}`}
                      onClick={() => setActiveTab(tab.key)}
                      className={
                        'px-4 py-2 rounded-md border font-display tracking-[3px] cursor-pointer transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-blue ' +
                        (isActive
                          ? 'bg-white text-black border-white'
                          : 'bg-black text-white border-white/20 hover:bg-white hover:text-black hover:border-white')
                      }
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </nav>

            {activeTab === 'projects' && (
              <section id="tab-panel-projects" role="tabpanel" aria-labelledby="tab-projects">
                <div className="px-5 pt-5 pb-4 sm:px-6">
                  <SectionEyebrow label="Selected Work" />
                  <p className="mt-4 mb-0 max-w-[68ch] text-[0.92rem] leading-[1.65] text-white/70">
                    The bulk of my projects below are all a React / Node / Express + Postgres stack
                    with the recent addition of SQLite and React Native for my new iOS app{' '}
                    <strong className="text-white/90 font-semibold">Crop Planner</strong>.{' '}
                    <strong className="text-white/90 font-semibold">At The Fire</strong> and{' '}
                    <strong className="text-white/90 font-semibold">Stress Less Glass</strong>{' '}
                    (shipped- my actual glass business site) are my biggest projects, but don't miss
                    the AI work too! Took a deep dive on running LLMs locally with Ollama. I've
                    learned a lot building a RAG system for chatbots fine-tuning system prompts and
                    parameters (top_p, temperature, etc.), employing agents, building my own MCP
                    server, and semantic search with Postgres via WSL, all while keeping sensitive
                    data encrypted. Read details below on everything!
                  </p>
                </div>
                <ProjectList />
              </section>
            )}

            {activeTab === 'about' && (
              <section id="tab-panel-about" role="tabpanel" aria-labelledby="tab-about">
                <BioSection />
              </section>
            )}

            {activeTab === 'resume' && (
              <section id="tab-panel-resume" role="tabpanel" aria-labelledby="tab-resume">
                <ResumeEmbed />
              </section>
            )}

            {activeTab === 'diagrams' && (
              <section id="tab-panel-diagrams" role="tabpanel" aria-labelledby="tab-diagrams">
                <DiagramsSection />
              </section>
            )}
          </main>
        </div>

        <ScrollToTop />
      </div>
    </>
  );
}
