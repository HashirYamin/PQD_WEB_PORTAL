import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  FileText,
  Link2,
  MapPin,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Truck,
  Upload,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import SupplierLogo from '../components/SupplierLogo';
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
  yearEstablished: '',
  natureOfBusiness: '',
  email: '',
  phone: '',
  fax: '',
  website: '',
  description: '',
  isActive: true
};

const blankAddress = {
  label: 'Main Office',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  isPrimary: false
};

const blankContact = {
  name: '',
  jobTitle: '',
  department: '',
  email: '',
  phone: '',
  mobile: '',
  isPrimary: false
};

const blankProfileDocument = {
  type: 'LEGAL',
  documentId: '',
  remarks: ''
};

const blankProduct = {
  name: '',
  code: '',
  model: '',
  brand: '',
  category: '',
  manufacturer: '',
  countryOfOrigin: '',
  description: '',
  isActive: true
};

const blankProductDocument = {
  masterItemId: '',
  documentId: '',
  priority: 1,
  remarks: ''
};

const tabs = [
  { key: 'profile', label: 'Supplier Information', icon: Building2 },
  { key: 'addresses', label: 'Addresses', icon: MapPin },
  { key: 'contacts', label: 'Contacts', icon: Users },
  { key: 'documents', label: 'Legal & Certifications', icon: FileText },
  { key: 'products', label: 'Products', icon: Package }
];

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
  const [activeTab, setActiveTab] = useState('profile');
  const [activeProductId, setActiveProductId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState(blankSupplier);
  const [supplierEditingId, setSupplierEditingId] = useState(null);

  const [addressOpen, setAddressOpen] = useState(false);
  const [addressForm, setAddressForm] = useState(blankAddress);
  const [addressEditingId, setAddressEditingId] = useState(null);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState(blankContact);
  const [contactEditingId, setContactEditingId] = useState(null);

  const [profileDocumentOpen, setProfileDocumentOpen] = useState(false);
  const [profileDocumentForm, setProfileDocumentForm] = useState(
    blankProfileDocument
  );

  const [productOpen, setProductOpen] = useState(false);
  const [productForm, setProductForm] = useState(blankProduct);
  const [productEditingId, setProductEditingId] = useState(null);

  const [productDocumentOpen, setProductDocumentOpen] = useState(false);
  const [productDocumentForm, setProductDocumentForm] = useState(
    blankProductDocument
  );

  const loadBase = async () => {
    if (!companyReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [supplierResponse, documentResponse, masterResponse] =
        await Promise.all([
          api.get(appendCompany('/suppliers')),
          api.get(appendCompany('/documents')),
          api.get(appendCompany('/checklists/master?active=true'))
        ]);

      const supplierRows = supplierResponse.data.suppliers || [];
      setSuppliers(supplierRows);
      setDocuments(documentResponse.data.documents || []);
      setMasterItems(masterResponse.data.items || []);

      setSelectedId((current) => {
        if (current && supplierRows.some((item) => item.id === current)) {
          return current;
        }
        return supplierRows[0]?.id || '';
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not load supplier profiles'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (supplierId) => {
    if (!supplierId) {
      setSelected(null);
      return;
    }

    setDetailLoading(true);
    try {
      const { data } = await api.get(
        appendCompany(`/suppliers/${supplierId}`)
      );
      setSelected(data.supplier);
      setSupplierForm({ ...blankSupplier, ...data.supplier });
      setActiveProductId((current) => {
        if (
          current &&
          data.supplier.products?.some((product) => product.id === current)
        ) {
          return current;
        }
        return data.supplier.products?.[0]?.id || '';
      });
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
        supplier.email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [suppliers, search]);

  const activeProduct = selected?.products?.find(
    (product) => product.id === activeProductId
  );

  const refresh = async () => {
    await loadBase();
    if (selectedId) await loadDetail(selectedId);
  };

  const openSupplier = (supplier = null) => {
    setSupplierEditingId(supplier?.id || null);
    setSupplierForm(supplier ? { ...blankSupplier, ...supplier } : blankSupplier);
    setSupplierOpen(true);
  };

  const saveSupplier = async (event) => {
    event.preventDefault();
    setSaving(true);
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
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save supplier');
    } finally {
      setSaving(false);
    }
  };

  const saveInlineProfile = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(
        appendCompany(`/suppliers/${selected.id}`),
        supplierForm
      );
      toast.success('Supplier information saved');
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file) => {
    if (!selected || !file) return;
    const body = new FormData();
    body.append('logo', file);
    try {
      await api.post(
        appendCompany(`/suppliers/${selected.id}/logo`),
        body
      );
      toast.success('Supplier logo uploaded');
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Logo upload failed');
    }
  };

  const openAddress = (address = null) => {
    setAddressEditingId(address?.id || null);
    setAddressForm(address ? { ...blankAddress, ...address } : blankAddress);
    setAddressOpen(true);
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    if (!selected) return;
    try {
      if (addressEditingId) {
        await api.put(
          appendCompany(
            `/suppliers/${selected.id}/addresses/${addressEditingId}`
          ),
          addressForm
        );
      } else {
        await api.post(`/suppliers/${selected.id}/addresses`, {
          ...addressForm,
          companyId: selectedCompanyId || undefined
        });
      }
      toast.success('Supplier address saved');
      setAddressOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save address');
    }
  };

  const removeAddress = async (addressId) => {
    if (!selected || !window.confirm('Remove this supplier address?')) return;
    await api.delete(
      appendCompany(`/suppliers/${selected.id}/addresses/${addressId}`)
    );
    toast.success('Supplier address removed');
    await refresh();
  };

  const openContact = (contact = null) => {
    setContactEditingId(contact?.id || null);
    setContactForm(contact ? { ...blankContact, ...contact } : blankContact);
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
      } else {
        await api.post(`/suppliers/${selected.id}/contacts`, {
          ...contactForm,
          companyId: selectedCompanyId || undefined
        });
      }
      toast.success('Supplier contact saved');
      setContactOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save contact');
    }
  };

  const removeContact = async (contactId) => {
    if (!selected || !window.confirm('Remove this supplier contact?')) return;
    await api.delete(
      appendCompany(`/suppliers/${selected.id}/contacts/${contactId}`)
    );
    toast.success('Supplier contact removed');
    await refresh();
  };

  const saveProfileDocument = async (event) => {
    event.preventDefault();
    if (!selected) return;
    try {
      await api.post(`/suppliers/${selected.id}/profile-documents`, {
        ...profileDocumentForm,
        companyId: selectedCompanyId || undefined
      });
      toast.success('Document linked to supplier profile');
      setProfileDocumentOpen(false);
      setProfileDocumentForm(blankProfileDocument);
      await refresh();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not link supplier document'
      );
    }
  };

  const removeProfileDocument = async (linkId) => {
    if (!selected || !window.confirm('Unlink this supplier document?')) return;
    await api.delete(
      appendCompany(`/suppliers/${selected.id}/profile-documents/${linkId}`)
    );
    toast.success('Supplier document unlinked');
    await refresh();
  };

  const openProduct = (product = null) => {
    setProductEditingId(product?.id || null);
    setProductForm(product ? { ...blankProduct, ...product } : blankProduct);
    setProductOpen(true);
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    if (!selected) return;
    try {
      if (productEditingId) {
        await api.put(
          appendCompany(
            `/suppliers/${selected.id}/products/${productEditingId}`
          ),
          productForm
        );
      } else {
        const { data } = await api.post(
          `/suppliers/${selected.id}/products`,
          {
            ...productForm,
            companyId: selectedCompanyId || undefined
          }
        );
        setActiveProductId(data.product.id);
      }
      toast.success('Supplier product saved');
      setProductOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save product');
    }
  };

  const deactivateProduct = async (productId) => {
    if (!selected || !window.confirm('Deactivate this supplier product?')) {
      return;
    }
    await api.delete(
      appendCompany(`/suppliers/${selected.id}/products/${productId}`)
    );
    toast.success('Product deactivated');
    await refresh();
  };

  const saveProductDocument = async (event) => {
    event.preventDefault();
    if (!selected || !activeProduct) return;
    try {
      await api.post(
        `/suppliers/${selected.id}/products/${activeProduct.id}/document-links`,
        {
          ...productDocumentForm,
          companyId: selectedCompanyId || undefined
        }
      );
      toast.success('Product document mapped to checklist item');
      setProductDocumentOpen(false);
      setProductDocumentForm(blankProductDocument);
      await refresh();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not map product document'
      );
    }
  };

  const removeProductDocument = async (linkId) => {
    if (
      !selected ||
      !activeProduct ||
      !window.confirm('Remove this product-document mapping?')
    ) {
      return;
    }
    await api.delete(
      appendCompany(
        `/suppliers/${selected.id}/products/${activeProduct.id}/document-links/${linkId}`
      )
    );
    toast.success('Product document mapping removed');
    await refresh();
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
        description="Manage each supplier as a company identity, list its products, and map each product document to Master Checklist requirements."
        actions={
          canManage && (
            <button className="primary-button" onClick={() => openSupplier()}>
              <Plus size={17} /> Add supplier
            </button>
          )
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="supplier-profile-layout">
          <aside className="panel-card supplier-directory">
            <div className="search-field">
              <Search size={17} />
              <input
                placeholder="Search suppliers…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {!filteredSuppliers.length ? (
              <EmptyState title="No supplier profiles" />
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
                    <Truck size={19} />
                    <div>
                      <strong>{supplier.name}</strong>
                      <span>{supplier.code || 'No supplier code'}</span>
                      <small>
                        {supplier.productCount || 0} product(s) ·{' '}
                        {supplier.contactCount || 0} contact(s)
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

          <section className="supplier-profile-main">
            {detailLoading ? (
              <LoadingBlock />
            ) : !selected ? (
              <div className="panel-card">
                <EmptyState title="Select a supplier profile" />
              </div>
            ) : (
              <>
                <div className="supplier-profile-hero panel-card">
                  <div className="supplier-logo-box">
                    <SupplierLogo
                      supplierId={selected.id}
                      supplierName={selected.name}
                      className="supplier-profile-logo"
                      fallbackSize={36}
                    />
                  </div>
                  <div className="grow">
                    <h2>{selected.name}</h2>
                    <p>
                      {selected.registrationNumber || 'No registration number'}
                      {selected.code ? ` · ${selected.code}` : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="row-actions">
                      <label className="secondary-button file-button">
                        <Upload size={16} /> Upload logo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          onChange={(event) =>
                            uploadLogo(event.target.files?.[0])
                          }
                        />
                      </label>
                      <button
                        className="secondary-button"
                        onClick={() => openSupplier(selected)}
                      >
                        <Pencil size={16} /> Edit
                      </button>
                    </div>
                  )}
                </div>

                <div className="profile-tabs" role="tablist">
                  {tabs.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      className={`profile-tab ${
                        activeTab === key ? 'active' : ''
                      }`}
                      onClick={() => setActiveTab(key)}
                    >
                      <Icon size={17} /> {label}
                    </button>
                  ))}
                </div>

                {activeTab === 'profile' && (
                  <form
                    className="panel-card form-card form-grid two"
                    onSubmit={saveInlineProfile}
                  >
                    <label>
                      Supplier legal name
                      <input
                        value={supplierForm.name || ''}
                        onChange={(event) =>
                          setSupplierForm({
                            ...supplierForm,
                            name: event.target.value
                          })
                        }
                        disabled={!canManage}
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
                        disabled={!canManage}
                      />
                    </label>
                    <label>
                      Registration / CR number
                      <input
                        value={supplierForm.registrationNumber || ''}
                        onChange={(event) =>
                          setSupplierForm({
                            ...supplierForm,
                            registrationNumber: event.target.value
                          })
                        }
                        disabled={!canManage}
                      />
                    </label>
                    <label>
                      Year established
                      <input
                        type="number"
                        value={supplierForm.yearEstablished || ''}
                        onChange={(event) =>
                          setSupplierForm({
                            ...supplierForm,
                            yearEstablished: event.target.value
                          })
                        }
                        disabled={!canManage}
                      />
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
                        disabled={!canManage}
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
                        disabled={!canManage}
                      />
                    </label>
                    <label>
                      Fax
                      <input
                        value={supplierForm.fax || ''}
                        onChange={(event) =>
                          setSupplierForm({
                            ...supplierForm,
                            fax: event.target.value
                          })
                        }
                        disabled={!canManage}
                      />
                    </label>
                    <label>
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
                        disabled={!canManage}
                      />
                    </label>
                    <label className="span-2">
                      Nature of business
                      <textarea
                        rows="3"
                        value={supplierForm.natureOfBusiness || ''}
                        onChange={(event) =>
                          setSupplierForm({
                            ...supplierForm,
                            natureOfBusiness: event.target.value
                          })
                        }
                        disabled={!canManage}
                      />
                    </label>
                    <label className="span-2">
                      Description / portfolio summary
                      <textarea
                        rows="4"
                        value={supplierForm.description || ''}
                        onChange={(event) =>
                          setSupplierForm({
                            ...supplierForm,
                            description: event.target.value
                          })
                        }
                        disabled={!canManage}
                      />
                    </label>
                    {canManage && (
                      <div className="form-actions span-2">
                        <button className="primary-button" disabled={saving}>
                          <Save size={17} /> Save supplier information
                        </button>
                      </div>
                    )}
                  </form>
                )}

                {activeTab === 'addresses' && (
                  <div className="panel-card">
                    <div className="panel-heading">
                      <div>
                        <h2>Supplier Addresses</h2>
                        <p>Add head office, factory, warehouse and branches.</p>
                      </div>
                      {canManage && (
                        <button
                          className="primary-button"
                          onClick={() => openAddress()}
                        >
                          <Plus size={16} /> Add address
                        </button>
                      )}
                    </div>
                    {!selected.addresses?.length ? (
                      <EmptyState title="No supplier addresses" />
                    ) : (
                      <div className="cards-grid compact">
                        {selected.addresses.map((address) => (
                          <div className="entity-card" key={address.id}>
                            <MapPin size={20} />
                            <div className="entity-content">
                              <div className="entity-title">
                                <strong>{address.label}</strong>
                                {address.isPrimary && (
                                  <StatusBadge status="ACTIVE" label="Primary" />
                                )}
                              </div>
                              <span>
                                {[
                                  address.addressLine1,
                                  address.addressLine2,
                                  address.city,
                                  address.state,
                                  address.postalCode,
                                  address.country
                                ]
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            </div>
                            {canManage && (
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  onClick={() => openAddress(address)}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  className="icon-button danger"
                                  onClick={() => removeAddress(address.id)}
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
                )}

                {activeTab === 'contacts' && (
                  <div className="panel-card">
                    <div className="panel-heading">
                      <div>
                        <h2>Supplier Contact Persons</h2>
                        <p>Add sales, technical, QA/QC and management contacts.</p>
                      </div>
                      {canManage && (
                        <button
                          className="primary-button"
                          onClick={() => openContact()}
                        >
                          <Plus size={16} /> Add contact
                        </button>
                      )}
                    </div>
                    {!selected.contacts?.length ? (
                      <EmptyState title="No supplier contacts" />
                    ) : (
                      <div className="cards-grid compact">
                        {selected.contacts.map((contact) => (
                          <div className="entity-card" key={contact.id}>
                            <Users size={20} />
                            <div className="entity-content">
                              <div className="entity-title">
                                <strong>{contact.name}</strong>
                                {contact.isPrimary && (
                                  <StatusBadge status="ACTIVE" label="Primary" />
                                )}
                              </div>
                              <span>
                                {contact.jobTitle || 'No job title'}
                                {contact.department
                                  ? ` · ${contact.department}`
                                  : ''}
                              </span>
                              <span>{contact.email || 'No email'}</span>
                              <span>
                                {contact.phone || contact.mobile || 'No phone'}
                              </span>
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
                )}

                {activeTab === 'documents' && (
                  <div className="panel-card">
                    <div className="panel-heading">
                      <div>
                        <h2>Supplier Legal Documents & Certifications</h2>
                        <p>
                          Link existing files from Document Library so they stay
                          visible to the company and reusable in PQDs.
                        </p>
                      </div>
                      {canManage && (
                        <button
                          className="primary-button"
                          onClick={() => setProfileDocumentOpen(true)}
                        >
                          <Link2 size={16} /> Link document
                        </button>
                      )}
                    </div>
                    {!selected.profileDocuments?.length ? (
                      <EmptyState title="No supplier profile documents" />
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Document</th>
                              <th>Number</th>
                              <th>Expiry</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selected.profileDocuments.map((link) => (
                              <tr key={link.id}>
                                <td>{link.type}</td>
                                <td>
                                  <strong>{link.document?.title || 'Missing'}</strong>
                                </td>
                                <td>{link.document?.documentNumber || '—'}</td>
                                <td>
                                  {link.document?.expiryNotApplicable
                                    ? 'N/A'
                                    : link.document?.expiryDate || '—'}
                                </td>
                                <td>
                                  <StatusBadge
                                    status={link.document?.statusInfo?.key}
                                    label={link.document?.statusInfo?.label}
                                  />
                                </td>
                                <td>
                                  {canManage && (
                                    <button
                                      className="icon-button danger"
                                      onClick={() =>
                                        removeProfileDocument(link.id)
                                      }
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'products' && (
                  <div className="product-workspace">
                    <div className="panel-card product-directory">
                      <div className="panel-heading">
                        <div>
                          <h2>Products</h2>
                          <p>All products offered by this supplier.</p>
                        </div>
                        {canManage && (
                          <button
                            className="primary-button"
                            onClick={() => openProduct()}
                          >
                            <Plus size={16} /> Add product
                          </button>
                        )}
                      </div>

                      {!selected.products?.length ? (
                        <EmptyState title="No products listed" />
                      ) : (
                        <div className="product-chip-list">
                          {selected.products.map((product) => (
                            <button
                              type="button"
                              key={product.id}
                              className={`product-chip ${
                                activeProductId === product.id ? 'active' : ''
                              }`}
                              onClick={() => setActiveProductId(product.id)}
                            >
                              <Package size={18} />
                              <span>
                                <strong>{product.name}</strong>
                                <small>
                                  {[product.code, product.model]
                                    .filter(Boolean)
                                    .join(' · ') || 'No code/model'}
                                </small>
                              </span>
                              <StatusBadge
                                status={product.isActive ? 'ACTIVE' : 'INACTIVE'}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {activeProduct && (
                      <div className="panel-card">
                        <div className="panel-heading">
                          <div>
                            <h2>{activeProduct.name}</h2>
                            <p>
                              {[activeProduct.brand, activeProduct.model]
                                .filter(Boolean)
                                .join(' · ') || 'Product profile'}
                            </p>
                          </div>
                          {canManage && (
                            <div className="row-actions">
                              <button
                                className="secondary-button"
                                onClick={() => openProduct(activeProduct)}
                              >
                                <Pencil size={16} /> Edit product
                              </button>
                              <button
                                className="secondary-button danger"
                                onClick={() =>
                                  deactivateProduct(activeProduct.id)
                                }
                              >
                                <Trash2 size={16} /> Deactivate
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="product-facts">
                          <div>
                            <span>Code</span>
                            <strong>{activeProduct.code || '—'}</strong>
                          </div>
                          <div>
                            <span>Model</span>
                            <strong>{activeProduct.model || '—'}</strong>
                          </div>
                          <div>
                            <span>Category</span>
                            <strong>{activeProduct.category || '—'}</strong>
                          </div>
                          <div>
                            <span>Manufacturer</span>
                            <strong>{activeProduct.manufacturer || '—'}</strong>
                          </div>
                          <div>
                            <span>Country of origin</span>
                            <strong>{activeProduct.countryOfOrigin || '—'}</strong>
                          </div>
                        </div>

                        <div className="panel-heading section-gap">
                          <div>
                            <h3>Product Documents by Checklist Requirement</h3>
                            <p>
                              Map datasheets, compliance sheets, catalogues,
                              reports and other files to Master Checklist items.
                            </p>
                          </div>
                          {canManage && (
                            <button
                              className="primary-button"
                              onClick={() => setProductDocumentOpen(true)}
                            >
                              <Link2 size={16} /> Map product document
                            </button>
                          )}
                        </div>

                        {!activeProduct.documentLinks?.length ? (
                          <EmptyState title="No product documents mapped" />
                        ) : (
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Master Checklist Requirement</th>
                                  <th>Product Document</th>
                                  <th>Type</th>
                                  <th>Status</th>
                                  <th>Priority</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeProduct.documentLinks.map((link) => (
                                  <tr key={link.id}>
                                    <td>
                                      <strong>
                                        {link.masterItem?.title || 'Missing item'}
                                      </strong>
                                    </td>
                                    <td>{link.document?.title || 'Missing file'}</td>
                                    <td>{link.document?.documentType || '—'}</td>
                                    <td>
                                      <StatusBadge
                                        status={link.document?.statusInfo?.key}
                                        label={link.document?.statusInfo?.label}
                                      />
                                    </td>
                                    <td>{link.priority || 1}</td>
                                    <td>
                                      {canManage && (
                                        <button
                                          className="icon-button danger"
                                          onClick={() =>
                                            removeProductDocument(link.id)
                                          }
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <Modal
        open={supplierOpen}
        title={supplierEditingId ? 'Edit Supplier' : 'Create Supplier'}
        onClose={() => setSupplierOpen(false)}
        width="860px"
      >
        <form className="form-grid two" onSubmit={saveSupplier}>
          <label>
            Supplier name
            <input
              value={supplierForm.name}
              onChange={(event) =>
                setSupplierForm({ ...supplierForm, name: event.target.value })
              }
              required
            />
          </label>
          <label>
            Supplier code
            <input
              value={supplierForm.code || ''}
              onChange={(event) =>
                setSupplierForm({ ...supplierForm, code: event.target.value })
              }
            />
          </label>
          <label>
            Registration / CR number
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
            Year established
            <input
              type="number"
              value={supplierForm.yearEstablished || ''}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  yearEstablished: event.target.value
                })
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={supplierForm.email || ''}
              onChange={(event) =>
                setSupplierForm({ ...supplierForm, email: event.target.value })
              }
            />
          </label>
          <label>
            Phone
            <input
              value={supplierForm.phone || ''}
              onChange={(event) =>
                setSupplierForm({ ...supplierForm, phone: event.target.value })
              }
            />
          </label>
          <label>
            Fax
            <input
              value={supplierForm.fax || ''}
              onChange={(event) =>
                setSupplierForm({ ...supplierForm, fax: event.target.value })
              }
            />
          </label>
          <label>
            Website
            <input
              type="url"
              value={supplierForm.website || ''}
              onChange={(event) =>
                setSupplierForm({ ...supplierForm, website: event.target.value })
              }
            />
          </label>
          <label className="span-2">
            Nature of business
            <textarea
              rows="3"
              value={supplierForm.natureOfBusiness || ''}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  natureOfBusiness: event.target.value
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
            <button className="primary-button" disabled={saving}>
              <Save size={17} /> Save supplier
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={addressOpen}
        title={addressEditingId ? 'Edit Supplier Address' : 'Add Supplier Address'}
        onClose={() => setAddressOpen(false)}
      >
        <form className="form-grid two" onSubmit={saveAddress}>
          {[
            ['label', 'Address label'],
            ['addressLine1', 'Address line 1'],
            ['addressLine2', 'Address line 2'],
            ['city', 'City'],
            ['state', 'State / Province'],
            ['postalCode', 'Postal code'],
            ['country', 'Country']
          ].map(([key, label]) => (
            <label key={key} className={key.startsWith('addressLine') ? 'span-2' : ''}>
              {label}
              <input
                value={addressForm[key] || ''}
                onChange={(event) =>
                  setAddressForm({ ...addressForm, [key]: event.target.value })
                }
                required={key === 'addressLine1'}
              />
            </label>
          ))}
          <label className="switch-row span-2">
            <span><strong>Primary address</strong></span>
            <input
              type="checkbox"
              checked={Boolean(addressForm.isPrimary)}
              onChange={(event) =>
                setAddressForm({
                  ...addressForm,
                  isPrimary: event.target.checked
                })
              }
            />
          </label>
          <div className="form-actions span-2">
            <button className="primary-button"><Save size={17} /> Save address</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={contactOpen}
        title={contactEditingId ? 'Edit Supplier Contact' : 'Add Supplier Contact'}
        onClose={() => setContactOpen(false)}
      >
        <form className="form-grid two" onSubmit={saveContact}>
          {[
            ['name', 'Name'],
            ['jobTitle', 'Job title'],
            ['department', 'Department'],
            ['email', 'Email'],
            ['phone', 'Phone'],
            ['mobile', 'Mobile']
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type={key === 'email' ? 'email' : 'text'}
                value={contactForm[key] || ''}
                onChange={(event) =>
                  setContactForm({ ...contactForm, [key]: event.target.value })
                }
                required={key === 'name'}
              />
            </label>
          ))}
          <label className="switch-row span-2">
            <span><strong>Primary contact</strong></span>
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
            <button className="primary-button"><Save size={17} /> Save contact</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={profileDocumentOpen}
        title="Link Supplier Profile Document"
        onClose={() => setProfileDocumentOpen(false)}
      >
        <form className="form-grid two" onSubmit={saveProfileDocument}>
          <label>
            Document section
            <select
              value={profileDocumentForm.type}
              onChange={(event) =>
                setProfileDocumentForm({
                  ...profileDocumentForm,
                  type: event.target.value
                })
              }
            >
              <option value="LEGAL">Legal Document</option>
              <option value="CERTIFICATION">Certification</option>
            </select>
          </label>
          <label>
            Document Library file
            <select
              value={profileDocumentForm.documentId}
              onChange={(event) =>
                setProfileDocumentForm({
                  ...profileDocumentForm,
                  documentId: event.target.value
                })
              }
              required
            >
              <option value="">Select document</option>
              {documents
                .filter((document) => !document.isArchived)
                .map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title} — {document.category}
                  </option>
                ))}
            </select>
          </label>
          <label className="span-2">
            Remarks
            <textarea
              rows="3"
              value={profileDocumentForm.remarks}
              onChange={(event) =>
                setProfileDocumentForm({
                  ...profileDocumentForm,
                  remarks: event.target.value
                })
              }
            />
          </label>
          <div className="form-actions span-2">
            <button className="primary-button"><Link2 size={17} /> Link document</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={productOpen}
        title={productEditingId ? 'Edit Supplier Product' : 'Add Supplier Product'}
        onClose={() => setProductOpen(false)}
        width="860px"
      >
        <form className="form-grid two" onSubmit={saveProduct}>
          {[
            ['name', 'Product name'],
            ['code', 'Product code'],
            ['model', 'Model'],
            ['brand', 'Brand'],
            ['category', 'Category'],
            ['manufacturer', 'Manufacturer'],
            ['countryOfOrigin', 'Country of origin']
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={productForm[key] || ''}
                onChange={(event) =>
                  setProductForm({ ...productForm, [key]: event.target.value })
                }
                required={key === 'name'}
              />
            </label>
          ))}
          <label className="span-2">
            Product description
            <textarea
              rows="4"
              value={productForm.description || ''}
              onChange={(event) =>
                setProductForm({
                  ...productForm,
                  description: event.target.value
                })
              }
            />
          </label>
          <div className="form-actions span-2">
            <button className="primary-button"><Save size={17} /> Save product</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={productDocumentOpen}
        title={`Map Document to ${activeProduct?.name || 'Product'}`}
        onClose={() => setProductDocumentOpen(false)}
        width="860px"
      >
        <form className="form-grid two" onSubmit={saveProductDocument}>
          <label className="span-2">
            Master Checklist requirement
            <select
              value={productDocumentForm.masterItemId}
              onChange={(event) =>
                setProductDocumentForm({
                  ...productDocumentForm,
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
            Product document from Document Library
            <select
              value={productDocumentForm.documentId}
              onChange={(event) =>
                setProductDocumentForm({
                  ...productDocumentForm,
                  documentId: event.target.value
                })
              }
              required
            >
              <option value="">Select document</option>
              {documents
                .filter((document) => !document.isArchived)
                .map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title} — {document.documentType || document.category}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Priority
            <input
              type="number"
              min="1"
              value={productDocumentForm.priority}
              onChange={(event) =>
                setProductDocumentForm({
                  ...productDocumentForm,
                  priority: Number(event.target.value) || 1
                })
              }
            />
          </label>
          <label>
            Remarks
            <input
              value={productDocumentForm.remarks}
              onChange={(event) =>
                setProductDocumentForm({
                  ...productDocumentForm,
                  remarks: event.target.value
                })
              }
            />
          </label>
          <div className="form-actions span-2">
            <button className="primary-button"><Link2 size={17} /> Save mapping</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
