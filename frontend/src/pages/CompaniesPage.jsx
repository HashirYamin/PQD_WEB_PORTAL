import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CompanyLogo from '../components/CompanyLogo';
import {
  Building2,
  ExternalLink,
  Pencil,
  Plus,
  Save
} from 'lucide-react';
import toast from 'react-hot-toast';

import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  StatusBadge
} from '../components/Common';

const blank = {
  name: '',
  crNumber: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  isActive: true
};

export default function CompaniesPage() {
  const navigate = useNavigate();
  const { selectCompany } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);

    try {
      const { data } = await api.get('/companies');
      setCompanies(data.companies || []);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load companies'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(blank);
    setOpen(true);
  };

  const openEdit = (company) => {
    setEditingId(company.id);

    setForm({
      name: company.name || '',
      crNumber: company.crNumber || '',
      contactPerson: company.contactPerson || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      isActive: Boolean(company.isActive)
    });

    setOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setOpen(false);
    setEditingId(null);
    setForm(blank);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (editingId) {
        await api.put(
          `/companies/${editingId}`,
          form
        );

        toast.success('Company updated');
      } else {
        await api.post('/companies', form);
        toast.success('Company created');
      }

      closeModal();
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          `Could not ${
            editingId ? 'update' : 'create'
          } company`
      );
    } finally {
      setSaving(false);
    }
  };

  const openProfile = (company) => {
    selectCompany(company.id);
    navigate('/company-profile');
  };

  return (
    <>
      <PageHeader
        title="Companies"
        description="Create, edit and open separate company workspaces."
        actions={
          <button
            className="primary-button"
            onClick={openCreate}
          >
            <Plus size={17} />
            Add company
          </button>
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : !companies.length ? (
        <EmptyState
          title="No companies"
          description="Create the first company workspace."
        />
      ) : (
        <div className="cards-grid">
          {companies.map((company) => (
            <div
              className="entity-card"
              key={company.id}
            >
              <div className="entity-icon">
  <CompanyLogo
    companyId={company.id}
    companyName={company.name}
    className="card-company-logo"
    fallbackSize={22}
  />
</div>

              <div className="entity-content">
                <div className="entity-title">
                  <strong>{company.name}</strong>

                  <StatusBadge
                    status={
                      company.isActive
                        ? 'ACTIVE'
                        : 'INACTIVE'
                    }
                  />
                </div>

                <span>
                  CR: {company.crNumber || '—'}
                </span>

                <span>
                  {company.contactPerson ||
                    'No contact person'}
                </span>

                <span>
                  {company.email || 'No email'}
                </span>

                <span>
                  {company.phone || 'No phone'}
                </span>
              </div>

              <div className="row-actions">
                <button
                  type="button"
                  className="icon-button"
                  title="Edit company"
                  onClick={() => openEdit(company)}
                >
                  <Pencil size={17} />
                </button>

                <button
                  type="button"
                  className="icon-button"
                  title="Open complete company profile"
                  onClick={() => openProfile(company)}
                >
                  <ExternalLink size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title={
          editingId
            ? 'Edit Company'
            : 'Create Company'
        }
        onClose={closeModal}
      >
        <form
          onSubmit={save}
          className="form-grid two"
        >
          <label>
            Company name
            <input
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value
                })
              }
              required
            />
          </label>

          <label>
            CR number
            <input
              value={form.crNumber}
              onChange={(event) =>
                setForm({
                  ...form,
                  crNumber: event.target.value
                })
              }
            />
          </label>

          <label>
            Contact person
            <input
              value={form.contactPerson}
              onChange={(event) =>
                setForm({
                  ...form,
                  contactPerson:
                    event.target.value
                })
              }
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({
                  ...form,
                  email: event.target.value
                })
              }
            />
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              onChange={(event) =>
                setForm({
                  ...form,
                  phone: event.target.value
                })
              }
            />
          </label>

          {editingId && (
            <label>
              Status
              <select
                value={String(form.isActive)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    isActive:
                      event.target.value === 'true'
                  })
                }
              >
                <option value="true">
                  Active
                </option>

                <option value="false">
                  Inactive
                </option>
              </select>
            </label>
          )}

          <label className="span-2">
            Address
            <textarea
              rows="3"
              value={form.address}
              onChange={(event) =>
                setForm({
                  ...form,
                  address: event.target.value
                })
              }
            />
          </label>

          <div className="form-actions span-2">
            <button
              className="primary-button"
              disabled={saving}
            >
              <Save size={17} />

              {saving
                ? 'Saving…'
                : editingId
                  ? 'Update company'
                  : 'Create company'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}