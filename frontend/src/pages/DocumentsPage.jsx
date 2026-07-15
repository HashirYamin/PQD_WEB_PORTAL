import { useEffect, useMemo, useState } from 'react';
import { Archive, Download, FilePlus2, Filter, Pencil, Search, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { downloadWithAuth } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { EmptyState, LoadingBlock, PageHeader, StatusBadge, WarningBox } from '../components/Common';

const blank = { title: '', category: 'Certificates', issueDate: '', expiryDate: '', documentType: '', remarks: '', file: null };

export default function DocumentsPage() {
  const { selectedCompanyId, user, appendCompany } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [replacementFile, setReplacementFile] = useState(null);

  const companyReady = user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);
  const load = () => {
    if (!companyReady) { setLoading(false); return; }
    setLoading(true);
    api.get(appendCompany('/documents')).then(({ data }) => setDocuments(data.documents || [])).finally(() => setLoading(false));
  };
  useEffect(load, [selectedCompanyId]);

  const categories = useMemo(() => [...new Set(documents.map((doc) => doc.category))].sort(), [documents]);
  const filtered = documents.filter((doc) => (!search || `${doc.title} ${doc.originalName}`.toLowerCase().includes(search.toLowerCase())) && (!category || doc.category === category));

  const upload = async (event) => {
    event.preventDefault();
    if (!form.file) return toast.error('Choose a file');
    setSaving(true);
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => { if (key !== 'file' && value !== '') body.append(key, value); });
    body.append('file', form.file);
    if (selectedCompanyId) body.append('companyId', selectedCompanyId);
    try { await api.post('/documents', body); toast.success('Document uploaded'); setOpen(false); setForm(blank); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Upload failed'); }
    finally { setSaving(false); }
  };


  const openEdit = (doc) => {
    setEditForm({ id: doc.id, title: doc.title || '', category: doc.category || 'Other', issueDate: doc.issueDate || '', expiryDate: doc.expiryDate || '', documentType: doc.documentType || '', remarks: doc.remarks || '' });
    setReplacementFile(null);
    setEditOpen(true);
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put(appendCompany(`/documents/${editForm.id}`), editForm);
      if (replacementFile) {
        const body = new FormData();
        body.append('file', replacementFile);
        if (selectedCompanyId) body.append('companyId', selectedCompanyId);
        await api.post(appendCompany(`/documents/${editForm.id}/replace`), body);
      }
      toast.success('Document updated');
      setEditOpen(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update document');
    } finally { setSaving(false); }
  };

  const archive = async (id) => {
    if (!window.confirm('Archive this document? Existing PQD records will remain safe.')) return;
    try { await api.delete(appendCompany(`/documents/${id}`)); toast.success('Document archived'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Archive failed'); }
  };

  const download = async (doc) => {
    try { await downloadWithAuth(appendCompany(`/documents/${doc.id}/download`), doc.originalName); }
    catch { toast.error('Download failed'); }
  };

  if (!companyReady) return <WarningBox title="Select a company">Choose a company from the top-right selector before managing its document library.</WarningBox>;

  return (
    <>
      <PageHeader title="Document Library" description="Upload reusable legal and technical documents, track expiry dates, and map them into PQD submissions." actions={<button className="primary-button" onClick={() => setOpen(true)}><FilePlus2 size={17} /> Upload document</button>} />
      <div className="filter-bar"><div className="search-field"><Search size={17} /><input placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><label className="select-inline"><Filter size={16} /><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      {loading ? <LoadingBlock /> : !filtered.length ? <EmptyState title="No documents found" description="Upload a document or adjust the current filters." /> : <div className="table-card"><div className="table-wrap"><table><thead><tr><th>Document</th><th>Category</th><th>Issue Date</th><th>Expiry Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((doc) => <tr key={doc.id}><td><div className="document-cell"><div className="file-icon">PDF</div><div><strong>{doc.title}</strong><span>{doc.originalName}</span></div></div></td><td>{doc.category}</td><td>{doc.issueDate || '—'}</td><td>{doc.expiryDate || '—'}</td><td><StatusBadge status={doc.statusInfo?.key} label={doc.statusInfo?.label} /></td><td><div className="row-actions"><button className="icon-button" title="Edit metadata or replace file" onClick={() => openEdit(doc)}><Pencil size={17} /></button><button className="icon-button" title="Download" onClick={() => download(doc)}><Download size={17} /></button><button className="icon-button danger" title="Archive" onClick={() => archive(doc.id)}><Archive size={17} /></button></div></td></tr>)}</tbody></table></div></div>}
      <Modal open={open} title="Upload Document" onClose={() => setOpen(false)}>
        <form className="form-grid two" onSubmit={upload}>
          <label>Document title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. ISO 9001 Certificate" /></label>
          <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Certificates</option><option>Legal Documents</option><option>Company Documents</option><option>Technical Documents</option><option>Approvals</option><option>Datasheets</option><option>Reports</option><option>Catalogues</option><option>Warranty Letters</option><option>Other</option></select></label>
          <label>Issue date<input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></label>
          <label>Expiry date<input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></label>
          <label>Document type<input value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} placeholder="Certificate, Drawing, Report…" /></label>
          <label>File<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} required /></label>
          <label className="span-2">Remarks<textarea rows="3" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label>
          <div className="form-actions span-2"><button className="primary-button" disabled={saving}><Upload size={17} /> {saving ? 'Uploading…' : 'Upload document'}</button></div>
        </form>
      </Modal>
      <Modal open={editOpen} title="Edit Document" onClose={() => setEditOpen(false)}>
        {editForm && <form className="form-grid two" onSubmit={saveEdit}>
          <label>Document title<input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required /></label>
          <label>Category<select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}><option>Certificates</option><option>Legal Documents</option><option>Company Documents</option><option>Technical Documents</option><option>Approvals</option><option>Datasheets</option><option>Reports</option><option>Catalogues</option><option>Warranty Letters</option><option>Other</option></select></label>
          <label>Issue date<input type="date" value={editForm.issueDate} onChange={(e) => setEditForm({ ...editForm, issueDate: e.target.value })} /></label>
          <label>Expiry date<input type="date" value={editForm.expiryDate} onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })} /></label>
          <label>Document type<input value={editForm.documentType} onChange={(e) => setEditForm({ ...editForm, documentType: e.target.value })} /></label>
          <label>Replacement file (optional)<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => setReplacementFile(e.target.files?.[0] || null)} /></label>
          <label className="span-2">Remarks<textarea rows="3" value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></label>
          <div className="form-actions span-2"><button className="primary-button" disabled={saving}><Pencil size={17} /> {saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>}
      </Modal>
    </>
  );
}
