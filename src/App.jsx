import { Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import PageWrapper from './components/layout/PageWrapper';
import HomePage from './pages/HomePage';
import ProjectsPage from './pages/ProjectsPage';
import AstrophotographyPage from './pages/AstrophotographyPage';
import HikeMapPage from './pages/HikeMapPage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <>
      {import.meta.env.DEV && <Helmet titleTemplate="DEV - %s" />}
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
          path="/backpacking"
          element={
            <PageWrapper>
              <HikeMapPage />
            </PageWrapper>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PageWrapper>
              <DashboardPage />
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
    </>
  );
}
