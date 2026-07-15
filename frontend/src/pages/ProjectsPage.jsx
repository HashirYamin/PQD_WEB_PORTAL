import { useEffect, useState } from 'react';
import { FolderKanban, Plus, Save, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { EmptyState, LoadingBlock, PageHeader, StatusBadge, WarningBox } from '../components/Common';

const blank = { name: '', number: '', client: '', consultant: '', contractor: '', supplier: '', productSystem: '', revision: '0', projectDate: '', submittalNumber: '', discipline: '' };

export default function ProjectsPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const companyReady = user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');

  const load = () => {
    if (!companyReady) { setLoading(false); return; }
    setLoading(true);
    api.get(appendCompany('/projects')).then(({ data }) => setProjects(data.projects || [])).finally(() => setLoading(false));
  };
  useEffect(load, [selectedCompanyId]);

  const openCreate = () => { setForm(blank); setEditingId(null); setOpen(true); };
  const openEdit = (project) => { setForm({ ...blank, ...project, projectDate: project.projectDate || '' }); setEditingId(project.id); setOpen(true); };
  const save = async (event) => {
    event.preventDefault();
    const payload = { ...form, companyId: selectedCompanyId || undefined };
    try {
      editingId ? await api.put(appendCompany(`/projects/${editingId}`), payload) : await api.post('/projects', payload);
      toast.success(editingId ? 'Project updated' : 'Project created'); setOpen(false); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save project'); }
  };

  const filtered = projects.filter((item) => `${item.name} ${item.number} ${item.client}`.toLowerCase().includes(search.toLowerCase()));
  if (!companyReady) return <WarningBox title="Select a company">Choose a company before creating projects.</WarningBox>;

  return (
    <>
      <PageHeader title="Projects" description="Maintain the project and submittal data used by checklists and generated PQDs." actions={<button className="primary-button" onClick={openCreate}><Plus size={17} /> New project</button>} />
      <div className="filter-bar"><div className="search-field"><Search size={17} /><input placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
      {loading ? <LoadingBlock /> : !filtered.length ? <EmptyState title="No projects found" /> : <div className="cards-grid">{filtered.map((project) => <button className="entity-card clickable" key={project.id} onClick={() => openEdit(project)}><div className="entity-icon"><FolderKanban size={22} /></div><div className="entity-content"><div className="entity-title"><strong>{project.name}</strong><StatusBadge status={project.status} /></div><span>{project.number || 'No project number'} · {project.discipline || 'No discipline'}</span><span>{project.client || 'No client'}</span><div className="entity-meta"><span>{project.childChecklists?.filter((item) => item.isActive).length || 0} checklists</span><span>{project.submissions?.length || 0} PQDs</span></div></div></button>)}</div>}
      <Modal open={open} title={editingId ? 'Edit Project' : 'Create Project'} onClose={() => setOpen(false)} width="860px">
        <form className="form-grid three" onSubmit={save}>
          <label className="span-2">Project name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Project number<input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} /></label>
          <label>Client<input value={form.client || ''} onChange={(e) => setForm({ ...form, client: e.target.value })} /></label>
          <label>Consultant<input value={form.consultant || ''} onChange={(e) => setForm({ ...form, consultant: e.target.value })} /></label>
          <label>Contractor<input value={form.contractor || ''} onChange={(e) => setForm({ ...form, contractor: e.target.value })} /></label>
          <label>Supplier<input value={form.supplier || ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></label>
          <label className="span-2">Product / System<input value={form.productSystem || ''} onChange={(e) => setForm({ ...form, productSystem: e.target.value })} /></label>
          <label>Discipline<input value={form.discipline || ''} onChange={(e) => setForm({ ...form, discipline: e.target.value })} /></label>
          <label>Submittal number<input value={form.submittalNumber || ''} onChange={(e) => setForm({ ...form, submittalNumber: e.target.value })} /></label>
          <label>Revision<input value={form.revision || ''} onChange={(e) => setForm({ ...form, revision: e.target.value })} /></label>
          <label>Project date<input type="date" value={form.projectDate || ''} onChange={(e) => setForm({ ...form, projectDate: e.target.value })} /></label>
          <div className="form-actions span-3"><button className="primary-button"><Save size={17} /> Save project</button></div>
        </form>
      </Modal>
    </>
  );
}
