# Client Handover Notes

## Implemented workflow

1. Super Admin creates a company and company users.
2. Company Admin completes the company profile and uploads reusable documents.
3. Company Admin manages the Master Checklist.
4. User creates a project.
5. User creates one or more Project Checklists by selecting a subset of Master Checklist items.
6. User starts a PQD by selecting one project and one saved Project Checklist.
7. User maps a document, status, and remarks to each item and can exclude individual items.
8. The portal validates missing and expired documents.
9. The portal generates and stores a versioned PDF submission.

## Historical safety rules

- Deactivating or editing a Master Checklist item does not alter existing Project Checklists.
- Editing a Project Checklist does not alter existing PQD drafts or previously generated PDFs.
- Archiving a document hides it from new selections but keeps historical database references.
- Every regeneration creates a new PDF version.

## Items the client should finalize before production launch

- Final cover page, section page, colors, logos, and branding template.
- Final checklist status options and default remarks.
- Whether `NA` items appear in or are excluded from the final PDF by default.
- Final expiry reminder intervals and recipient addresses.
- SMTP provider, production domain, hosting, storage, and backup policy.
- Whether a future version must combine multiple Project Checklists into one PQD.
- Support period, warranty terms, and approved change-request process.

## Current MVP boundaries

- One PQD uses one saved Project Checklist.
- Uploaded PDF files are merged into the generated PDF. Word, Excel, and image attachments are referenced but not embedded.
- Expiry dates are manually entered and editable. OCR/cloud expiry extraction is not enabled in this package.
- Digital signatures, multi-level approval workflows, cloud-drive integrations, payment gateways, and native mobile apps are outside this package.
