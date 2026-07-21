import { useEffect, useState } from 'react';
import {
  FolderKanban,
  Image,
  Plus,
  Save,
  Search,
  Trash2,
  UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  WarningBox
} from '../components/Common';

const blankContact = {
  name: '',
  organization: '',
  role: '',
  jobTitle: '',
  email: '',
  phone: '',
  mobile: '',
  isPrimary: false
};

const blank = {
  name: '',
  number: '',
  contractCode: '',
  client: '',
  consultant: '',
  contractor: '',
  supplier: '',
  productSystem: '',
  revision: '0',
  projectDate: '',
  startDate: '',
  endDate: '',
  submittalNumber: '',
  discipline: '',
  contacts: []
};

function ProjectLogoPreview({ projectId, party, stored, localFile, appendCompany }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;

    if (localFile) {
      objectUrl = URL.createObjectURL(localFile);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }

    if (!projectId || !stored) {
      setUrl('');
      return undefined;
    }

    api.get(appendCompany(`/projects/${projectId}/logo/${party}`), { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl('');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, party, stored, localFile, appendCompany]);

  return (
    <div className="project-logo-preview">
      {url ? <img src={url} alt={`${party} logo`} /> : <Image size={25} />}
    </div>
  );
}

export default function ProjectsPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const companyReady = user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoFiles, setLogoFiles] = useState({
    client: null,
    consultant: null,
    contractor: null
  });

  const load = async () => {
    if (!companyReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get(appendCompany('/projects'));
      setProjects(data.projects || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedCompanyId]);

  const resetLogos = () => setLogoFiles({ client: null, consultant: null, contractor: null });

  const openCreate = () => {
    setForm({ ...blank, contacts: [{ ...blankContact, isPrimary: true }] });
    setEditingId(null);
    resetLogos();
    setOpen(true);
  };

  const openEdit = (project) => {
    setForm({
      ...blank,
      ...project,
      projectDate: project.projectDate || '',
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      contacts: (project.contacts || []).map((contact) => ({ ...blankContact, ...contact }))
    });
    setEditingId(project.id);
    resetLogos();
    setOpen(true);
  };

  const updateContact = (index, key, value) => {
    setForm((current) => ({
      ...current,
      contacts: current.contacts.map((contact, contactIndex) => {
        if (contactIndex !== index) {
          if (key === 'isPrimary' && value) return { ...contact, isPrimary: false };
          return contact;
        }
        return { ...contact, [key]: value };
      })
    }));
  };

  const addContact = () => {
    setForm((current) => ({
      ...current,
      contacts: [
        ...current.contacts,
        { ...blankContact, isPrimary: current.contacts.length === 0 }
      ]
    }));
  };

  const removeContact = (index) => {
    setForm((current) => {
      const next = current.contacts.filter((_, contactIndex) => contactIndex !== index);
      if (next.length && !next.some((contact) => contact.isPrimary)) next[0].isPrimary = true;
      return { ...current, contacts: next };
    });
  };

  const uploadPartyLogo = async (projectId, party, file) => {
    if (!file) return;
    const body = new FormData();
    body.append('logo', file);
    await api.post(appendCompany(`/projects/${projectId}/logo/${party}`), body);
  };

  const save = async (event) => {
    event.preventDefault();

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      return toast.error('Project end date cannot be before the start date');
    }

    setSaving(true);
    const { contacts, ...projectFields } = form;
    const payload = {
      ...projectFields,
      companyId: selectedCompanyId || undefined
    };

    try {
      const response = editingId
        ? await api.put(appendCompany(`/projects/${editingId}`), payload)
        : await api.post('/projects', payload);

      const projectId = editingId || response.data.project.id;

      await Promise.all([
        uploadPartyLogo(projectId, 'client', logoFiles.client),
        uploadPartyLogo(projectId, 'consultant', logoFiles.consultant),
        uploadPartyLogo(projectId, 'contractor', logoFiles.contractor)
      ]);

      await api.put(appendCompany(`/projects/${projectId}/contacts`), {
        contacts: contacts.filter((contact) => contact.name.trim())
      });

      toast.success(editingId ? 'Project updated' : 'Project created');
      setOpen(false);
      setForm(blank);
      resetLogos();
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save project');
    } finally {
      setSaving(false);
    }
  };

  const filtered = projects.filter((item) =>
    `${item.name} ${item.number || ''} ${item.contractCode || ''} ${item.client || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  if (!companyReady) {
    return <WarningBox title="Select a company">Choose a company before creating projects.</WarningBox>;
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Maintain project parties, logos, contract data, dates and points of contact."
        actions={
          <button className="primary-button" onClick={openCreate}>
            <Plus size={17} /> New project
          </button>
        }
      />

      <div className="filter-bar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Search projects, contract code or client…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : !filtered.length ? (
        <EmptyState title="No projects found" />
      ) : (
        <div className="cards-grid">
          {filtered.map((project) => (
            <button className="entity-card clickable" key={project.id} onClick={() => openEdit(project)}>
              <div className="entity-icon"><FolderKanban size={22} /></div>
              <div className="entity-content">
                <div className="entity-title">
                  <strong>{project.name}</strong>
                  <StatusBadge status={project.status} />
                </div>
                <span>{project.number || 'No project number'}{project.contractCode ? ` · ${project.contractCode}` : ''}</span>
                <span>{project.client || 'No client'}</span>
                <span>{project.startDate || 'No start date'} → {project.endDate || 'No end date'}</span>
                <div className="entity-meta">
                  <span>{project.contacts?.length || 0} contacts</span>
                  <span>{project.childChecklists?.filter((item) => item.isActive).length || 0} checklists</span>
                  <span>{project.submissions?.length || 0} PQDs</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title={editingId ? 'Edit Project' : 'Create Project'}
        onClose={() => !saving && setOpen(false)}
        width="1100px"
      >
        <form className="form-grid three" onSubmit={save}>
          <label className="span-2">Project name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Project number<input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} /></label>
          <label>Contract code<input value={form.contractCode || ''} onChange={(e) => setForm({ ...form, contractCode: e.target.value })} /></label>
          <label>Project start date<input type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
          <label>Project end date<input type="date" min={form.startDate || undefined} value={form.endDate || ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>

          <label>Client<input value={form.client || ''} onChange={(e) => setForm({ ...form, client: e.target.value })} /></label>
          <label>Consultant<input value={form.consultant || ''} onChange={(e) => setForm({ ...form, consultant: e.target.value })} /></label>
          <label>Contractor<input value={form.contractor || ''} onChange={(e) => setForm({ ...form, contractor: e.target.value })} /></label>

          {['client', 'consultant', 'contractor'].map((party) => (
            <label key={party} className="project-logo-field">
              <span>{party[0].toUpperCase() + party.slice(1)} logo</span>
              <ProjectLogoPreview
                projectId={editingId}
                party={party}
                stored={form[`${party}LogoPath`]}
                localFile={logoFiles[party]}
                appendCompany={appendCompany}
              />
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.jfif,.webp,.avif,.svg,image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
                onChange={(event) => setLogoFiles({ ...logoFiles, [party]: event.target.files?.[0] || null })}
              />
            </label>
          ))}

          <label>Supplier<input value={form.supplier || ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></label>
          <label className="span-2">Product / System<input value={form.productSystem || ''} onChange={(e) => setForm({ ...form, productSystem: e.target.value })} /></label>
          <label>Discipline<input value={form.discipline || ''} onChange={(e) => setForm({ ...form, discipline: e.target.value })} /></label>
          <label>Submittal number<input value={form.submittalNumber || ''} onChange={(e) => setForm({ ...form, submittalNumber: e.target.value })} /></label>
          <label>Revision<input value={form.revision || ''} onChange={(e) => setForm({ ...form, revision: e.target.value })} /></label>
          <label>General project date<input type="date" value={form.projectDate || ''} onChange={(e) => setForm({ ...form, projectDate: e.target.value })} /></label>

          <div className="span-3 project-contacts-section">
            <div className="panel-heading">
              <div>
                <h3>Project Points of Contact</h3>
                <p>Add one or more client, consultant, contractor, supplier or internal contacts.</p>
              </div>
              <button type="button" className="secondary-button" onClick={addContact}>
                <UserPlus size={16} /> Add contact
              </button>
            </div>

            {!form.contacts.length ? (
              <EmptyState title="No project contacts" description="Add at least one point of contact when available." />
            ) : (
              <div className="project-contact-list">
                {form.contacts.map((contact, index) => (
                  <div className="project-contact-row" key={contact.id || index}>
                    <input placeholder="Contact name" value={contact.name} onChange={(e) => updateContact(index, 'name', e.target.value)} />
                    <input placeholder="Organization" value={contact.organization || ''} onChange={(e) => updateContact(index, 'organization', e.target.value)} />
                    <select value={contact.role || ''} onChange={(e) => updateContact(index, 'role', e.target.value)}>
                      <option value="">Contact role</option>
                      <option>Client</option>
                      <option>Consultant</option>
                      <option>Contractor</option>
                      <option>Supplier</option>
                      <option>Internal</option>
                      <option>Other</option>
                    </select>
                    <input placeholder="Job title" value={contact.jobTitle || ''} onChange={(e) => updateContact(index, 'jobTitle', e.target.value)} />
                    <input type="email" placeholder="Email" value={contact.email || ''} onChange={(e) => updateContact(index, 'email', e.target.value)} />
                    <input placeholder="Phone" value={contact.phone || ''} onChange={(e) => updateContact(index, 'phone', e.target.value)} />
                    <label className="project-primary-contact">
                      <input type="checkbox" checked={Boolean(contact.isPrimary)} onChange={(e) => updateContact(index, 'isPrimary', e.target.checked)} />
                      Primary
                    </label>
                    <button type="button" className="icon-button danger" onClick={() => removeContact(index)} title="Remove contact">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions span-3">
            <button className="primary-button" disabled={saving}>
              <Save size={17} /> {saving ? 'Saving project…' : 'Save project'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
