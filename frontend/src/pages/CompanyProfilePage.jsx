import { useEffect, useState } from 'react';
import { Building2, Save, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LoadingBlock, PageHeader, WarningBox } from '../components/Common';

const empty = { name: '', crNumber: '', address: '', contactPerson: '', email: '', phone: '' };

export default function CompanyProfilePage() {
  const { user, selectedCompanyId } = useAuth();
  const companyId = user.role === 'SUPER_ADMIN' ? selectedCompanyId : user.companyId;
  const [form, setForm] = useState(empty);
  const [logo, setLogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/companies/${companyId}`).then(({ data }) => setForm(data.company)).finally(() => setLoading(false));
  };
  useEffect(load, [companyId]);

  const save = async (event) => {
    event.preventDefault(); setSaving(true);
    try { await api.put(`/companies/${companyId}`, form); toast.success('Company profile saved'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not save profile'); }
    finally { setSaving(false); }
  };

  const uploadLogo = async () => {
    if (!logo) return toast.error('Choose a logo first');
    const body = new FormData(); body.append('logo', logo);
    try { await api.post(`/companies/${companyId}/logo`, body); toast.success('Logo uploaded'); setLogo(null); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Logo upload failed'); }
  };

  if (!companyId) return <WarningBox title="Select a company">Use the company selector in the top bar to open a company profile.</WarningBox>;
  if (loading) return <LoadingBlock />;

  return (
    <>
      <PageHeader title="Company Profile" description="Maintain legal, branding, and contact information used throughout the portal and generated PDFs." />
      <div className="two-column-layout">
        <form className="panel-card form-card" onSubmit={save}>
          <div className="panel-heading"><div><h2>Company Details</h2><p>These values are pulled automatically into PQD cover and information pages.</p></div></div>
          <div className="form-grid two">
            <label>Company name<input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>CR number<input value={form.crNumber || ''} onChange={(e) => setForm({ ...form, crNumber: e.target.value })} /></label>
            <label>Contact person<input value={form.contactPerson || ''} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
            <label>Email<input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Phone<input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="span-2">Address<textarea rows="4" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          </div>
          <div className="form-actions"><button className="primary-button" disabled={saving}><Save size={17} /> {saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
        <div className="panel-card">
          <div className="panel-heading"><div><h2>Company Branding</h2><p>Upload the logo displayed on generated cover and section pages.</p></div></div>
          <div className="logo-preview"><Building2 size={44} /><strong>{form.name}</strong><span>{form.logoPath ? 'A logo file is configured.' : 'No logo uploaded yet.'}</span></div>
          <label>Logo file<input type="file" accept="image/png,image/jpeg" onChange={(e) => setLogo(e.target.files?.[0] || null)} /></label>
          <button className="secondary-button full" type="button" onClick={uploadLogo}><Upload size={17} /> Upload logo</button>
        </div>
      </div>
    </>
  );
}
