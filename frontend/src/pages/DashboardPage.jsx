import { useEffect, useState } from 'react';
import { Building2, CheckSquare2, FileCheck2, FileText, FolderKanban, Plus, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { EmptyState, LoadingBlock, PageHeader, StatusBadge } from '../components/Common';

const cards = [
  { key: 'documents', label: 'Total Documents', icon: FileText },
  { key: 'projects', label: 'Active Projects', icon: FolderKanban },
  { key: 'checklists', label: 'Project Checklists', icon: CheckSquare2 },
  { key: 'pqds', label: 'PQD Submissions', icon: FileCheck2 },
  { key: 'expiringSoon', label: 'Expiring Soon', icon: TriangleAlert },
  { key: 'expired', label: 'Expired Documents', icon: TriangleAlert }
];

export default function DashboardPage() {
  const { appendCompany, selectedCompanyId, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(appendCompany('/dashboard/summary')).then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, [selectedCompanyId]);

  return (
    <>
      <PageHeader title="Dashboard" description="A live overview of your PQD workspace." actions={<><Link className="secondary-button" to="/documents"><Plus size={17} /> Upload Document</Link><Link className="primary-button" to="/create-pqd"><Plus size={17} /> Create PQD</Link></>} />
      {loading ? <LoadingBlock /> : (
        <>
          <section className="stats-grid">
            {cards.map(({ key, label, icon: Icon }) => <div className="stat-card" key={key}><div className="stat-icon"><Icon size={20} /></div><div><span>{label}</span><strong>{data?.stats?.[key] ?? 0}</strong></div></div>)}
            {user.role === 'SUPER_ADMIN' && !selectedCompanyId && <div className="stat-card"><div className="stat-icon"><Building2 size={20} /></div><div><span>Companies</span><strong>{data?.stats?.companies ?? 0}</strong></div></div>}
          </section>
          <section className="dashboard-grid">
            <div className="panel-card">
              <div className="panel-heading"><div><h2>Recent PQD Submissions</h2><p>Latest drafts and generated versions.</p></div><Link to="/generated-pqds">View all</Link></div>
              {!data?.recentSubmissions?.length ? <EmptyState title="No submissions yet" description="Create a project checklist and start your first PQD." /> : <div className="table-wrap"><table><thead><tr><th>Submission</th><th>Project</th><th>Status</th><th>Version</th></tr></thead><tbody>{data.recentSubmissions.map((item) => <tr key={item.id}><td><strong>{item.title}</strong></td><td>{item.project?.name || '—'}</td><td><StatusBadge status={item.status} /></td><td>v{item.currentVersion || 0}</td></tr>)}</tbody></table></div>}
            </div>
            <div className="panel-card">
              <div className="panel-heading"><div><h2>Upcoming Expiry Alerts</h2><p>Documents requiring attention.</p></div><Link to="/documents">View all</Link></div>
              {!data?.expiringDocuments?.length ? <EmptyState title="No urgent expiry alerts" description="All dated documents are currently healthy." /> : <div className="compact-list">{data.expiringDocuments.map((doc) => <div className="compact-row" key={doc.id}><div><strong>{doc.title}</strong><span>{doc.category} · {doc.expiryDate || 'No date'}</span></div><StatusBadge status={doc.statusInfo?.key} label={doc.statusInfo?.label} /></div>)}</div>}
            </div>
            <div className="panel-card wide">
              <div className="panel-heading"><div><h2>Recent Activity</h2><p>Important actions recorded for audit visibility.</p></div></div>
              {!data?.recentActivity?.length ? <EmptyState title="No activity recorded" /> : <div className="activity-list">{data.recentActivity.map((entry) => <div className="activity-row" key={entry.id}><div className="activity-dot" /><div><strong>{entry.action.replaceAll('_', ' ')}</strong><span>{entry.entityType || 'System'} · {entry.user?.name || 'System'} · {new Date(entry.createdAt).toLocaleString()}</span></div></div>)}</div>}
            </div>
          </section>
        </>
      )}
    </>
  );
}
