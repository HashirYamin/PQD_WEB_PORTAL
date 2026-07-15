# PQD Web Portal

A full-stack Prequalification Document (PQD) automation portal based on the approved project scope.

## Included modules

- Secure JWT login with Super Admin, Company Admin, and Staff roles
- Multi-company data separation
- Dashboard statistics and expiry alerts
- Company profiles and logo upload
- Reusable legal/technical document library with expiry tracking
- Editable Master Checklist with activation/deactivation and ordering
- Project-specific Child Checklist builder
- Project management
- PQD draft builder with document mapping, status, remarks, include/exclude controls
- Missing/expired-document validation
- PDF cover page, company/project details, TOC, checklist table, section title pages, merged PDFs, versioning, and downloads
- Alert settings and scheduled expiry email job
- Activity logging

## Quick start

### Requirements

- Node.js 20+
- npm 10+
- Docker Desktop (recommended) or a local PostgreSQL 14+ server

### 1. Start PostgreSQL

From the project root:

```bash
docker compose up -d db
```

### 2. Start backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev
```

Backend: `http://localhost:5000`

### 3. Start frontend

Open another terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

### Demo accounts

- Super Admin: `superadmin@pqd.local` / `Admin@123`
- Company Admin: `admin@abc.local` / `Admin@123`
- Staff: `staff@abc.local` / `Staff@123`

## Build for production

```bash
cd frontend
npm run build
```

Set the backend `FRONTEND_URL` to the deployed frontend URL. Store the `backend/uploads` directory on persistent storage and configure regular database/file backups.

## Important production notes

- Change `JWT_SECRET` and all demo passwords.
- Configure SMTP before enabling email alerts.
- Use HTTPS, reverse proxy, firewall, backups, and persistent storage.
- Expiry dates are manually entered and editable. OCR/cloud expiry extraction is not enabled in this package.
- PDF merging supports uploaded PDFs. Non-PDF attachments are referenced in the generated submission but are not embedded.

## Quality checks

```bash
cd backend
npm run test:integration

cd ../frontend
npm run build
```

The integration test covers login, tenant-scoped dashboard access, PQD draft creation, item/document mapping, PDF generation, version storage, and authenticated download.
