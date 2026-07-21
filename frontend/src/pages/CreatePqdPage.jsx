import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileDown,
  Play,
  Save,
  Truck
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { downloadWithAuth } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  LoadingBlock,
  PageHeader,
  WarningBox
} from '../components/Common';

export default function CreatePqdPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const companyReady =
    user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);

  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [projectId, setProjectId] = useState('');
  const [checklistId, setChecklistId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [matchPreview, setMatchPreview] = useState(null);

  const [submission, setSubmission] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadBase = async () => {
    if (!companyReady) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [projectRes, documentRes, supplierRes] = await Promise.all([
      api.get(appendCompany('/projects')),
      api.get(appendCompany('/documents')),
      api.get(appendCompany('/suppliers?active=true'))
    ]);

    const projectRows = projectRes.data.projects || [];
    const supplierRows = supplierRes.data.suppliers || [];

    setProjects(projectRows);
    setDocuments(documentRes.data.documents || []);
    setSuppliers(supplierRows);

    const submissionId = searchParams.get('submission');

    if (submissionId) {
      const { data } = await api.get(
        appendCompany(`/pqds/${submissionId}`)
      );

      setSubmission(data.submission);
      setValidation(data.validation);
      setProjectId(data.submission.projectId);
      setChecklistId(data.submission.childChecklistId);
      setSupplierId(
        data.submission.supplierId ||
          data.submission.supplier?.id ||
          ''
      );
    } else {
      setProjectId(projectRows[0]?.id || '');
      setSupplierId(supplierRows[0]?.id || '');
    }

    setLoading(false);
  };

  useEffect(() => {
    loadBase().catch((error) => {
      toast.error(
        error.response?.data?.message || 'Could not load PQD builder'
      );
      setLoading(false);
    });
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!projectId) {
      setChecklists([]);
      setChecklistId('');
      return;
    }

    api
      .get(
        appendCompany(
          `/checklists/project?projectId=${projectId}`
        )
      )
      .then(({ data }) => {
        const active = (data.checklists || []).filter(
          (item) => item.isActive
        );
        setChecklists(active);

        if (!submission) {
          setChecklistId(active[0]?.id || '');
        }
      });
  }, [projectId, selectedCompanyId]);

  useEffect(() => {
    if (submission || !supplierId || !checklistId) {
      setMatchPreview(null);
      return;
    }

    let cancelled = false;

    api
      .get(
        appendCompany(
          `/suppliers/${supplierId}/matches?childChecklistId=${checklistId}`
        )
      )
      .then(({ data }) => {
        if (!cancelled) setMatchPreview(data);
      })
      .catch(() => {
        if (!cancelled) setMatchPreview(null);
      });

    return () => {
      cancelled = true;
    };
  }, [supplierId, checklistId, selectedCompanyId, submission]);

  const activeDocuments = useMemo(
    () => documents.filter((document) => !document.isArchived),
    [documents]
  );

  const createDraft = async () => {
    if (!projectId || !checklistId || !supplierId) {
      return toast.error(
        'Select a project, Project Checklist and supplier.'
      );
    }

    setBusy(true);

    try {
      const { data } = await api.post('/pqds', {
        companyId: selectedCompanyId || undefined,
        projectId,
        childChecklistId: checklistId,
        supplierId
      });

      setSubmission(data.submission);
      setValidation(null);
      setSearchParams({ submission: data.submission.id });

      toast.success(
        `PQD draft created. ${data.autoMatchedCount || 0} of ${
          data.totalItemCount || 0
        } item(s) received supplier documents automatically.`
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not create draft'
      );
    } finally {
      setBusy(false);
    }
  };

  const changeItem = (id, field, value) => {
    setSubmission((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const saveDraft = async () => {
    setBusy(true);

    try {
      const { data } = await api.put(
        appendCompany(`/pqds/${submission.id}`),
        {
          title: submission.title,
          revision: submission.revision,
          items: submission.items.map((item, index) => ({
            id: item.id,
            titleSnapshot: item.titleSnapshot,
            status: item.status,
            remarks: item.remarks,
            includeInPdf: item.includeInPdf,
            sortOrder: index + 1,
            documentId:
              item.documentId || item.document?.id || null
          }))
        }
      );

      setSubmission(data.submission);
      setValidation(data.validation);
      toast.success('Draft saved');
      return data.submission;
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not save draft'
      );
      return null;
    } finally {
      setBusy(false);
    }
  };

  const generate = async (overrides = {}) => {
    const saved = await saveDraft();
    if (!saved) return;

    setBusy(true);

    try {
      const { data } = await api.post(
        appendCompany(`/pqds/${submission.id}/generate`),
        overrides
      );

      toast.success(
        `PDF version ${data.generatedPdf.version} generated`
      );

      const refreshed = await api.get(
        appendCompany(`/pqds/${submission.id}`)
      );
      setSubmission(refreshed.data.submission);
      setValidation(refreshed.data.validation);
    } catch (error) {
      if (error.response?.status === 409) {
        const warnings = error.response.data.validation;
        setValidation(warnings);

        const message = `This PQD has ${warnings.missing.length} missing and ${warnings.expired.length} expired document(s). Generate anyway?`;

        if (window.confirm(message)) {
          return generate({
            allowMissing: true,
            allowExpired: true
          });
        }
      } else {
        toast.error(
          error.response?.data?.message || 'PDF generation failed'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadLatest = async () => {
    const latest = submission.generatedPdfs?.[0];
    if (!latest) return;

    try {
      await downloadWithAuth(
        appendCompany(
          `/pqds/${submission.id}/versions/${latest.id}/download`
        ),
        latest.fileName
      );
    } catch {
      toast.error('Download failed');
    }
  };

  if (!companyReady) {
    return (
      <WarningBox title="Select a company">
        Choose a company before creating a PQD.
      </WarningBox>
    );
  }

  if (loading) return <LoadingBlock />;

  if (!projects.length) {
    return (
      <WarningBox title="Create a project first">
        A PQD must be linked to a project and one saved Project
        Checklist.
      </WarningBox>
    );
  }

  if (!suppliers.length) {
    return (
      <WarningBox title="Create a supplier profile first">
        Add an active supplier and map its documents to Master
        Checklist items before creating a PQD.{' '}
        <Link to="/suppliers">Open Supplier Profiles</Link>
      </WarningBox>
    );
  }

  return (
    <>
      <PageHeader
        title="Create / Edit PQD"
        description="Required sequence: Project → Project Checklist → Supplier. Supplier mappings automatically attach matching documents."
        actions={
          submission && (
            <>
              <button
                className="secondary-button"
                onClick={saveDraft}
                disabled={busy}
              >
                <Save size={17} /> Save draft
              </button>
              <button
                className="primary-button"
                onClick={() => generate()}
                disabled={busy}
              >
                <Play size={17} /> Generate PDF
              </button>
            </>
          )
        }
      />

      {!submission ? (
        <div className="panel-card setup-card">
          <div className="step-badge">Required sequence</div>
          <h2>Project → Project Checklist → Supplier</h2>
          <p>
            The portal compares the selected Project Checklist with
            supplier mappings and automatically selects matching
            supplier documents.
          </p>

          <div className="pqd-sequence-grid">
            <label>
              <span className="sequence-number">1</span>
              Project
              <select
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setChecklistId('');
                }}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}{' '}
                    {project.number ? `(${project.number})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="sequence-number">2</span>
              Saved Project Checklist
              <select
                value={checklistId}
                onChange={(event) =>
                  setChecklistId(event.target.value)
                }
              >
                <option value="">Select checklist</option>
                {checklists.map((checklist) => (
                  <option key={checklist.id} value={checklist.id}>
                    {checklist.name} ({checklist.items?.length || 0}{' '}
                    items)
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="sequence-number">3</span>
              Supplier
              <select
                value={supplierId}
                onChange={(event) =>
                  setSupplierId(event.target.value)
                }
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.code ? ` (${supplier.code})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!checklists.length && (
            <WarningBox title="No Project Checklist available">
              Create and save a Project Checklist for this project
              before starting the PQD.
            </WarningBox>
          )}

          {matchPreview && (
            <div className="supplier-match-preview">
              <Truck size={20} />
              <div>
                <strong>
                  {matchPreview.matchedItemCount} of{' '}
                  {matchPreview.totalItemCount} checklist item(s) have
                  supplier document mappings.
                </strong>
                <span>
                  Unmatched items remain empty and can be mapped
                  manually in the draft.
                </span>
              </div>
              <Link className="secondary-button" to="/suppliers">
                Manage mappings
              </Link>
            </div>
          )}

          <button
            className="primary-button"
            onClick={createDraft}
            disabled={
              busy || !projectId || !checklistId || !supplierId
            }
          >
            <FileCheck2 size={18} />{' '}
            {busy
              ? 'Creating…'
              : 'Create PQD draft and auto-match documents'}
          </button>
        </div>
      ) : (
        <div className="pqd-builder-layout">
          <section className="panel-card pqd-items-panel">
            <div className="builder-toolbar compact-toolbar">
              <label className="grow">
                Submission title
                <input
                  value={submission.title || ''}
                  onChange={(event) =>
                    setSubmission({
                      ...submission,
                      title: event.target.value
                    })
                  }
                />
              </label>

              <label>
                Revision
                <input
                  value={submission.revision || ''}
                  onChange={(event) =>
                    setSubmission({
                      ...submission,
                      revision: event.target.value
                    })
                  }
                />
              </label>

              <div className="readonly-field">
                <span>Project</span>
                <strong>{submission.project?.name}</strong>
              </div>
              <div className="readonly-field">
                <span>Checklist</span>
                <strong>{submission.childChecklist?.name}</strong>
              </div>
              <div className="readonly-field">
                <span>Supplier</span>
                <strong>{submission.supplier?.name}</strong>
              </div>
            </div>

            <div className="pqd-item-list">
              {submission.items?.map((item, index) => (
                <div
                  className={`pqd-item-row ${
                    !item.includeInPdf ? 'excluded' : ''
                  }`}
                  key={item.id}
                >
                  <label className="include-check">
                    <input
                      type="checkbox"
                      checked={Boolean(item.includeInPdf)}
                      onChange={(event) =>
                        changeItem(
                          item.id,
                          'includeInPdf',
                          event.target.checked
                        )
                      }
                    />
                    <span>{index + 1}</span>
                  </label>

                  <div className="pqd-item-main">
                    <strong>{item.titleSnapshot}</strong>

                    <div className="pqd-fields">
                      <label>
                        Document
                        <select
                          value={
                            item.documentId || item.document?.id || ''
                          }
                          onChange={(event) =>
                            changeItem(
                              item.id,
                              'documentId',
                              event.target.value
                            )
                          }
                        >
                          <option value="">No document attached</option>
                          {activeDocuments.map((document) => (
                            <option
                              key={document.id}
                              value={document.id}
                            >
                              {document.title} —{' '}
                              {document.statusInfo?.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Status
                        <select
                          value={item.status || ''}
                          onChange={(event) =>
                            changeItem(
                              item.id,
                              'status',
                              event.target.value
                            )
                          }
                        >
                          <option value="">Select status</option>
                          <option>YES</option>
                          <option>NO</option>
                          <option>NA</option>
                          <option>APPROVED</option>
                          <option>UNDER REVIEW</option>
                          <option>NOT SUBMITTED</option>
                          <option>As Required</option>
                        </select>
                      </label>

                      <label className="remarks-field">
                        Remarks
                        <input
                          value={item.remarks || ''}
                          onChange={(event) =>
                            changeItem(
                              item.id,
                              'remarks',
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="pqd-summary-column">
            <div className="panel-card sticky-card">
              <div className="panel-heading">
                <div>
                  <h2>Submission Summary</h2>
                  <p>Draft health and output versions.</p>
                </div>
              </div>

              <div className="summary-lines">
                <div>
                  <span>Total items</span>
                  <strong>{submission.items?.length || 0}</strong>
                </div>
                <div>
                  <span>Included</span>
                  <strong>
                    {submission.items?.filter(
                      (item) => item.includeInPdf
                    ).length || 0}
                  </strong>
                </div>
                <div>
                  <span>Attached</span>
                  <strong>
                    {submission.items?.filter(
                      (item) =>
                        item.includeInPdf &&
                        (item.documentId || item.document)
                    ).length || 0}
                  </strong>
                </div>
                <div>
                  <span>Supplier</span>
                  <strong>{submission.supplier?.name || '—'}</strong>
                </div>
                <div>
                  <span>Generated version</span>
                  <strong>v{submission.currentVersion || 0}</strong>
                </div>
              </div>

              {validation && (
                <div className="validation-summary">
                  <div
                    className={
                      validation.missing.length
                        ? 'validation-line bad'
                        : 'validation-line good'
                    }
                  >
                    {validation.missing.length ? (
                      <AlertTriangle size={17} />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}
                    <span>
                      {validation.missing.length} missing documents
                    </span>
                  </div>

                  <div
                    className={
                      validation.expired.length
                        ? 'validation-line bad'
                        : 'validation-line good'
                    }
                  >
                    {validation.expired.length ? (
                      <AlertTriangle size={17} />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}
                    <span>
                      {validation.expired.length} expired documents
                    </span>
                  </div>

                  <div
                    className={
                      validation.expiringSoon.length
                        ? 'validation-line warn'
                        : 'validation-line good'
                    }
                  >
                    {validation.expiringSoon.length ? (
                      <AlertTriangle size={17} />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}
                    <span>
                      {validation.expiringSoon.length} expiring soon
                    </span>
                  </div>
                </div>
              )}

              <div className="button-stack">
                <button
                  className="secondary-button full"
                  onClick={saveDraft}
                  disabled={busy}
                >
                  <Save size={17} /> Save and validate
                </button>
                <button
                  className="primary-button full"
                  onClick={() => generate()}
                  disabled={busy}
                >
                  <Play size={17} /> Generate final PDF
                </button>
                {submission.generatedPdfs?.length > 0 && (
                  <button
                    className="secondary-button full"
                    onClick={downloadLatest}
                  >
                    <FileDown size={17} /> Download latest PDF
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
