# Windows Setup Guide

## Install once

1. Install Node.js 20 or newer.
2. Install Docker Desktop and make sure Docker is running.
3. Extract the project ZIP.
4. Open PowerShell inside the extracted `pqd_web_portal` folder.
5. Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup-windows.ps1
```

## Start the portal

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\run-windows.ps1
```

Open `http://localhost:5173`.

## Demo login

- Company Admin: `admin@abc.local` / `Admin@123`
- Super Admin: `superadmin@pqd.local` / `Admin@123`
- Staff: `staff@abc.local` / `Staff@123`

## Stop the database

From the project folder:

```powershell
docker compose down
```

Do not run `npm run seed` after entering real client data because the seed command resets the development database.
