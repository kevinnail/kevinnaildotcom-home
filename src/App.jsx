import { Routes, Route } from 'react-router-dom';
import PageWrapper from './components/layout/PageWrapper';
import HomePage from './pages/HomePage';
import ProjectsPage from './pages/ProjectsPage';
import AstrophotographyPage from './pages/AstrophotographyPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PageWrapper>
            <HomePage />
          </PageWrapper>
        }
      />
      <Route
        path="/projects"
        element={
          <PageWrapper>
            <ProjectsPage />
          </PageWrapper>
        }
      />
      <Route
        path="/astrophotography"
        element={
          <PageWrapper>
            <AstrophotographyPage />
          </PageWrapper>
        }
      />
      <Route
        path="*"
        element={
          <PageWrapper>
            <NotFoundPage />
          </PageWrapper>
        }
      />
    </Routes>
  );
}
