import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Download,
  Eye,
  FilePlus2,
  Filter,
  Pencil,
  Search,
  Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, {
  downloadWithAuth,
  viewWithAuth
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  WarningBox
} from '../components/Common';

const blank = {
  title: '',
  category: 'Certificates',
  documentNumber: '',
  issuingAuthority: '',
  issueDate: '',
  expiryDate: '',
  expiryNotApplicable: false,
  documentType: '',
  remarks: '',
  file: null,
  ocrData: null
};

const categoryOptions = [
  'Certificates',
  'Legal Documents',
  'Company Documents',
  'Technical Documents',
  'Approvals',
  'Datasheets',
  'Reports',
  'Catalogues',
  'Warranty Letters',
  'Other'
];

const suggestCategory = (fields, currentCategory) => {
  const text = `${fields?.title || ''} ${fields?.documentNumber || ''}`;
  if (/\biso\b|certificate/i.test(text)) return 'Certificates';
  if (/registration|licen[cs]e|permit|commercial|legal/i.test(text)) {
    return 'Legal Documents';
  }
  return currentCategory;
};

export default function DocumentsPage() {
  const { selectedCompanyId, user, appendCompany } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [replacementFile, setReplacementFile] = useState(null);

  const companyReady =
    user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);

  const load = async () => {
    if (!companyReady) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get(appendCompany('/documents'));
      setDocuments(data.documents || []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not load documents'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedCompanyId]);

  const categories = useMemo(
    () => [...new Set(documents.map((doc) => doc.category))].sort(),
    [documents]
  );

  const filtered = documents.filter((doc) => {
    const searchable = `${doc.title} ${doc.originalName} ${
      doc.documentNumber || ''
    } ${doc.issuingAuthority || ''}`.toLowerCase();

    return (
      (!search || searchable.includes(search.toLowerCase())) &&
      (!category || doc.category === category)
    );
  });

  const resetUpload = () => {
    setForm(blank);
    setExtracting(false);
  };

  const extractSelectedFile = async (file) => {
    setForm((current) => ({
      ...current,
      file,
      ocrData: null
    }));

    if (!file) return;

    const body = new FormData();
    body.append('file', file);
    if (selectedCompanyId) body.append('companyId', selectedCompanyId);

    setExtracting(true);
    try {
      const { data } = await api.post(
        appendCompany('/documents/extract'),
        body,
        { timeout: 120000 }
      );

      const extraction = data.extraction || {};
      const fields = extraction.fields || {};

      setForm((current) => ({
        ...current,
        file,
        title: fields.title || current.title,
        category: suggestCategory(fields, current.category),
        documentNumber:
          fields.documentNumber || current.documentNumber,
        issuingAuthority:
          fields.authority || current.issuingAuthority,
        issueDate: fields.issueDate || current.issueDate,
        expiryDate: current.expiryNotApplicable
          ? ''
          : fields.expiryDate || current.expiryDate,
        documentType:
          current.documentType ||
          (/certificate/i.test(fields.title || '')
            ? 'Certificate'
            : /registration|licen[cs]e|permit/i.test(
                  fields.title || ''
                )
              ? 'Legal Document'
              : ''),
        ocrData: extraction
      }));

      const detected = Object.values(fields).filter(Boolean).length;
      if (detected) {
        toast.success(
          `${detected} field(s) extracted. Please verify before saving.`
        );
      } else {
        toast(
          extraction.warning ||
            'No reliable document fields were detected.'
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'OCR extraction failed'
      );
    } finally {
      setExtracting(false);
    }
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!form.file) return toast.error('Choose a file');

    setSaving(true);
    const body = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (key === 'file') return;
      if (key === 'ocrData') {
        if (value) body.append('ocrData', JSON.stringify(value));
        return;
      }
      if (value !== null && value !== undefined) {
        body.append(key, String(value));
      }
    });

    body.append('file', form.file);
    if (selectedCompanyId) body.append('companyId', selectedCompanyId);

    try {
      await api.post(appendCompany('/documents'), body, { timeout: 120000 });
      toast.success('Document uploaded');
      setOpen(false);
      resetUpload();
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (doc) => {
    setEditForm({
      id: doc.id,
      title: doc.title || '',
      category: doc.category || 'Other',
      documentNumber: doc.documentNumber || '',
      issuingAuthority: doc.issuingAuthority || '',
      issueDate: doc.issueDate || '',
      expiryDate: doc.expiryDate || '',
      expiryNotApplicable: Boolean(doc.expiryNotApplicable),
      documentType: doc.documentType || '',
      remarks: doc.remarks || ''
    });
    setReplacementFile(null);
    setEditOpen(true);
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await api.put(
        appendCompany(`/documents/${editForm.id}`),
        editForm
      );

      if (replacementFile) {
        const body = new FormData();
        body.append('file', replacementFile);
        body.append('applyOcrFields', 'false');
        if (selectedCompanyId) {
          body.append('companyId', selectedCompanyId);
        }
        await api.post(
          appendCompany(`/documents/${editForm.id}/replace`),
          body,
          { timeout: 120000 }
        );
      }

      toast.success('Document updated');
      setEditOpen(false);
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not update document'
      );
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id) => {
    if (
      !window.confirm(
        'Archive this document? Existing PQD records will remain safe.'
      )
    ) {
      return;
    }

    try {
      await api.delete(appendCompany(`/documents/${id}`));
      toast.success('Document archived');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Archive failed');
    }
  };

  const download = async (doc) => {
    try {
      await downloadWithAuth(
        appendCompany(`/documents/${doc.id}/download`),
        doc.originalName
      );
    } catch {
      toast.error('Download failed');
    }
  };

  const view = async (doc) => {
    try {
      await viewWithAuth(
        appendCompany(`/documents/${doc.id}/view`)
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Document preview failed'
      );
    }
  };

  if (!companyReady) {
    return (
      <WarningBox title="Select a company">
        Choose a company from the top-right selector before managing its
        document library.
      </WarningBox>
    );
  }

  return (
    <>
      <PageHeader
        title="Document Library"
        description="Upload reusable company, legal and technical documents. OCR suggestions appear immediately after file selection."
        actions={
          <button
            className="primary-button"
            onClick={() => {
              resetUpload();
              setOpen(true);
            }}
          >
            <FilePlus2 size={17} /> Upload document
          </button>
        }
      />

      <div className="filter-bar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Search title, number or authority…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <label className="select-inline">
          <Filter size={16} />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : !filtered.length ? (
        <EmptyState
          title="No documents found"
          description="Upload a document or adjust the current filters."
        />
      ) : (
        <div className="table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Number / Authority</th>
                  <th>Issue Date</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="document-cell">
                        <div className="file-icon">FILE</div>
                        <div>
                          <strong>{doc.title}</strong>
                          <span>{doc.originalName}</span>
                        </div>
                      </div>
                    </td>
                    <td>{doc.category}</td>
                    <td>
                      <strong>{doc.documentNumber || '—'}</strong>
                      <span className="table-subtext">
                        {doc.issuingAuthority || 'No authority'}
                      </span>
                    </td>
                    <td>{doc.issueDate || '—'}</td>
                    <td>
                      {doc.expiryNotApplicable
                        ? 'N/A'
                        : doc.expiryDate || '—'}
                    </td>
                    <td>
                      <StatusBadge
                        status={doc.statusInfo?.key}
                        label={doc.statusInfo?.label}
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          title="View document"
                          onClick={() => view(doc)}
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          className="icon-button"
                          title="Edit metadata or replace file"
                          onClick={() => openEdit(doc)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button"
                          title="Download"
                          onClick={() => download(doc)}
                        >
                          <Download size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          title="Archive"
                          onClick={() => archive(doc.id)}
                        >
                          <Archive size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={open}
        title="Upload Document"
        onClose={() => {
          if (!saving && !extracting) {
            setOpen(false);
            resetUpload();
          }
        }}
        width="860px"
      >
        <form className="form-grid two" onSubmit={upload}>
          <label>
            Document title
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="e.g. ISO 9001 Certificate"
              required
            />
          </label>

          <label>
            Category
            <select
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            >
              {categoryOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Document number
            <input
              value={form.documentNumber}
              onChange={(event) =>
                setForm({
                  ...form,
                  documentNumber: event.target.value
                })
              }
            />
          </label>

          <label>
            Issuing authority
            <input
              value={form.issuingAuthority}
              onChange={(event) =>
                setForm({
                  ...form,
                  issuingAuthority: event.target.value
                })
              }
            />
          </label>

          <label>
            Issue date
            <input
              type="date"
              value={form.issueDate}
              onChange={(event) =>
                setForm({ ...form, issueDate: event.target.value })
              }
            />
          </label>

          <label>
            Expiry date
            <input
              type="date"
              value={form.expiryDate}
              disabled={form.expiryNotApplicable}
              onChange={(event) =>
                setForm({ ...form, expiryDate: event.target.value })
              }
            />
          </label>

          <label>
            Document type
            <input
              value={form.documentType}
              onChange={(event) =>
                setForm({ ...form, documentType: event.target.value })
              }
              placeholder="Certificate, Drawing, Report…"
            />
          </label>

          <label className="switch-row">
            <span>
              <strong>Expiry not applicable</strong>
            </span>
            <input
              type="checkbox"
              checked={Boolean(form.expiryNotApplicable)}
              onChange={(event) =>
                setForm({
                  ...form,
                  expiryNotApplicable: event.target.checked,
                  expiryDate: event.target.checked ? '' : form.expiryDate
                })
              }
            />
          </label>

          <label className="span-2">
            File
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(event) =>
                extractSelectedFile(event.target.files?.[0] || null)
              }
              required
            />
          </label>

          {extracting && (
            <div className="ocr-progress span-2">
              <span className="spinner" />
              Extracting title, document number, authority and dates…
            </div>
          )}

          {form.ocrData && !extracting && (
            <div className="ocr-result-card span-2">
              <strong>Automatic extraction completed</strong>
              <span>Method: {form.ocrData.method || 'Unknown'}</span>
              <span>
                {form.ocrData.warning ||
                  'Verify every suggested field before saving.'}
              </span>
            </div>
          )}

          <label className="span-2">
            Remarks
            <textarea
              rows="3"
              value={form.remarks}
              onChange={(event) =>
                setForm({ ...form, remarks: event.target.value })
              }
            />
          </label>

          <div className="form-actions span-2">
            <button
              className="primary-button"
              disabled={saving || extracting}
            >
              <Upload size={17} />
              {saving ? 'Uploading…' : 'Upload document'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        title="Edit Document"
        onClose={() => !saving && setEditOpen(false)}
        width="860px"
      >
        {editForm && (
          <form className="form-grid two" onSubmit={saveEdit}>
            <label>
              Document title
              <input
                value={editForm.title}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    title: event.target.value
                  })
                }
                required
              />
            </label>

            <label>
              Category
              <select
                value={editForm.category}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    category: event.target.value
                  })
                }
              >
                {categoryOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Document number
              <input
                value={editForm.documentNumber}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    documentNumber: event.target.value
                  })
                }
              />
            </label>

            <label>
              Issuing authority
              <input
                value={editForm.issuingAuthority}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    issuingAuthority: event.target.value
                  })
                }
              />
            </label>

            <label>
              Issue date
              <input
                type="date"
                value={editForm.issueDate}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    issueDate: event.target.value
                  })
                }
              />
            </label>

            <label>
              Expiry date
              <input
                type="date"
                value={editForm.expiryDate}
                disabled={editForm.expiryNotApplicable}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    expiryDate: event.target.value
                  })
                }
              />
            </label>

            <label>
              Document type
              <input
                value={editForm.documentType}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    documentType: event.target.value
                  })
                }
              />
            </label>

            <label className="switch-row">
              <span>
                <strong>Expiry not applicable</strong>
              </span>
              <input
                type="checkbox"
                checked={Boolean(editForm.expiryNotApplicable)}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    expiryNotApplicable: event.target.checked,
                    expiryDate: event.target.checked
                      ? ''
                      : editForm.expiryDate
                  })
                }
              />
            </label>

            <label className="span-2">
              Replacement file (optional)
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                onChange={(event) =>
                  setReplacementFile(event.target.files?.[0] || null)
                }
              />
            </label>

            <label className="span-2">
              Remarks
              <textarea
                rows="3"
                value={editForm.remarks}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    remarks: event.target.value
                  })
                }
              />
            </label>

            <div className="form-actions span-2">
              <button className="primary-button" disabled={saving}>
                <Pencil size={17} />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
