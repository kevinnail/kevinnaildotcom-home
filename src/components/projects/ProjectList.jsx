import projects from '../../data/projects';
import ProjectCard from './ProjectCard';

export default function ProjectList() {
  return (
    <div>
      {projects.map((project) => (
        <ProjectCard key={project.title} project={project} />
      ))}
    </div>
  );
}
