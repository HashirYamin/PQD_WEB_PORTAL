import { useEffect, useState } from 'react';
import { Download, FileCheck2, Pencil, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { downloadWithAuth } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { EmptyState, LoadingBlock, PageHeader, StatusBadge, WarningBox } from '../components/Common';

export default function GeneratedPqdsPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const companyReady = user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!companyReady) { setLoading(false); return; }
    setLoading(true);
    api.get(appendCompany('/pqds')).then(({ data }) => setSubmissions(data.submissions || [])).finally(() => setLoading(false));
  };
  useEffect(load, [selectedCompanyId]);

  const download = async (submission, version) => {
    try { await downloadWithAuth(appendCompany(`/pqds/${submission.id}/versions/${version.id}/download`), version.fileName); }
    catch { toast.error('Download failed'); }
  };

  if (!companyReady) return <WarningBox title="Select a company">Choose a company to review its PQD submissions.</WarningBox>;

  return (
    <>
      <PageHeader title="PQD Submissions" description="Review drafts, download generated files, and edit submissions to create a new version." actions={<button className="secondary-button" onClick={load}><RefreshCw size={17} /> Refresh</button>} />
      {loading ? <LoadingBlock /> : !submissions.length ? <EmptyState title="No PQD submissions" description="Create a draft from a saved Project Checklist." /> : <div className="table-card"><div className="table-wrap"><table><thead><tr><th>Submission</th><th>Project</th><th>Checklist</th><th>Status</th><th>Latest Version</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{submissions.map((submission) => {
        const latest = submission.generatedPdfs?.[0];
        return <tr key={submission.id}><td><div className="document-cell"><div className="file-icon"><FileCheck2 size={17} /></div><div><strong>{submission.title}</strong><span>Revision {submission.revision || '—'}</span></div></div></td><td>{submission.project?.name || '—'}</td><td>{submission.childChecklist?.name || '—'}</td><td><StatusBadge status={submission.status} /></td><td>{latest ? `v${latest.version}` : 'Not generated'}</td><td>{new Date(submission.updatedAt).toLocaleString()}</td><td><div className="version-actions"><div className="row-actions"><Link className="icon-button" title="Edit and regenerate" to={`/create-pqd?submission=${submission.id}`}><Pencil size={16} /></Link></div>{submission.generatedPdfs?.length > 0 && <div className="version-list">{submission.generatedPdfs.map((version) => <button key={version.id} className="version-button" onClick={() => download(submission, version)}><Download size={13} /> v{version.version}</button>)}</div>}</div></td></tr>;
      })}</tbody></table></div></div>}
    </>
  );
}
