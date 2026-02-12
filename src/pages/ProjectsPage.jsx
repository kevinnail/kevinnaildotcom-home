import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import ScrollToTop from '../components/layout/ScrollToTop';
import AnchorNav from '../components/projects/AnchorNav';
import BioSection from '../components/projects/BioSection';
import SectionHeader from '../components/projects/SectionHeader';
import ResumeEmbed from '../components/projects/ResumeEmbed';
import ProjectList from '../components/projects/ProjectList';
import DiagramsSection from '../components/projects/DiagramsSection';

export default function ProjectsPage() {
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

        <div className="bg-[#3d3d3d] w-full">
          <main className="block bg-black pb-5 lg:max-w-[1100px] lg:mx-auto lg:min-w-[1000px]">
            <section>
              <AnchorNav />

              <BioSection />

              <SectionHeader id="resume">Resume</SectionHeader>
              <ResumeEmbed />
            </section>

            <SectionHeader id="projects">Projects</SectionHeader>
            <ProjectList />

            <SectionHeader id="diagrams">Diagrams</SectionHeader>
            <DiagramsSection />
          </main>
        </div>

        <ScrollToTop />
      </div>
    </>
  );
}
