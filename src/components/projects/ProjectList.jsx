import projects from '../../data/projects';
import ProjectCard from './ProjectCard';

export default function ProjectList() {
  return (
    <div className="grid gap-6 px-2 py-4 md:px-4 lg:grid-cols-2">
      {projects.map((project, index) => (
        <ProjectCard
          key={project.title}
          project={project}
          index={index}
          featured={index === 0}
        />
      ))}
    </div>
  );
}
