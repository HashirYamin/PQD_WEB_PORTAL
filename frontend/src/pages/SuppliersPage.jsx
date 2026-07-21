import { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Link2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Truck,
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

const blankSupplier = {
  name: '',
  code: '',
  registrationNumber: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  description: '',
  isActive: true
};

const blankContact = {
  name: '',
  jobTitle: '',
  email: '',
  phone: '',
  isPrimary: false
};

const blankLink = {
  masterItemId: '',
  documentId: '',
  priority: 1,
  remarks: ''
};

export default function SuppliersPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const companyReady =
    user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);
  const canManage = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user.role);

  const [suppliers, setSuppliers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState(blankSupplier);
  const [supplierEditingId, setSupplierEditingId] = useState(null);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState(blankContact);
  const [contactEditingId, setContactEditingId] = useState(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState(blankLink);

  const loadBase = async () => {
    if (!companyReady) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [supplierRes, documentRes, masterRes] = await Promise.all([
        api.get(appendCompany('/suppliers')),
        api.get(appendCompany('/documents')),
        api.get(appendCompany('/checklists/master?active=true'))
      ]);

      const supplierRows = supplierRes.data.suppliers || [];
      setSuppliers(supplierRows);
      setDocuments(documentRes.data.documents || []);
      setMasterItems(masterRes.data.items || []);

      setSelectedId((current) =>
        current && supplierRows.some((row) => row.id === current)
          ? current
          : supplierRows[0]?.id || ''
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not load supplier profiles'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    if (!id) {
      setSelected(null);
      return;
    }

    setDetailLoading(true);

    try {
      const { data } = await api.get(
        appendCompany(`/suppliers/${id}`)
      );
      setSelected(data.supplier);
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not load supplier profile'
      );
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, [selectedCompanyId]);

  useEffect(() => {
    loadDetail(selectedId);
  }, [selectedId, selectedCompanyId]);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;

    return suppliers.filter((supplier) =>
      [
        supplier.name,
        supplier.code,
        supplier.registrationNumber,
        supplier.email,
        supplier.phone
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [suppliers, search]);

  const openSupplier = (supplier = null) => {
    setSupplierEditingId(supplier?.id || null);
    setSupplierForm(
      supplier ? { ...blankSupplier, ...supplier } : blankSupplier
    );
    setSupplierOpen(true);
  };

  const saveSupplier = async (event) => {
    event.preventDefault();

    try {
      if (supplierEditingId) {
        await api.put(
          appendCompany(`/suppliers/${supplierEditingId}`),
          supplierForm
        );
        toast.success('Supplier profile updated');
      } else {
        const { data } = await api.post('/suppliers', {
          ...supplierForm,
          companyId: selectedCompanyId || undefined
        });
        setSelectedId(data.supplier.id);
        toast.success('Supplier profile created');
      }

      setSupplierOpen(false);
      await loadBase();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not save supplier'
      );
    }
  };

  const deactivateSupplier = async () => {
    if (
      !selected ||
      !window.confirm('Deactivate this supplier profile?')
    ) {
      return;
    }

    try {
      await api.delete(appendCompany(`/suppliers/${selected.id}`));
      toast.success('Supplier profile deactivated');
      setSelectedId('');
      setSelected(null);
      await loadBase();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not deactivate supplier'
      );
    }
  };

  const openContact = (contact = null) => {
    setContactEditingId(contact?.id || null);
    setContactForm(
      contact ? { ...blankContact, ...contact } : blankContact
    );
    setContactOpen(true);
  };

  const saveContact = async (event) => {
    event.preventDefault();
    if (!selected) return;

    try {
      if (contactEditingId) {
        await api.put(
          appendCompany(
            `/suppliers/${selected.id}/contacts/${contactEditingId}`
          ),
          contactForm
        );
        toast.success('Supplier contact updated');
      } else {
        await api.post(`/suppliers/${selected.id}/contacts`, {
          ...contactForm,
          companyId: selectedCompanyId || undefined
        });
        toast.success('Supplier contact added');
      }

      setContactOpen(false);
      await loadDetail(selected.id);
      await loadBase();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not save supplier contact'
      );
    }
  };

  const removeContact = async (contactId) => {
    if (
      !selected ||
      !window.confirm('Remove this supplier contact?')
    ) {
      return;
    }

    try {
      await api.delete(
        appendCompany(`/suppliers/${selected.id}/contacts/${contactId}`)
      );
      toast.success('Supplier contact removed');
      await loadDetail(selected.id);
      await loadBase();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not remove contact'
      );
    }
  };

  const saveLink = async (event) => {
    event.preventDefault();
    if (!selected) return;

    try {
      await api.post(`/suppliers/${selected.id}/document-links`, {
        ...linkForm,
        companyId: selectedCompanyId || undefined
      });
      toast.success('Supplier document mapped to checklist item');
      setLinkOpen(false);
      setLinkForm(blankLink);
      await loadDetail(selected.id);
      await loadBase();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not map supplier document'
      );
    }
  };

  const removeLink = async (linkId) => {
    if (
      !selected ||
      !window.confirm('Remove this checklist-to-document mapping?')
    ) {
      return;
    }

    try {
      await api.delete(
        appendCompany(`/suppliers/${selected.id}/document-links/${linkId}`)
      );
      toast.success('Document mapping removed');
      await loadDetail(selected.id);
      await loadBase();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not remove mapping'
      );
    }
  };

  if (!companyReady) {
    return (
      <WarningBox title="Select a company">
        Choose a company before managing supplier profiles.
      </WarningBox>
    );
  }

  return (
    <>
      <PageHeader
        title="Supplier Profiles"
        description="Create suppliers, add contacts, and map supplier documents to Master Checklist requirements."
        actions={
          canManage && (
            <button
              className="primary-button"
              onClick={() => openSupplier()}
            >
              <Plus size={17} /> Add supplier
            </button>
          )
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="supplier-layout">
          <aside className="panel-card supplier-list-panel">
            <div className="search-field">
              <Search size={17} />
              <input
                placeholder="Search suppliers…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {!filteredSuppliers.length ? (
              <EmptyState
                title="No suppliers"
                description="Create the first supplier profile."
              />
            ) : (
              <div className="supplier-list">
                {filteredSuppliers.map((supplier) => (
                  <button
                    type="button"
                    key={supplier.id}
                    className={`supplier-list-item ${
                      selectedId === supplier.id ? 'active' : ''
                    }`}
                    onClick={() => setSelectedId(supplier.id)}
                  >
                    <div className="entity-icon">
                      <Truck size={20} />
                    </div>
                    <div>
                      <strong>{supplier.name}</strong>
                      <span>{supplier.code || 'No supplier code'}</span>
                      <small>
                        {supplier.documentCount || 0} mapped documents ·{' '}
                        {supplier.contactCount || 0} contacts
                      </small>
                    </div>
                    <StatusBadge
                      status={supplier.isActive ? 'ACTIVE' : 'INACTIVE'}
                    />
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="supplier-detail-column">
            {detailLoading ? (
              <LoadingBlock />
            ) : !selected ? (
              <div className="panel-card">
                <EmptyState
                  title="Select a supplier"
                  description="Open a supplier profile to manage contacts and document mappings."
                />
              </div>
            ) : (
              <>
                <div className="panel-card">
                  <div className="panel-heading">
                    <div>
                      <h2>{selected.name}</h2>
                      <p>
                        {selected.code || 'No supplier code'} ·{' '}
                        {selected.registrationNumber ||
                          'No registration number'}
                      </p>
                    </div>
                    {canManage && (
                      <div className="row-actions">
                        <button
                          className="secondary-button"
                          onClick={() => openSupplier(selected)}
                        >
                          <Pencil size={16} /> Edit profile
                        </button>
                        <button
                          className="secondary-button danger"
                          onClick={deactivateSupplier}
                        >
                          <Trash2 size={16} /> Deactivate
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="supplier-summary-grid">
                    <div>
                      <span>Email</span>
                      <strong>{selected.email || '—'}</strong>
                    </div>
                    <div>
                      <span>Phone</span>
                      <strong>{selected.phone || '—'}</strong>
                    </div>
                    <div>
                      <span>Website</span>
                      <strong>{selected.website || '—'}</strong>
                    </div>
                    <div>
                      <span>Address</span>
                      <strong>{selected.address || '—'}</strong>
                    </div>
                  </div>

                  {selected.description && (
                    <p className="supplier-description">
                      {selected.description}
                    </p>
                  )}
                </div>

                <div className="panel-card section-gap">
                  <div className="panel-heading">
                    <div>
                      <h2>Supplier Contacts</h2>
                      <p>Store one or more supplier points of contact.</p>
                    </div>
                    {canManage && (
                      <button
                        className="secondary-button"
                        onClick={() => openContact()}
                      >
                        <UserPlus size={16} /> Add contact
                      </button>
                    )}
                  </div>

                  {!selected.contacts?.length ? (
                    <EmptyState title="No supplier contacts" />
                  ) : (
                    <div className="cards-grid compact">
                      {selected.contacts.map((contact) => (
                        <div className="entity-card" key={contact.id}>
                          <div className="entity-content">
                            <div className="entity-title">
                              <strong>{contact.name}</strong>
                              {contact.isPrimary && (
                                <StatusBadge
                                  status="ACTIVE"
                                  label="Primary"
                                />
                              )}
                            </div>
                            <span>{contact.jobTitle || 'No job title'}</span>
                            <span>{contact.email || 'No email'}</span>
                            <span>{contact.phone || 'No phone'}</span>
                          </div>
                          {canManage && (
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                onClick={() => openContact(contact)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon-button danger"
                                onClick={() => removeContact(contact.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel-card section-gap">
                  <div className="panel-heading">
                    <div>
                      <h2>Checklist Document Mappings</h2>
                      <p>
                        Map supplier documents to Master Checklist items.
                        These mappings drive automatic PQD document selection.
                      </p>
                    </div>
                    {canManage && (
                      <button
                        className="primary-button"
                        onClick={() => setLinkOpen(true)}
                      >
                        <Link2 size={16} /> Map document
                      </button>
                    )}
                  </div>

                  {!selected.documentLinks?.length ? (
                    <EmptyState
                      title="No mapped supplier documents"
                      description="Map uploaded documents to Master Checklist requirements."
                    />
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Master Checklist Item</th>
                            <th>Supplier Document</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.documentLinks.map((link) => (
                            <tr key={link.id}>
                              <td>
                                <strong>
                                  {link.masterItem?.title || '—'}
                                </strong>
                              </td>
                              <td>
                                <div className="document-cell">
                                  <div className="file-icon">
                                    <FileText size={15} />
                                  </div>
                                  <div>
                                    <strong>
                                      {link.document?.title ||
                                        'Missing document'}
                                    </strong>
                                    <span>
                                      {link.document?.category || '—'}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <StatusBadge
                                  status={
                                    link.document?.statusInfo?.key
                                  }
                                  label={
                                    link.document?.statusInfo?.label
                                  }
                                />
                              </td>
                              <td>{link.priority || 1}</td>
                              <td>
                                {canManage ? (
                                  <button
                                    className="icon-button danger"
                                    onClick={() => removeLink(link.id)}
                                    title="Remove mapping"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <Modal
        open={supplierOpen}
        title={
          supplierEditingId
            ? 'Edit Supplier Profile'
            : 'Create Supplier Profile'
        }
        onClose={() => setSupplierOpen(false)}
        width="860px"
      >
        <form className="form-grid two" onSubmit={saveSupplier}>
          <label>
            Supplier name
            <input
              value={supplierForm.name}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  name: event.target.value
                })
              }
              required
            />
          </label>
          <label>
            Supplier code
            <input
              value={supplierForm.code || ''}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  code: event.target.value
                })
              }
            />
          </label>
          <label>
            Registration number
            <input
              value={supplierForm.registrationNumber || ''}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  registrationNumber: event.target.value
                })
              }
            />
          </label>
          <label>
            Status
            <select
              value={String(supplierForm.isActive)}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  isActive: event.target.value === 'true'
                })
              }
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label>
            Email
            <input
              type="email"
              value={supplierForm.email || ''}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  email: event.target.value
                })
              }
            />
          </label>
          <label>
            Phone
            <input
              value={supplierForm.phone || ''}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  phone: event.target.value
                })
              }
            />
          </label>
          <label className="span-2">
            Website
            <input
              type="url"
              value={supplierForm.website || ''}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  website: event.target.value
                })
              }
              placeholder="https://..."
            />
          </label>
          <label className="span-2">
            Address
            <textarea
              rows="3"
              value={supplierForm.address || ''}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  address: event.target.value
                })
              }
            />
          </label>
          <label className="span-2">
            Description
            <textarea
              rows="3"
              value={supplierForm.description || ''}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  description: event.target.value
                })
              }
            />
          </label>
          <div className="form-actions span-2">
            <button className="primary-button">
              <Save size={17} /> Save supplier
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={contactOpen}
        title={
          contactEditingId
            ? 'Edit Supplier Contact'
            : 'Add Supplier Contact'
        }
        onClose={() => setContactOpen(false)}
      >
        <form className="form-grid two" onSubmit={saveContact}>
          <label>
            Name
            <input
              value={contactForm.name}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  name: event.target.value
                })
              }
              required
            />
          </label>
          <label>
            Job title
            <input
              value={contactForm.jobTitle || ''}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  jobTitle: event.target.value
                })
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={contactForm.email || ''}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  email: event.target.value
                })
              }
            />
          </label>
          <label>
            Phone
            <input
              value={contactForm.phone || ''}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  phone: event.target.value
                })
              }
            />
          </label>
          <label className="switch-row span-2">
            <span>
              <strong>Primary contact</strong>
            </span>
            <input
              type="checkbox"
              checked={Boolean(contactForm.isPrimary)}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  isPrimary: event.target.checked
                })
              }
            />
          </label>
          <div className="form-actions span-2">
            <button className="primary-button">
              <Save size={17} /> Save contact
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={linkOpen}
        title="Map Supplier Document"
        onClose={() => setLinkOpen(false)}
        width="820px"
      >
        <form className="form-grid two" onSubmit={saveLink}>
          <label className="span-2">
            Master Checklist requirement
            <select
              value={linkForm.masterItemId}
              onChange={(event) =>
                setLinkForm({
                  ...linkForm,
                  masterItemId: event.target.value
                })
              }
              required
            >
              <option value="">Select requirement</option>
              {masterItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sortOrder}. {item.title}
                </option>
              ))}
            </select>
          </label>

          <label className="span-2">
            Supplier document
            <select
              value={linkForm.documentId}
              onChange={(event) =>
                setLinkForm({
                  ...linkForm,
                  documentId: event.target.value
                })
              }
              required
            >
              <option value="">Select uploaded document</option>
              {documents
                .filter((document) => !document.isArchived)
                .map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title} — {document.category} —{' '}
                    {document.statusInfo?.label || 'No status'}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Priority
            <input
              type="number"
              min="1"
              value={linkForm.priority}
              onChange={(event) =>
                setLinkForm({
                  ...linkForm,
                  priority: Number(event.target.value) || 1
                })
              }
            />
          </label>

          <label>
            Internal remark
            <input
              value={linkForm.remarks}
              onChange={(event) =>
                setLinkForm({
                  ...linkForm,
                  remarks: event.target.value
                })
              }
            />
          </label>

          <div className="form-actions span-2">
            <button className="primary-button">
              <Link2 size={17} /> Save mapping
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
