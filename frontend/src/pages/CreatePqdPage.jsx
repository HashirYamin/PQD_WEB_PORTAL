import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileCheck2, FileDown, Play, Save } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { downloadWithAuth } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { EmptyState, LoadingBlock, PageHeader, StatusBadge, WarningBox } from '../components/Common';

export default function CreatePqdPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const companyReady = user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [checklistId, setChecklistId] = useState('');
  const [submission, setSubmission] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadBase = async () => {
    if (!companyReady) { setLoading(false); return; }
    setLoading(true);
    const [projectsRes, documentsRes] = await Promise.all([api.get(appendCompany('/projects')), api.get(appendCompany('/documents'))]);
    setProjects(projectsRes.data.projects || []);
    setDocuments(documentsRes.data.documents || []);
    const submissionId = searchParams.get('submission');
    if (submissionId) {
      const { data } = await api.get(appendCompany(`/pqds/${submissionId}`));
      setSubmission(data.submission); setValidation(data.validation);
      setProjectId(data.submission.projectId); setChecklistId(data.submission.childChecklistId);
    } else {
      setProjectId(projectsRes.data.projects?.[0]?.id || '');
    }
    setLoading(false);
  };
  useEffect(() => { loadBase().catch((error) => { toast.error(error.response?.data?.message || 'Could not load PQD builder'); setLoading(false); }); }, [selectedCompanyId]);

  useEffect(() => {
    if (!projectId) { setChecklists([]); return; }
    api.get(appendCompany(`/checklists/project?projectId=${projectId}`)).then(({ data }) => {
      const active = (data.checklists || []).filter((item) => item.isActive);
      setChecklists(active);
      if (!submission) setChecklistId(active[0]?.id || '');
    });
  }, [projectId, selectedCompanyId]);

  const activeDocuments = useMemo(() => documents.filter((doc) => !doc.isArchived), [documents]);
  const createDraft = async () => {
    if (!projectId || !checklistId) return toast.error('Select a project and a saved Project Checklist');
    setBusy(true);
    try {
      const { data } = await api.post('/pqds', { companyId: selectedCompanyId || undefined, projectId, childChecklistId: checklistId });
      setSubmission(data.submission); setValidation(null); setSearchParams({ submission: data.submission.id }); toast.success('PQD draft created');
    } catch (error) { toast.error(error.response?.data?.message || 'Could not create draft'); }
    finally { setBusy(false); }
  };

  const changeItem = (id, field, value) => {
    setSubmission((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, [field]: value } : item) }));
  };
  const saveDraft = async () => {
    setBusy(true);
    try {
      const { data } = await api.put(appendCompany(`/pqds/${submission.id}`), {
        title: submission.title,
        revision: submission.revision,
        items: submission.items.map((item, index) => ({ id: item.id, titleSnapshot: item.titleSnapshot, status: item.status, remarks: item.remarks, includeInPdf: item.includeInPdf, sortOrder: index + 1, documentId: item.documentId || item.document?.id || null }))
      });
      setSubmission(data.submission); setValidation(data.validation); toast.success('Draft saved'); return data.submission;
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save draft'); return null; }
    finally { setBusy(false); }
  };

  const generate = async (overrides = {}) => {
    const saved = await saveDraft();
    if (!saved) return;
    setBusy(true);
    try {
      const { data } = await api.post(appendCompany(`/pqds/${submission.id}/generate`), overrides);
      toast.success(`PDF version ${data.generatedPdf.version} generated`);
      const refreshed = await api.get(appendCompany(`/pqds/${submission.id}`));
      setSubmission(refreshed.data.submission); setValidation(refreshed.data.validation);
    } catch (error) {
      if (error.response?.status === 409) {
        const warnings = error.response.data.validation;
        setValidation(warnings);
        const message = `This PQD has ${warnings.missing.length} missing and ${warnings.expired.length} expired document(s). Generate anyway?`;
        if (window.confirm(message)) return generate({ allowMissing: true, allowExpired: true });
      } else toast.error(error.response?.data?.message || 'PDF generation failed');
    } finally { setBusy(false); }
  };

  const downloadLatest = async () => {
    const latest = submission.generatedPdfs?.[0];
    if (!latest) return;
    try { await downloadWithAuth(appendCompany(`/pqds/${submission.id}/versions/${latest.id}/download`), latest.fileName); }
    catch { toast.error('Download failed'); }
  };

  if (!companyReady) return <WarningBox title="Select a company">Choose a company before creating a PQD.</WarningBox>;
  if (loading) return <LoadingBlock />;
  if (!projects.length) return <WarningBox title="Create a project first">A PQD must be linked to a project and one saved Project Checklist.</WarningBox>;

  return (
    <>
      <PageHeader title="Create / Edit PQD" description="Select one saved Project Checklist, map supporting documents, validate, and generate the final submission." actions={submission && <><button className="secondary-button" onClick={saveDraft} disabled={busy}><Save size={17} /> Save draft</button><button className="primary-button" onClick={() => generate()} disabled={busy}><Play size={17} /> Generate PDF</button></>} />
      {!submission ? (
        <div className="panel-card setup-card">
          <div className="step-badge">Step 1</div><h2>Select Project and Project Checklist</h2><p>The portal shows only child checklists saved under the selected project.</p>
          <div className="form-grid two">
            <label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} {project.number ? `(${project.number})` : ''}</option>)}</select></label>
            <label>Saved Project Checklist<select value={checklistId} onChange={(e) => setChecklistId(e.target.value)}><option value="">Select checklist</option>{checklists.map((checklist) => <option key={checklist.id} value={checklist.id}>{checklist.name} ({checklist.items?.length || 0} items)</option>)}</select></label>
          </div>
          {!checklists.length && <WarningBox title="No Project Checklist available">Create and save a child checklist for this project before starting the PQD.</WarningBox>}
          <button className="primary-button" onClick={createDraft} disabled={busy || !checklistId}><FileCheck2 size={18} /> {busy ? 'Creating…' : 'Create PQD draft'}</button>
        </div>
      ) : (
        <div className="pqd-builder-layout">
          <section className="panel-card pqd-items-panel">
            <div className="builder-toolbar compact-toolbar">
              <label className="grow">Submission title<input value={submission.title || ''} onChange={(e) => setSubmission({ ...submission, title: e.target.value })} /></label>
              <label>Revision<input value={submission.revision || ''} onChange={(e) => setSubmission({ ...submission, revision: e.target.value })} /></label>
              <div className="readonly-field"><span>Project</span><strong>{submission.project?.name}</strong></div>
              <div className="readonly-field"><span>Checklist</span><strong>{submission.childChecklist?.name}</strong></div>
            </div>
            <div className="pqd-item-list">
              {submission.items?.map((item, index) => <div className={`pqd-item-row ${!item.includeInPdf ? 'excluded' : ''}`} key={item.id}>
                <label className="include-check"><input type="checkbox" checked={Boolean(item.includeInPdf)} onChange={(e) => changeItem(item.id, 'includeInPdf', e.target.checked)} /><span>{index + 1}</span></label>
                <div className="pqd-item-main"><strong>{item.titleSnapshot}</strong><div className="pqd-fields"><label>Document<select value={item.documentId || item.document?.id || ''} onChange={(e) => changeItem(item.id, 'documentId', e.target.value)}><option value="">No document attached</option>{activeDocuments.map((doc) => <option key={doc.id} value={doc.id}>{doc.title} — {doc.statusInfo?.label}</option>)}</select></label><label>Status<select value={item.status || ''} onChange={(e) => changeItem(item.id, 'status', e.target.value)}><option value="">Select status</option><option>YES</option><option>NO</option><option>NA</option><option>APPROVED</option><option>UNDER REVIEW</option><option>NOT SUBMITTED</option><option>As Required</option></select></label><label className="remarks-field">Remarks<input value={item.remarks || ''} onChange={(e) => changeItem(item.id, 'remarks', e.target.value)} /></label></div></div>
              </div>)}
            </div>
          </section>
          <aside className="pqd-summary-column">
            <div className="panel-card sticky-card"><div className="panel-heading"><div><h2>Submission Summary</h2><p>Current draft health and output versions.</p></div></div>
              <div className="summary-lines"><div><span>Total items</span><strong>{submission.items?.length || 0}</strong></div><div><span>Included</span><strong>{submission.items?.filter((item) => item.includeInPdf).length || 0}</strong></div><div><span>Attached</span><strong>{submission.items?.filter((item) => item.includeInPdf && (item.documentId || item.document)).length || 0}</strong></div><div><span>Generated version</span><strong>v{submission.currentVersion || 0}</strong></div></div>
              {validation && <div className="validation-summary"><div className={validation.missing.length ? 'validation-line bad' : 'validation-line good'}>{validation.missing.length ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<span>{validation.missing.length} missing documents</span></div><div className={validation.expired.length ? 'validation-line bad' : 'validation-line good'}>{validation.expired.length ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<span>{validation.expired.length} expired documents</span></div><div className={validation.expiringSoon.length ? 'validation-line warn' : 'validation-line good'}>{validation.expiringSoon.length ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<span>{validation.expiringSoon.length} expiring soon</span></div></div>}
              <div className="button-stack"><button className="secondary-button full" onClick={saveDraft} disabled={busy}><Save size={17} /> Save and validate</button><button className="primary-button full" onClick={() => generate()} disabled={busy}><Play size={17} /> Generate final PDF</button>{submission.generatedPdfs?.length > 0 && <button className="secondary-button full" onClick={downloadLatest}><FileDown size={17} /> Download latest PDF</button>}</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
