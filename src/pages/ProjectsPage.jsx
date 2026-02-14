import { Helmet } from 'react-helmet-async';
import { useState } from 'react';
import Banner from '../components/layout/Banner';
import ScrollToTop from '../components/layout/ScrollToTop';
import BioSection from '../components/projects/BioSection';
import ResumeEmbed from '../components/projects/ResumeEmbed';
import ProjectList from '../components/projects/ProjectList';
import DiagramsSection from '../components/projects/DiagramsSection';

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
              <div className="flex flex-wrap justify-center gap-2 p-3">
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
                        'px-4 py-2 rounded-md border font-display tracking-[3px] cursor-pointer transition-colors duration-300 ' +
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
                <p className="m-0 p-5 bg-mid-gray">
                  The projects below are all a React/ Node/ Express + Postgres stack.{' '}
                  <strong>At The Fire</strong> and <strong>Stress Less Glass</strong> are my biggest
                  projects, but don't miss the AI related work as well I've learned a lot from
                  building chatbots that run LLM's locally via Ollama, fine tuning system prompts
                  and various parameters (top_p, temperature, etc.). employing agents, building my
                  own MCP server, and semantic search with Postgres via WSL all with keeping
                  sensitive data encrypted. Read details below!
                </p>
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
