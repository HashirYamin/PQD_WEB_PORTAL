import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ClipboardList, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { EmptyState, LoadingBlock, PageHeader, StatusBadge, WarningBox } from '../components/Common';

const toSelected = (master) => ({
  key: master.id,
  masterItemId: master.id,
  titleSnapshot: master.title,
  status: master.defaultStatus || '',
  remarks: master.defaultRemark || ''
});

export default function ProjectChecklistsPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const companyReady = user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);
  const [projects, setProjects] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  const [saved, setSaved] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadBase = async () => {
    if (!companyReady) { setLoading(false); return; }
    setLoading(true);
    const [projectsRes, masterRes] = await Promise.all([
      api.get(appendCompany('/projects')),
      api.get(appendCompany('/checklists/master?active=true'))
    ]);
    const projectRows = projectsRes.data.projects || [];
    setProjects(projectRows);
    setMasterItems(masterRes.data.items || []);
    setProjectId((current) => current || projectRows[0]?.id || '');
    setLoading(false);
  };
  useEffect(() => { loadBase().catch(() => setLoading(false)); }, [selectedCompanyId]);

  const loadSaved = async () => {
    if (!projectId) { setSaved([]); return; }
    const { data } = await api.get(appendCompany(`/checklists/project?projectId=${projectId}`));
    setSaved(data.checklists || []);
  };
  useEffect(() => {
    loadSaved();
    setEditingId(null);
    setName('');
    setDescription('');
    setSelectedItems([]);
  }, [projectId]);

  const selectedMap = useMemo(() => new Set(selectedItems.map((item) => item.masterItemId).filter(Boolean)), [selectedItems]);

  const toggleItem = (master) => {
    if (selectedMap.has(master.id)) setSelectedItems(selectedItems.filter((item) => item.masterItemId !== master.id));
    else setSelectedItems([...selectedItems, toSelected(master)]);
  };
  const removeSelected = (key) => setSelectedItems(selectedItems.filter((item) => item.key !== key));
  const updateSelected = (key, field, value) => setSelectedItems(selectedItems.map((item) => item.key === key ? { ...item, [field]: value } : item));
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= selectedItems.length) return;
    const next = [...selectedItems];
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedItems(next);
  };
  const resetBuilder = () => { setEditingId(null); setName(''); setDescription(''); setSelectedItems([]); };

  const editChecklist = (checklist) => {
    setEditingId(checklist.id);
    setName(checklist.name);
    setDescription(checklist.description || '');
    setSelectedItems((checklist.items || []).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => ({
      key: item.id,
      childItemId: item.id,
      masterItemId: item.masterItemId,
      titleSnapshot: item.titleSnapshot,
      status: item.status || '',
      remarks: item.remarks || ''
    })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveChecklist = async () => {
    if (!projectId || !name.trim() || !selectedItems.length) return toast.error('Select a project, enter a name, and choose at least one item');
    setSaving(true);
    const items = selectedItems.map((item, index) => ({
      masterItemId: item.masterItemId || null,
      titleSnapshot: item.titleSnapshot,
      status: item.status,
      remarks: item.remarks,
      sortOrder: index + 1
    }));
    try {
      if (editingId) {
        await api.put(appendCompany(`/checklists/project/${editingId}`), { name, description, items });
        toast.success('Project Checklist updated');
      } else {
        await api.post('/checklists/project', {
          companyId: selectedCompanyId || undefined,
          projectId,
          name,
          description,
          masterItemIds: selectedItems.map((item) => item.masterItemId).filter(Boolean),
          items
        });
        toast.success('Project Checklist created');
      }
      resetBuilder();
      loadSaved();
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save checklist'); }
    finally { setSaving(false); }
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this Project Checklist? Existing PQD drafts remain unchanged.')) return;
    try { await api.delete(appendCompany(`/checklists/project/${id}`)); toast.success('Checklist deactivated'); loadSaved(); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not deactivate checklist'); }
  };

  if (!companyReady) return <WarningBox title="Select a company">Choose a company before creating Project Checklists.</WarningBox>;
  if (loading) return <LoadingBlock />;
  if (!projects.length) return <WarningBox title="Create a project first">A Project Checklist must be saved under a specific project.</WarningBox>;

  return (
    <>
      <PageHeader
        title="Project Checklists"
        description="Create a child checklist by selecting only the Master Checklist items required by a specific project. Saved child checklists remain independent from later Master Checklist changes."
        actions={editingId && <button className="secondary-button" onClick={resetBuilder}><X size={17} /> Cancel editing</button>}
      />
      <div className="builder-toolbar">
        <label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={Boolean(editingId)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} {project.number ? `(${project.number})` : ''}</option>)}</select></label>
        <label>Checklist name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HVAC Prequalification Checklist" /></label>
        <label className="grow">Description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional internal note" /></label>
        <button className="primary-button" onClick={saveChecklist} disabled={saving}><Save size={17} /> {saving ? 'Saving…' : editingId ? 'Update checklist' : 'Save checklist'}</button>
      </div>

      <div className="checklist-builder-grid">
        <section className="panel-card">
          <div className="panel-heading"><div><h2>Active Master Checklist Items</h2><p>Select or remove requirements for this child checklist.</p></div><span className="count-pill">{selectedItems.length} selected</span></div>
          <div className="selection-list">{masterItems.map((item) => {
            const checked = selectedMap.has(item.id);
            return <button type="button" key={item.id} className={`selection-row ${checked ? 'selected' : ''}`} onClick={() => toggleItem(item)}><span className="checkbox-ui">{checked && <Check size={14} />}</span><span className="selection-index">{item.sortOrder}</span><div><strong>{item.title}</strong><span>{item.defaultStatus || 'No default status'}{item.defaultRemark ? ` · ${item.defaultRemark}` : ''}</span></div></button>;
          })}</div>
        </section>

        <section className="panel-card">
          <div className="panel-heading"><div><h2>{editingId ? 'Edit Selected Child Checklist' : 'Selected Child Checklist'}</h2><p>Reorder items and adjust project-specific status or remarks.</p></div></div>
          {!selectedItems.length ? <EmptyState title="No items selected" description="Choose requirements from the Master Checklist." /> : <div className="ordered-list">{selectedItems.map((item, index) => <div className="ordered-row editable" key={item.key}>
            <span className="order-number">{index + 1}</span>
            <div className="ordered-edit-content">
              <strong>{item.titleSnapshot}</strong>
              <div className="ordered-edit-fields">
                <select value={item.status} onChange={(e) => updateSelected(item.key, 'status', e.target.value)}><option value="">No status</option><option>YES</option><option>NO</option><option>NA</option><option>As Required</option><option>APPROVED</option><option>UNDER REVIEW</option><option>NOT SUBMITTED</option></select>
                <input value={item.remarks} onChange={(e) => updateSelected(item.key, 'remarks', e.target.value)} placeholder="Project-specific remark" />
              </div>
            </div>
            <div className="row-actions vertical-actions"><button className="icon-button" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp size={15} /></button><button className="icon-button" onClick={() => move(index, 1)} disabled={index === selectedItems.length - 1}><ArrowDown size={15} /></button><button className="icon-button danger" onClick={() => removeSelected(item.key)}><Trash2 size={15} /></button></div>
          </div>)}</div>}
        </section>
      </div>

      <section className="panel-card section-gap">
        <div className="panel-heading"><div><h2>Saved Checklists for This Project</h2><p>Only active checklists appear when creating a PQD for this project.</p></div><button className="secondary-button" onClick={resetBuilder}><Plus size={16} /> New checklist</button></div>
        {!saved.length ? <EmptyState title="No saved Project Checklists" /> : <div className="cards-grid compact">{saved.map((checklist) => <div className="entity-card" key={checklist.id}><div className="entity-icon"><ClipboardList size={21} /></div><div className="entity-content"><div className="entity-title"><strong>{checklist.name}</strong><StatusBadge status={checklist.isActive ? 'ACTIVE' : 'INACTIVE'} /></div><span>{checklist.items?.length || 0} selected requirements</span><span>{checklist.description || 'No description'}</span></div><div className="row-actions"><button className="icon-button" onClick={() => editChecklist(checklist)}><Pencil size={16} /></button><button className="icon-button danger" onClick={() => deactivate(checklist.id)}><Trash2 size={16} /></button></div></div>)}</div>}
      </section>
    </>
  );
}
