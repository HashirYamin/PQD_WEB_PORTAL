# Deployment Guide

## Docker deployment

1. Copy the project to a Linux VPS with Docker and Docker Compose installed.
2. Create a root `.env` file for Docker Compose:

```env
POSTGRES_PASSWORD=use-a-strong-password
JWT_SECRET=use-a-long-random-secret
FRONTEND_URL=https://pqd.example.com
EMAIL_ENABLED=false
```

3. Build and start:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

4. Create the initial demo schema/data once:

```bash
docker compose -f docker-compose.prod.yml exec backend npm run seed
```

5. Open `http://SERVER_IP:8080`. Put Nginx, Caddy, Cloudflare, or a cloud load balancer in front of port 8080 and enable HTTPS.

## Production cautions

- The seed command resets the database. Never run it after real data has been entered.
- Replace all demo passwords immediately.
- Keep the PostgreSQL and uploads volumes on persistent storage.
- Back up both the PostgreSQL database and the uploads volume.
- Restrict database access to the private Docker network.
- Configure SMTP only through environment variables.
- For large deployments, move document storage to S3-compatible storage and run scheduled jobs in a dedicated worker.
