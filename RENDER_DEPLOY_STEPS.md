# Render Deployment Steps

This repository includes `render.yaml`, which creates:

- `pqd-web-portal` — React/Vite static frontend
- `pqd-web-portal-api` — Node/Express backend
- `pqd-web-portal-db` — PostgreSQL database

## 1. Push the corrected project to GitHub

From the project root:

```powershell
git add .
git commit -m "Fix authentication and add Render deployment"
git push origin main
```

Never commit `backend/.env` or `frontend/.env`.

## 2. Create the Render Blueprint

1. Sign in to Render.
2. Select **New +** → **Blueprint**.
3. Connect `HashirYamin/PQD_WEB_PORTAL`.
4. Render will detect `render.yaml`.
5. Enter the prompted values:
   - `SUPER_ADMIN_EMAIL`: your administrator email
   - `SUPER_ADMIN_PASSWORD`: at least 8 characters with uppercase, lowercase, number, and special character
6. Select **Apply** / **Deploy Blueprint**.

## 3. Wait for all resources

Wait until the database, backend, and frontend show **Live**.

Backend health check:

```text
https://<backend-host>/api/health
```

Client-facing URL:

```text
https://<frontend-host>
```

## 4. Test the live authentication flow

1. Sign in using the Super Admin credentials entered on Render.
2. Open **Companies**.
3. In another private/incognito window, open `/signup` and register a test company.
4. Return to the Super Admin window and approve the pending registration.
5. Sign in with the newly approved company administrator account.

## Storage warning

The free backend filesystem is temporary. PostgreSQL data remains in the database, but uploaded documents and generated PDFs can disappear after a restart or redeploy. For client production usage, attach a paid persistent disk to the backend and mount it at the backend upload directory, or move uploads to external object storage.
