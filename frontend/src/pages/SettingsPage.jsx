import { useEffect, useState } from 'react';
import { BellRing, Mail, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LoadingBlock, PageHeader, WarningBox } from '../components/Common';

export default function SettingsPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const companyReady = user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);
  const [form, setForm] = useState({ daysBefore: '30,15,7', recipientEmails: '', frequency: 'DAILY', enabled: true });
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!companyReady) { setLoading(false); return; }
    setLoading(true);
    api.get(appendCompany('/settings/alerts')).then(({ data }) => setForm({ ...data.setting, daysBefore: (data.setting.daysBefore || []).join(',') })).finally(() => setLoading(false));
  };
  useEffect(load, [selectedCompanyId]);

  const save = async (event) => {
    event.preventDefault();
    try {
      const daysBefore = form.daysBefore.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item));
      await api.put('/settings/alerts', { ...form, daysBefore, companyId: selectedCompanyId || undefined });
      toast.success('Alert settings saved'); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save settings'); }
  };

  if (!companyReady) return <WarningBox title="Select a company">Choose a company before configuring its expiry alerts.</WarningBox>;
  if (loading) return <LoadingBlock />;

  return (
    <>
      <PageHeader title="Settings & Expiry Alerts" description="Configure how the portal warns company users about expiring legal and technical documents." />
      <div className="two-column-layout">
        <form className="panel-card form-card" onSubmit={save}>
          <div className="panel-heading"><div><h2>Expiry Alert Rules</h2><p>Daily checks compare document expiry dates with the configured reminder days.</p></div><BellRing size={22} /></div>
          <div className="form-grid one">
            <label>Reminder days before expiry<input value={form.daysBefore} onChange={(e) => setForm({ ...form, daysBefore: e.target.value })} placeholder="30,15,7" /><small>Use comma-separated values, for example 30, 15, 7.</small></label>
            <label>Recipient emails<textarea rows="4" value={form.recipientEmails || ''} onChange={(e) => setForm({ ...form, recipientEmails: e.target.value })} placeholder="admin@example.com, qa@example.com" /><small>Separate multiple addresses with commas.</small></label>
            <label>Frequency<select value={form.frequency || 'DAILY'} onChange={(e) => setForm({ ...form, frequency: e.target.value })}><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option></select></label>
            <label className="switch-row"><span><strong>Enable expiry alerts</strong><small>SMTP must also be enabled in the backend environment.</small></span><input type="checkbox" checked={Boolean(form.enabled)} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /></label>
          </div>
          <div className="form-actions"><button className="primary-button"><Save size={17} /> Save settings</button></div>
        </form>
        <div className="panel-card">
          <div className="panel-heading"><div><h2>Email Service Checklist</h2><p>Production email requires server-side SMTP configuration.</p></div><Mail size={22} /></div>
          <div className="settings-checklist"><div><span>1</span><p>Set <code>EMAIL_ENABLED=true</code> in backend <code>.env</code>.</p></div><div><span>2</span><p>Configure SMTP host, port, user, password, and sender address.</p></div><div><span>3</span><p>Keep recipient addresses company-specific in this screen.</p></div><div><span>4</span><p>Use persistent hosting and monitor failed delivery logs.</p></div></div>
        </div>
      </div>
    </>
  );
}
