import { useEffect, useState } from 'react';
import { Building2, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import Modal from '../components/Modal';
import { EmptyState, LoadingBlock, PageHeader, StatusBadge } from '../components/Common';

const blank = { name: '', crNumber: '', contactPerson: '', email: '', phone: '', address: '' };

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/companies').then(({ data }) => setCompanies(data.companies || [])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault(); setSaving(true);
    try { await api.post('/companies', form); toast.success('Company created'); setOpen(false); setForm(blank); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not create company'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Companies" description="Create and manage isolated company workspaces." actions={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Add company</button>} />
      {loading ? <LoadingBlock /> : !companies.length ? <EmptyState title="No companies" /> : <div className="cards-grid">{companies.map((company) => <div className="entity-card" key={company.id}><div className="entity-icon"><Building2 size={22} /></div><div className="entity-content"><div className="entity-title"><strong>{company.name}</strong><StatusBadge status={company.isActive ? 'ACTIVE' : 'INACTIVE'} /></div><span>CR: {company.crNumber || '—'}</span><span>{company.contactPerson || 'No contact person'}</span><span>{company.email || 'No email'}</span></div></div>)}</div>}
      <Modal open={open} title="Create Company" onClose={() => setOpen(false)}>
        <form onSubmit={save} className="form-grid two">
          <label>Company name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>CR number<input value={form.crNumber} onChange={(e) => setForm({ ...form, crNumber: e.target.value })} /></label>
          <label>Contact person<input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="span-2">Address<textarea value={form.address} rows="3" onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <div className="form-actions span-2"><button className="primary-button" disabled={saving}><Save size={17} /> {saving ? 'Creating…' : 'Create company'}</button></div>
        </form>
      </Modal>
    </>
  );
}
