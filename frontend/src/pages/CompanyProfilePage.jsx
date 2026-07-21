import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Building2,
  Download,
  FileText,
  Link2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { downloadWithAuth } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  WarningBox
} from '../components/Common';

const emptyProfile = {
  name: '',
  crNumber: '',
  yearEstablished: '',
  natureOfWork: '',
  contactPerson: '',
  email: '',
  phone: '',
  fax: '',
  website: '',
  settings: {}
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

const blankSocial = {
  platform: 'LinkedIn',
  url: '',
  sortOrder: 0
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

const blankDocument = {
  type: 'LEGAL',
  title: '',
  documentNumber: '',
  issueDate: '',
  expiryDate: '',
  expiryNotApplicable: false,
  authority: '',
  remarks: '',
  file: null,
  applyOcrDate: false,
  ocrData: null
};

const tabs = [
  { key: 'company', label: 'Company Info', icon: Building2 },
  { key: 'legal', label: 'Legal Documents', icon: FileText },
  { key: 'certifications', label: 'Certifications', icon: Award },
  { key: 'contacts', label: 'Contacts', icon: Users }
];

const addressText = (address) => [
  address.addressLine1,
  address.addressLine2,
  address.city,
  address.state,
  address.postalCode,
  address.country
].filter(Boolean).join(', ');

export default function CompanyProfilePage() {
  const { user, selectedCompanyId } = useAuth();
  const companyId = user.role === 'SUPER_ADMIN' ? selectedCompanyId : user.companyId;
  const canEdit = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user.role);

  const [activeTab, setActiveTab] = useState('company');
  const [company, setCompany] = useState(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [logo, setLogo] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [addressOpen, setAddressOpen] = useState(false);
  const [addressForm, setAddressForm] = useState(blankAddress);
  const [addressEditingId, setAddressEditingId] = useState(null);

  const [socialOpen, setSocialOpen] = useState(false);
  const [socialForm, setSocialForm] = useState(blankSocial);
  const [socialEditingId, setSocialEditingId] = useState(null);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState(blankContact);
  const [contactEditingId, setContactEditingId] = useState(null);

  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentForm, setDocumentForm] = useState(blankDocument);
  const [documentEditingId, setDocumentEditingId] = useState(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  const load = async () => {
    if (!companyId) {
      setCompany(null);
      setProfile(emptyProfile);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get(`/companies/${companyId}`);
      setCompany(data.company);
      setProfile({
        ...emptyProfile,
        ...data.company,
        yearEstablished: data.company.yearEstablished || '',
        settings: data.company.settings || {}
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load company profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;

    if (!companyId || !company?.logoPath) {
      setLogoPreviewUrl('');
      return undefined;
    }

    api.get(`/companies/${companyId}/logo`, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setLogoPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setLogoPreviewUrl('');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [companyId, company?.logoPath]);

  const legalDocuments = useMemo(
    () => (company?.profileDocuments || []).filter((item) => item.type === 'LEGAL'),
    [company]
  );

  const certifications = useMemo(
    () => (company?.profileDocuments || []).filter((item) => item.type === 'CERTIFICATION'),
    [company]
  );

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: profile.name,
        crNumber: profile.crNumber || null,
        yearEstablished: profile.yearEstablished || null,
        natureOfWork: profile.natureOfWork || null,
        contactPerson: profile.contactPerson || null,
        email: profile.email || null,
        phone: profile.phone || null,
        fax: profile.fax || null,
        website: profile.website || null,
        settings: profile.settings || {}
      };

      await api.put(`/companies/${companyId}`, payload);
      toast.success('Company profile saved');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save company profile');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async () => {
    if (!logo) return toast.error('Choose a logo first');

    const body = new FormData();
    body.append('logo', logo);

    try {
      await api.post(`/companies/${companyId}/logo`, body);
      toast.success('Logo uploaded');
      setLogo(null);
      await load();
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
    setSaving(true);

    try {
      if (addressEditingId) {
        await api.put(`/companies/${companyId}/addresses/${addressEditingId}`, addressForm);
        toast.success('Address updated');
      } else {
        await api.post(`/companies/${companyId}/addresses`, addressForm);
        toast.success('Address added');
      }

      setAddressOpen(false);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save address');
    } finally {
      setSaving(false);
    }
  };

  const removeAddress = async (id) => {
    if (!window.confirm('Remove this address?')) return;
    try {
      await api.delete(`/companies/${companyId}/addresses/${id}`);
      toast.success('Address removed');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not remove address');
    }
  };

  const openSocial = (link = null) => {
    setSocialEditingId(link?.id || null);
    setSocialForm(link ? { ...blankSocial, ...link } : blankSocial);
    setSocialOpen(true);
  };

  const saveSocial = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (socialEditingId) {
        await api.put(`/companies/${companyId}/social-links/${socialEditingId}`, socialForm);
        toast.success('Social link updated');
      } else {
        await api.post(`/companies/${companyId}/social-links`, socialForm);
        toast.success('Social link added');
      }

      setSocialOpen(false);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save social link');
    } finally {
      setSaving(false);
    }
  };

  const removeSocial = async (id) => {
    if (!window.confirm('Remove this social link?')) return;
    try {
      await api.delete(`/companies/${companyId}/social-links/${id}`);
      toast.success('Social link removed');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not remove social link');
    }
  };

  const openContact = (contact = null) => {
    setContactEditingId(contact?.id || null);
    setContactForm(contact ? { ...blankContact, ...contact } : blankContact);
    setContactOpen(true);
  };

  const saveContact = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (contactEditingId) {
        await api.put(`/companies/${companyId}/contacts/${contactEditingId}`, contactForm);
        toast.success('Contact updated');
      } else {
        await api.post(`/companies/${companyId}/contacts`, contactForm);
        toast.success('Contact added');
      }

      setContactOpen(false);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save contact');
    } finally {
      setSaving(false);
    }
  };

  const removeContact = async (id) => {
    if (!window.confirm('Remove this contact person?')) return;
    try {
      await api.delete(`/companies/${companyId}/contacts/${id}`);
      toast.success('Contact removed');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not remove contact');
    }
  };

  const openDocument = (type, document = null) => {
    setDocumentEditingId(document?.id || null);
    setDocumentForm(document
      ? {
          ...blankDocument,
          ...document,
          file: null,
          type,
          expiryNotApplicable: Boolean(document.expiryNotApplicable),
          ocrData: document.ocrData || null
        }
      : { ...blankDocument, type });
    setOcrResult(document?.ocrData || null);
    setDocumentOpen(true);
  };

  const extractSelectedDocument = async (file) => {
    setDocumentForm((current) => ({ ...current, file, ocrData: null }));
    setOcrResult(null);
    if (!file) return;

    setOcrBusy(true);
    const body = new FormData();
    body.append('file', file);

    try {
      const { data } = await api.post(
        `/companies/${companyId}/profile-documents/extract`,
        body,
        { timeout: 120000 }
      );
      const extraction = data.extraction || {};
      const fields = extraction.fields || {};

      setDocumentForm((current) => ({
        ...current,
        file,
        title: fields.title || current.title,
        documentNumber: fields.documentNumber || current.documentNumber,
        authority: fields.authority || current.authority,
        issueDate: fields.issueDate || current.issueDate,
        expiryDate: current.expiryNotApplicable
          ? ''
          : (fields.expiryDate || current.expiryDate),
        ocrData: extraction
      }));
      setOcrResult(extraction);

      const detected = Object.values(fields).filter(Boolean).length;
      if (detected) toast.success(`${detected} field(s) extracted. Please verify them.`);
      else toast(extraction.warning || 'No reliable fields were detected. Enter them manually.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'OCR extraction failed');
    } finally {
      setOcrBusy(false);
    }
  };

  const saveDocument = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      let result;

      if (documentEditingId) {
        const metadata = {
          type: documentForm.type,
          title: documentForm.title,
          documentNumber: documentForm.documentNumber || null,
          issueDate: documentForm.issueDate || null,
          expiryDate: documentForm.expiryNotApplicable ? null : (documentForm.expiryDate || null),
          expiryNotApplicable: documentForm.expiryNotApplicable,
          authority: documentForm.authority || null,
          remarks: documentForm.remarks || null
        };

        result = await api.put(
          `/companies/${companyId}/profile-documents/${documentEditingId}`,
          metadata
        );

        if (documentForm.file) {
          const replacement = new FormData();
          replacement.append('file', documentForm.file);
          replacement.append('applyOcrDate', String(documentForm.applyOcrDate));
          result = await api.post(
            `/companies/${companyId}/profile-documents/${documentEditingId}/replace`,
            replacement
          );
        }

        toast.success('Document updated');
      } else {
        if (!documentForm.file) {
          setSaving(false);
          return toast.error('Choose a file');
        }

        const body = new FormData();
        Object.entries(documentForm).forEach(([key, value]) => {
          if (key === 'file') return;
          if (key === 'ocrData') {
            if (value) body.append(key, JSON.stringify(value));
            return;
          }
          if (value !== null && value !== undefined) body.append(key, String(value));
        });
        body.append('file', documentForm.file);

        result = await api.post(`/companies/${companyId}/profile-documents`, body);
        toast.success('Document uploaded');
      }

      const savedDocument = result?.data?.document;
      if (savedDocument?.ocrData?.fields?.expiryDate) {
        toast.success(
          `Automatic expiry suggestion: ${savedDocument.ocrData.fields.expiryDate}. Please verify it.`
        );
      } else if (savedDocument?.ocrData?.warning) {
        toast(savedDocument.ocrData.warning);
      }

      setDocumentOpen(false);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save document');
    } finally {
      setSaving(false);
    }
  };

  const downloadDocument = async (document) => {
    try {
      await downloadWithAuth(
        `/companies/${companyId}/profile-documents/${document.id}/download`,
        document.originalName
      );
    } catch {
      toast.error('Download failed');
    }
  };

  const archiveDocument = async (id) => {
    if (!window.confirm('Archive this document?')) return;
    try {
      await api.delete(`/companies/${companyId}/profile-documents/${id}`);
      toast.success('Document archived');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not archive document');
    }
  };

  const renderDocuments = (type, rows) => (
    <div className="panel-card">
      <div className="panel-heading">
        <div>
          <h2>{type === 'LEGAL' ? 'Legal Documents' : 'Certifications'}</h2>
          <p>
            Store document number, issue date, expiry date, authority and file.
            Automatic extraction suggests an expiry date where possible; the date remains editable.
          </p>
        </div>
        {canEdit && (
          <button className="primary-button" onClick={() => openDocument(type)}>
            <Plus size={17} />
            {type === 'LEGAL' ? 'Add legal document' : 'Add certificate'}
          </button>
        )}
      </div>

      {!rows.length ? (
        <EmptyState
          title={type === 'LEGAL' ? 'No legal documents' : 'No certifications'}
          description="Add the first company profile document."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Number</th>
                <th>Authority</th>
                <th>Issue Date</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((document) => (
                <tr key={document.id}>
                  <td>
                    <strong>{document.title}</strong>
                    <span className="table-subtext">{document.originalName}</span>
                    {document.ocrData?.expiryDate && (
                      <span className="ocr-note">
                        OCR suggestion: {document.ocrData.expiryDate}
                      </span>
                    )}
                  </td>
                  <td>{document.documentNumber || '—'}</td>
                  <td>{document.authority || '—'}</td>
                  <td>{document.issueDate || '—'}</td>
                  <td>{document.expiryNotApplicable ? 'N/A' : (document.expiryDate || '—')}</td>
                  <td>
                    <StatusBadge
                      status={document.statusInfo?.key}
                      label={document.statusInfo?.label}
                    />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        title="Download"
                        onClick={() => downloadDocument(document)}
                      >
                        <Download size={16} />
                      </button>
                      {canEdit && (
                        <>
                          <button
                            className="icon-button"
                            title="Edit or replace"
                            onClick={() => openDocument(type, document)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button danger"
                            title="Archive"
                            onClick={() => archiveDocument(document.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (!companyId) {
    return (
      <WarningBox title="Select a company">
        Use the company selector in the top bar to open a company profile.
      </WarningBox>
    );
  }

  if (loading) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Company Master Profile"
        description="Manage company information, repeatable addresses, social links, legal documents, certifications and contacts."
      />

      <div className="profile-tabs" role="tablist">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`profile-tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'company' && (
        <>
          <div className="two-column-layout">
            <form className="panel-card form-card" onSubmit={saveProfile}>
              <div className="panel-heading">
                <div>
                  <h2>Company Information</h2>
                  <p>Core legal and commercial profile values used throughout the portal and PDF output.</p>
                </div>
              </div>

              <div className="form-grid two">
                <label>
                  Legal company name
                  <input
                    value={profile.name || ''}
                    onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                    required
                    disabled={!canEdit}
                  />
                </label>

                <label>
                  Commercial registration number
                  <input
                    value={profile.crNumber || ''}
                    onChange={(event) => setProfile({ ...profile, crNumber: event.target.value })}
                    disabled={!canEdit}
                  />
                </label>

                <label>
                  Year of establishment
                  <input
                    type="number"
                    min="1800"
                    max="2100"
                    value={profile.yearEstablished || ''}
                    onChange={(event) => setProfile({ ...profile, yearEstablished: event.target.value })}
                    disabled={!canEdit}
                  />
                </label>

                <label>
                  Telephone
                  <input
                    value={profile.phone || ''}
                    onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                    disabled={!canEdit}
                  />
                </label>

                <label>
                  Fax
                  <input
                    value={profile.fax || ''}
                    onChange={(event) => setProfile({ ...profile, fax: event.target.value })}
                    disabled={!canEdit}
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={profile.email || ''}
                    onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                    disabled={!canEdit}
                  />
                </label>

                <label className="span-2">
                  Website
                  <input
                    type="url"
                    value={profile.website || ''}
                    onChange={(event) => setProfile({ ...profile, website: event.target.value })}
                    placeholder="https://www.company.com"
                    disabled={!canEdit}
                  />
                </label>

                <label className="span-2">
                  Nature of work / activities
                  <textarea
                    rows="4"
                    value={profile.natureOfWork || ''}
                    onChange={(event) => setProfile({ ...profile, natureOfWork: event.target.value })}
                    placeholder="Civil construction, MEP, trading, manufacturing..."
                    disabled={!canEdit}
                  />
                </label>
              </div>

              {canEdit && (
                <div className="form-actions">
                  <button className="primary-button" disabled={saving}>
                    <Save size={17} />
                    {saving ? 'Saving…' : 'Save company profile'}
                  </button>
                </div>
              )}
            </form>

            <div className="panel-card">
              <div className="panel-heading">
                <div>
                  <h2>Company Branding</h2>
                  <p>Upload the logo shown on generated cover and section pages.</p>
                </div>
              </div>

              <div className="logo-preview">
                {logoPreviewUrl ? (
                  <img
                    src={logoPreviewUrl}
                    alt={`${profile.name || 'Company'} logo`}
                    className="company-logo-image"
                  />
                ) : (
                  <Building2 size={44} />
                )}
                <strong>{profile.name || 'Company name'}</strong>
                <span>{logoPreviewUrl ? 'Logo uploaded successfully.' : 'No logo uploaded yet.'}</span>
              </div>

              {canEdit && (
                <>
                  <label>
                    Logo file
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.jfif,.webp,.avif,.svg,image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
                      onChange={(event) => setLogo(event.target.files?.[0] || null)}
                    />
                  </label>
                  <button className="secondary-button full" type="button" onClick={uploadLogo}>
                    <Upload size={17} />
                    Upload logo
                  </button>
                </>
              )}
            </div>
          </div>

          <section className="panel-card section-gap">
            <div className="panel-heading">
              <div>
                <h2>Addresses</h2>
                <p>Add head office, branch, warehouse or other company addresses.</p>
              </div>
              {canEdit && (
                <button className="secondary-button" onClick={() => openAddress()}>
                  <Plus size={16} /> Add address
                </button>
              )}
            </div>

            {!company?.addresses?.length ? (
              <EmptyState title="No addresses" />
            ) : (
              <div className="cards-grid compact">
                {company.addresses.map((address) => (
                  <div className="entity-card" key={address.id}>
                    <div className="entity-icon"><MapPin size={20} /></div>
                    <div className="entity-content">
                      <div className="entity-title">
                        <strong>{address.label || 'Address'}</strong>
                        {address.isPrimary && <StatusBadge status="ACTIVE" label="Primary" />}
                      </div>
                      <span>{addressText(address)}</span>
                    </div>
                    {canEdit && (
                      <div className="row-actions">
                        <button className="icon-button" onClick={() => openAddress(address)}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-button danger" onClick={() => removeAddress(address.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel-card section-gap">
            <div className="panel-heading">
              <div>
                <h2>Social Media Links</h2>
                <p>Add repeatable website and social-media profile links.</p>
              </div>
              {canEdit && (
                <button className="secondary-button" onClick={() => openSocial()}>
                  <Plus size={16} /> Add social link
                </button>
              )}
            </div>

            {!company?.socialLinks?.length ? (
              <EmptyState title="No social links" />
            ) : (
              <div className="profile-link-list">
                {company.socialLinks.map((link) => (
                  <div className="profile-link-row" key={link.id}>
                    <Link2 size={18} />
                    <div>
                      <strong>{link.platform}</strong>
                      <a href={link.url} target="_blank" rel="noreferrer">{link.url}</a>
                    </div>
                    {canEdit && (
                      <div className="row-actions">
                        <button className="icon-button" onClick={() => openSocial(link)}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-button danger" onClick={() => removeSocial(link.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'legal' && renderDocuments('LEGAL', legalDocuments)}
      {activeTab === 'certifications' && renderDocuments('CERTIFICATION', certifications)}

      {activeTab === 'contacts' && (
        <div className="panel-card">
          <div className="panel-heading">
            <div>
              <h2>Contact Persons</h2>
              <p>Add directors, administrators, QA/QC contacts and other responsible persons.</p>
            </div>
            {canEdit && (
              <button className="primary-button" onClick={() => openContact()}>
                <Plus size={17} /> Add contact person
              </button>
            )}
          </div>

          {!company?.contacts?.length ? (
            <EmptyState title="No contact persons" />
          ) : (
            <div className="cards-grid compact">
              {company.contacts.map((contact) => (
                <div className="entity-card" key={contact.id}>
                  <div className="entity-icon"><Users size={20} /></div>
                  <div className="entity-content">
                    <div className="entity-title">
                      <strong>{contact.name}</strong>
                      {contact.isPrimary && <StatusBadge status="ACTIVE" label="Primary" />}
                    </div>
                    <span>{contact.jobTitle || 'No job title'}{contact.department ? ` · ${contact.department}` : ''}</span>
                    <span>{contact.email || 'No email'}</span>
                    <span>{contact.phone || contact.mobile || 'No phone'}</span>
                  </div>
                  {canEdit && (
                    <div className="row-actions">
                      <button className="icon-button" onClick={() => openContact(contact)}>
                        <Pencil size={16} />
                      </button>
                      <button className="icon-button danger" onClick={() => removeContact(contact.id)}>
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

      <Modal
        open={addressOpen}
        title={addressEditingId ? 'Edit Address' : 'Add Address'}
        onClose={() => setAddressOpen(false)}
      >
        <form className="form-grid two" onSubmit={saveAddress}>
          <label>Label<input value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} /></label>
          <label>Country<input value={addressForm.country} onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })} /></label>
          <label className="span-2">Address line 1<input value={addressForm.addressLine1} onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })} required /></label>
          <label className="span-2">Address line 2<input value={addressForm.addressLine2 || ''} onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })} /></label>
          <label>City<input value={addressForm.city || ''} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} /></label>
          <label>State / Province<input value={addressForm.state || ''} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} /></label>
          <label>Postal code<input value={addressForm.postalCode || ''} onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })} /></label>
          <label className="switch-row"><span><strong>Primary address</strong></span><input type="checkbox" checked={Boolean(addressForm.isPrimary)} onChange={(e) => setAddressForm({ ...addressForm, isPrimary: e.target.checked })} /></label>
          <div className="form-actions span-2"><button className="primary-button" disabled={saving}><Save size={17} /> Save address</button></div>
        </form>
      </Modal>

      <Modal
        open={socialOpen}
        title={socialEditingId ? 'Edit Social Link' : 'Add Social Link'}
        onClose={() => setSocialOpen(false)}
      >
        <form className="form-grid two" onSubmit={saveSocial}>
          <label>Platform<select value={socialForm.platform} onChange={(e) => setSocialForm({ ...socialForm, platform: e.target.value })}><option>LinkedIn</option><option>Facebook</option><option>Instagram</option><option>X</option><option>YouTube</option><option>Website</option><option>Other</option></select></label>
          <label>Display order<input type="number" value={socialForm.sortOrder || 0} onChange={(e) => setSocialForm({ ...socialForm, sortOrder: Number(e.target.value) })} /></label>
          <label className="span-2">URL<input type="url" value={socialForm.url} onChange={(e) => setSocialForm({ ...socialForm, url: e.target.value })} placeholder="https://..." required /></label>
          <div className="form-actions span-2"><button className="primary-button" disabled={saving}><Save size={17} /> Save social link</button></div>
        </form>
      </Modal>

      <Modal
        open={contactOpen}
        title={contactEditingId ? 'Edit Contact Person' : 'Add Contact Person'}
        onClose={() => setContactOpen(false)}
        width="820px"
      >
        <form className="form-grid two" onSubmit={saveContact}>
          <label>Name<input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required /></label>
          <label>Job title<input value={contactForm.jobTitle || ''} onChange={(e) => setContactForm({ ...contactForm, jobTitle: e.target.value })} /></label>
          <label>Department<input value={contactForm.department || ''} onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })} /></label>
          <label>Email<input type="email" value={contactForm.email || ''} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></label>
          <label>Phone<input value={contactForm.phone || ''} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></label>
          <label>Mobile<input value={contactForm.mobile || ''} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })} /></label>
          <label className="switch-row span-2"><span><strong>Primary contact</strong></span><input type="checkbox" checked={Boolean(contactForm.isPrimary)} onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })} /></label>
          <div className="form-actions span-2"><button className="primary-button" disabled={saving}><Save size={17} /> Save contact</button></div>
        </form>
      </Modal>

      <Modal
        open={documentOpen}
        title={`${documentEditingId ? 'Edit' : 'Add'} ${documentForm.type === 'LEGAL' ? 'Legal Document' : 'Certification'}`}
        onClose={() => setDocumentOpen(false)}
        width="860px"
      >
        <form className="form-grid two" onSubmit={saveDocument}>
          <label>Document title<input value={documentForm.title || ''} onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })} required /></label>
          <label>Document number<input value={documentForm.documentNumber || ''} onChange={(e) => setDocumentForm({ ...documentForm, documentNumber: e.target.value })} /></label>
          <label>Issuing authority<input value={documentForm.authority || ''} onChange={(e) => setDocumentForm({ ...documentForm, authority: e.target.value })} /></label>
          <label>Issue date<input type="date" value={documentForm.issueDate || ''} onChange={(e) => setDocumentForm({ ...documentForm, issueDate: e.target.value })} /></label>
          <label>Expiry date<input type="date" value={documentForm.expiryDate || ''} disabled={documentForm.expiryNotApplicable} onChange={(e) => setDocumentForm({ ...documentForm, expiryDate: e.target.value })} /></label>
          <label className="switch-row"><span><strong>Expiry not applicable</strong></span><input type="checkbox" checked={Boolean(documentForm.expiryNotApplicable)} onChange={(e) => setDocumentForm({ ...documentForm, expiryNotApplicable: e.target.checked, expiryDate: e.target.checked ? '' : documentForm.expiryDate })} /></label>
          <label className="span-2">File {documentEditingId && '(optional replacement)'}<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff" required={!documentEditingId} onChange={(e) => extractSelectedDocument(e.target.files?.[0] || null)} /></label>
          {ocrBusy && <div className="ocr-progress span-2"><span className="spinner" /> Extracting document title, number, authority and dates…</div>}
          {ocrResult && !ocrBusy && (
            <div className="ocr-result-card span-2">
              <strong>OCR extraction completed</strong>
              <span>Method: {ocrResult.method || 'Unknown'}</span>
              <span>{ocrResult.warning || 'Verify all extracted fields before saving.'}</span>
            </div>
          )}
          {documentEditingId && documentForm.file && (
            <label className="switch-row span-2"><span><strong>Apply OCR date from replacement</strong><small>Only enable after reviewing the new file.</small></span><input type="checkbox" checked={Boolean(documentForm.applyOcrDate)} onChange={(e) => setDocumentForm({ ...documentForm, applyOcrDate: e.target.checked })} /></label>
          )}
          <label className="span-2">Remarks<textarea rows="3" value={documentForm.remarks || ''} onChange={(e) => setDocumentForm({ ...documentForm, remarks: e.target.value })} /></label>
          <div className="ocr-help span-2">
            Choose a PDF or image and extraction starts immediately. The form is filled with suggested title, document number, authority, issue date and expiry date. Verify every value before saving.
          </div>
          <div className="form-actions span-2"><button className="primary-button" disabled={saving || ocrBusy}><Upload size={17} /> {saving ? 'Saving…' : 'Save document'}</button></div>
        </form>
      </Modal>
    </>
  );
}
