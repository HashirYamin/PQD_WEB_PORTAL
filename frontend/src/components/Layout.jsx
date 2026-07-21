import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckSquare2,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  FileText,
  FolderKanban,
  Gauge,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  X
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import CompanyLogo from './CompanyLogo';

const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    icon: Gauge
  },
  {
    to: '/companies',
    label: 'Companies',
    icon: Building2,
    superOnly: true
  },
  {
    to: '/company-profile',
    label: 'Company Profile',
    icon: Building2
  },
  {
    to: '/documents',
    label: 'Documents',
    icon: FileText
  },
  {
    to: '/projects',
    label: 'Projects',
    icon: FolderKanban
  },
  {
    to: '/suppliers',
    label: 'Suppliers',
    icon: Truck
  },
  {
    to: '/master-checklist',
    label: 'Master Checklist',
    icon: CheckSquare2
  },
  {
    to: '/project-checklists',
    label: 'Project Checklists',
    icon: ClipboardList
  },
  {
    to: '/create-pqd',
    label: 'Create PQD',
    icon: FileCheck2
  },
  {
    to: '/generated-pqds',
    label: 'Generated PQDs',
    icon: FileText
  },
  {
    to: '/users',
    label: 'Users',
    icon: Users,
    adminOnly: true
  },
  {
    to: '/settings',
    label: 'Settings & Alerts',
    icon: Settings
  }
];
export default function Layout() {
  const { user, logout, selectedCompanyId, selectCompany } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
const selectedCompany =
  companies.find(
    (company) => company.id === selectedCompanyId
  ) || null;
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);
  useEffect(() => {
    api.get('/companies').then(({ data }) => {
      setCompanies(data.companies || []);
      if (!selectedCompanyId && data.companies?.length === 1) selectCompany(data.companies[0].id);
    }).catch(() => {});
  }, []);

  const doLogout = () => { logout(); navigate('/login'); };
  const visibleItems = navItems.filter((item) => {
    if (item.superOnly && user.role !== 'SUPER_ADMIN') return false;
    if (item.adminOnly && !['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) return false;
    return true;
  });

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><ShieldCheck size={21} /></div>
          <div><strong>PQD Web Portal</strong><span>Submission Automation</span></div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>
        <nav className="sidebar-nav">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              {to === '/company-profile' ? (
  <CompanyLogo
    companyId={selectedCompanyId}
    companyName={selectedCompany?.name}
    className="nav-company-logo"
    fallbackSize={18}
  />
) : (
  <Icon size={18} />
)}

<span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-mini"><div className="avatar">{user.name?.slice(0, 1)}</div><div><strong>{user.name}</strong><span>{user.role.replaceAll('_', ' ')}</span></div></div>
          <button className="nav-item logout-button" onClick={doLogout}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>
      {sidebarOpen && <button className="mobile-overlay" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <div className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
          <div className="topbar-title"><strong>PQD Workspace</strong><span>Manage documents, checklists, projects, and submissions</span></div>
          <div className="topbar-actions">
            {user.role === 'SUPER_ADMIN' && (
              <label className="company-select-wrap">
                <CompanyLogo
  companyId={selectedCompanyId}
  companyName={selectedCompany?.name}
  className="topbar-company-logo"
  fallbackSize={16}
/>
                <select value={selectedCompanyId} onChange={(event) => selectCompany(event.target.value)}>
                  <option value="">All companies</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
                <ChevronDown size={14} />
              </label>
            )}
            <div className="top-user"><div className="avatar">{user.name?.slice(0, 1)}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
