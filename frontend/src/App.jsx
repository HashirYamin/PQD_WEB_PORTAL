import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CompaniesPage from './pages/CompaniesPage';
import CompanyProfilePage from './pages/CompanyProfilePage';
import DocumentsPage from './pages/DocumentsPage';
import ProjectsPage from './pages/ProjectsPage';
import SuppliersPage from './pages/SuppliersPage';
import MasterChecklistPage from './pages/MasterChecklistPage';
import ProjectChecklistsPage from './pages/ProjectChecklistsPage';
import CreatePqdPage from './pages/CreatePqdPage';
import GeneratedPqdsPage from './pages/GeneratedPqdsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="company-profile" element={<CompanyProfilePage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="master-checklist" element={<MasterChecklistPage />} />
        <Route path="project-checklists" element={<ProjectChecklistsPage />} />
        <Route path="create-pqd" element={<CreatePqdPage />} />
        <Route path="generated-pqds" element={<GeneratedPqdsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/signup" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{ duration: 3500 }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
