import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CheckSquare2, Pencil, Plus, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { EmptyState, LoadingBlock, PageHeader, StatusBadge, WarningBox } from '../components/Common';

const blank = { title: '', defaultStatus: 'YES', defaultRemark: '', isActive: true };

export default function MasterChecklistPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const companyReady = user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    if (!companyReady) { setLoading(false); return; }
    setLoading(true);
    api.get(appendCompany('/checklists/master')).then(({ data }) => setItems(data.items || [])).finally(() => setLoading(false));
  };
  useEffect(load, [selectedCompanyId]);

  const openCreate = () => { setEditingId(null); setForm(blank); setOpen(true); };
  const openEdit = (item) => { setEditingId(item.id); setForm({ title: item.title, defaultStatus: item.defaultStatus || '', defaultRemark: item.defaultRemark || '', isActive: item.isActive }); setOpen(true); };
  const save = async (event) => {
    event.preventDefault();
    try {
      editingId ? await api.put(appendCompany(`/checklists/master/${editingId}`), form) : await api.post('/checklists/master', { ...form, companyId: selectedCompanyId || undefined });
      toast.success(editingId ? 'Checklist item updated' : 'Checklist item added'); setOpen(false); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save checklist item'); }
  };

  const toggle = async (item) => {
    try { await api.put(appendCompany(`/checklists/master/${item.id}`), { isActive: !item.isActive }); toast.success(item.isActive ? 'Item deactivated' : 'Item activated'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Update failed'); }
  };

  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try { await api.post('/checklists/master/reorder', { ids: next.map((item) => item.id), companyId: selectedCompanyId || undefined }); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not update order'); load(); }
  };

  if (!companyReady) return <WarningBox title="Select a company">Choose a company before managing its Master Checklist.</WarningBox>;

  return (
    <>
      <PageHeader title="Master Checklist" description="The company-level source list of all possible requirements. Changes affect future project checklists only." actions={<button className="primary-button" onClick={openCreate}><Plus size={17} /> Add item</button>} />
      <div className="info-strip"><CheckSquare2 size={19} /><div><strong>Safe historical behavior</strong><span>Editing, reordering, or deactivating a Master Checklist item does not modify saved Project Checklists, existing PQD drafts, or generated PDFs.</span></div></div>
      {loading ? <LoadingBlock /> : !items.length ? <EmptyState title="No Master Checklist items" /> : <div className="table-card"><div className="table-wrap"><table><thead><tr><th>SN</th><th>Checklist Item</th><th>Default Status</th><th>Default Remark</th><th>State</th><th>Controls</th></tr></thead><tbody>{items.map((item, index) => <tr key={item.id} className={!item.isActive ? 'row-muted' : ''}><td>{index + 1}</td><td><strong>{item.title}</strong></td><td><StatusBadge status={item.defaultStatus} /></td><td>{item.defaultRemark || '—'}</td><td><StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} /></td><td><div className="row-actions"><button className="icon-button" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp size={16} /></button><button className="icon-button" onClick={() => move(index, 1)} disabled={index === items.length - 1}><ArrowDown size={16} /></button><button className="icon-button" onClick={() => openEdit(item)}><Pencil size={16} /></button><button className="icon-button" onClick={() => toggle(item)} title={item.isActive ? 'Deactivate' : 'Activate'}>{item.isActive ? <ToggleRight size={19} /> : <ToggleLeft size={19} />}</button></div></td></tr>)}</tbody></table></div></div>}
      <Modal open={open} title={editingId ? 'Edit Master Checklist Item' : 'Add Master Checklist Item'} onClose={() => setOpen(false)}>
        <form className="form-grid two" onSubmit={save}>
          <label className="span-2">Checklist item<textarea rows="3" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>Default status<select value={form.defaultStatus} onChange={(e) => setForm({ ...form, defaultStatus: e.target.value })}><option>YES</option><option>NO</option><option>NA</option><option>As Required</option><option>UNDER REVIEW</option><option>APPROVED</option><option>NOT SUBMITTED</option></select></label>
          <label>Active<select value={String(form.isActive)} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></label>
          <label className="span-2">Default remark<textarea rows="3" value={form.defaultRemark} onChange={(e) => setForm({ ...form, defaultRemark: e.target.value })} /></label>
          <div className="form-actions span-2"><button className="primary-button"><Save size={17} /> Save item</button></div>
        </form>
      </Modal>
    </>
  );
}
