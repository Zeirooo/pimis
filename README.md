# Pharmacy Inventory Management System (PIMIS)

A full-stack pharmacy inventory management application with AI-powered demand prediction, automatic restocking recommendations, and manual purchase order management.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start with Docker](#quick-start-with-docker)
- [Service Details](#service-details)
- [Accessing the Application](#accessing-the-application)
- [Development Guide](#development-guide)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## Overview

**PIMIS** is composed of:

- **Backend**: FastAPI + SQLAlchemy (async) + MySQL for data management and APIs
- **Frontend**: React 19 + TypeScript + Vite + TanStack Router for a modern UI
- **Database**: MySQL 8.4 for persistent data storage
- **Admin Tool**: phpMyAdmin for database management

All services are containerized and orchestrated with Docker Compose.

---

## Prerequisites

- **Docker** (version 24+) — [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose** (version 2.20+) — [Install Docker Compose](https://docs.docker.com/compose/install/)
- **Git** (optional, for cloning the repository)

Verify your installation:

```bash
docker --version
docker compose version
```

---

## Quick Start with Docker

### 1. Clone or Navigate to the Project

```bash
cd path/to/inventory_pharmacy
```

### 2. Start All Services

From the **backend** directory, run:

```bash
cd backend
docker compose up --build
```

This command:

- ✅ Builds the backend Docker image
- ✅ Pulls MySQL, Node, and phpMyAdmin images
- ✅ Starts all services (MySQL, backend API, frontend, phpMyAdmin)
- ✅ Waits for service health checks before starting dependent services
- ✅ Mounts volumes for live code updates during development

**Expected output:**

```
pimis-mysql      | ready for connections
pimis-backend    | INFO:     Uvicorn running on http://0.0.0.0:8000
pimis-frontend   | VITE v... dev server running at ...
pimis-phpmyadmin | Apache running on port 80
```

### 3. Verify All Services Are Healthy

In a new terminal:

```bash
docker ps
```

You should see 4 containers running:

- `pimis-mysql` (MySQL)
- `pimis-backend` (FastAPI)
- `pimis-frontend` (Node dev server)
- `pimis-phpmyadmin` (phpMyAdmin)

---

## Service Details

### 📦 Services Started

| Service         | Port | URL                   | Purpose                 |
| --------------- | ---- | --------------------- | ----------------------- |
| **Frontend**    | 8081 | http://localhost:8081 | React web application   |
| **Backend API** | 8000 | http://localhost:8000 | FastAPI REST endpoints  |
| **MySQL**       | 3306 | localhost:3306        | Database server         |
| **phpMyAdmin**  | 8082 | http://localhost:8082 | Database GUI admin tool |

### Environment Variables

The services are configured with the following environment settings:

**Backend (`pimis-backend`):**

- `DATABASE_URL`: MySQL connection string (`mysql+aiomysql://pimis:pimis123@mysql:3306/pimis`)
- `CORS_ALLOW_ORIGINS`: Allowed frontend URLs (`http://localhost:8081`, `http://127.0.0.1:8081`)

**Frontend (`pimis-frontend`):**

- `VITE_API_URL`: Backend API base URL (`http://localhost:8000`)
- `CHOKIDAR_USEPOLLING`: Enable file polling for Windows (required for hot reload on bind mounts)

**MySQL (`pimis-mysql`):**

- `MYSQL_ROOT_PASSWORD`: `root`
- `MYSQL_DATABASE`: `pimis`
- `MYSQL_USER`: `pimis`
- `MYSQL_PASSWORD`: `pimis123`

---

## Accessing the Application

### 🌐 Frontend Application

- **URL**: http://localhost:8081
- **Status**: Ready when you see "VITE dev server running"

### 🔧 Backend API

- **Base URL**: http://localhost:8000
- **Health Check**: http://localhost:8000/api/health
- **API Docs (Swagger)**: http://localhost:8000/docs
- **API Docs (ReDoc)**: http://localhost:8000/redoc

### 📊 Database Admin (phpMyAdmin)

- **URL**: http://localhost:8082
- **Username**: `pimis`
- **Password**: `pimis123`
- **Host**: `mysql`

---

## Development Guide

### Running Services in the Background

Start services in detached mode:

```bash
docker compose up -d --build
```

### View Logs

View all service logs:

```bash
docker compose logs -f
```

View logs for a specific service:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mysql
```

### Hot Reload / Live Development

- **Frontend**: Changes in `frontend/src/` automatically reload in the browser (thanks to Vite)
- **Backend**: Changes in `backend/` are mounted as volumes and will trigger uvicorn reload

### Running Services Individually

If you need to run a single service:

```bash
# Start only MySQL and backend
docker compose up mysql backend

# Start only the frontend with a custom command
docker compose run --rm frontend npm run build
```

### Stop Services

Stop all running services:

```bash
docker compose down
```

Stop and remove all volumes (⚠️ deletes database data):

```bash
docker compose down -v
```

### Rebuild Services

Rebuild all images:

```bash
docker compose up --build
```

Rebuild a specific service:

```bash
docker compose up --build backend
```

### Accessing Containers

Open a shell in a running container:

```bash
# Backend container
docker exec -it pimis-backend bash

# Frontend container
docker exec -it pimis-frontend sh

# MySQL container
docker exec -it pimis-mysql mysql -upimis -pimis123 pimis
```

---

## Troubleshooting

### Issue: Port Already in Use

If you see `Address already in use`:

```bash
# Find and stop the process using the port (example: port 8000)
lsof -i :8000  # or netstat -tulpn | grep 8000
kill -9 <PID>

# Or change the port in docker-compose.yml
# Example: "8000:8000" → "8001:8000"
```

### Issue: Frontend Not Hot-Reloading on Windows

The `CHOKIDAR_USEPOLLING=true` environment variable is already configured in `docker-compose.yml` for Windows compatibility. If it still doesn't work:

1. Ensure Docker Desktop is using WSL 2 backend
2. Check that the volume mount path is correct
3. Restart the frontend container: `docker compose restart frontend`

### Issue: "MySQL Service Not Healthy"

Wait for MySQL to fully initialize (first startup takes ~30 seconds). Check logs:

```bash
docker compose logs mysql
```

### Issue: Backend Cannot Connect to Database

Verify the backend can reach MySQL:

```bash
docker compose exec backend curl http://mysql:3306
```

Check the DATABASE_URL environment variable in `docker-compose.yml`.

### Issue: Frontend Blank Page or 404 Errors

1. Check frontend logs: `docker compose logs frontend`
2. Check backend API is healthy: `curl http://localhost:8000/api/health`
3. Verify `VITE_API_URL=http://localhost:8000` is set correctly
4. Clear browser cache and restart

### Issue: phpMyAdmin Cannot Connect to MySQL

Ensure MySQL is fully initialized before phpMyAdmin starts:

```bash
docker compose logs mysql
```

The health check in `docker-compose.yml` ensures MySQL is ready before other services start.

### Complete Clean Up and Restart

If you encounter persistent issues, perform a complete reset:

```bash
# Stop all services
docker compose down -v

# Remove unused images and volumes
docker system prune -a --volumes

# Rebuild and start fresh
docker compose up --build
```

---

## Project Structure

```
inventory_pharmacy/
├── backend/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt        # Python dependencies
│   ├── docker-compose.yml      # Docker Compose configuration
│   ├── Dockerfile             # Backend image build config
│   ├── crud/                  # Database CRUD operations
│   ├── database/              # SQLAlchemy models & config
│   ├── routers/               # API route endpoints
│   └── schemas/               # Pydantic request/response schemas
│
├── frontend/
│   ├── package.json           # Node.js dependencies
│   ├── vite.config.ts         # Vite bundler config
│   ├── tsconfig.json          # TypeScript config
│   ├── src/
│   │   ├── pages/             # Page components
│   │   ├── components/        # Reusable UI components
│   │   ├── hooks/             # React hooks (API calls, etc.)
│   │   ├── types/             # TypeScript type definitions
│   │   ├── lib/               # Utility functions
│   │   └── styles/            # Global styles
│   └── public/                # Static assets
│
├── README.md                  # This file
└── .gitignore
```

---

## Common Commands Reference

```bash
# Start all services (build if needed)
docker compose up --build

# Start in background
docker compose up -d

# Stop all services
docker compose down

# View logs in real-time
docker compose logs -f

# Rebuild a service
docker compose up --build backend

# Execute command in a container
docker exec -it pimis-backend python -m pytest

# Clean up everything (including database)
docker compose down -v

# Restart a service
docker compose restart frontend
```

---

## Production Deployment Notes

This Docker Compose setup is optimized for **development**. For production:

1. Use environment-specific `.env` files (do not commit secrets)
2. Build optimized frontend builds (`npm run build`)
3. Use a reverse proxy (Nginx) for SSL and request routing
4. Configure persistent database backups
5. Set `restart: no` for manual container control
6. Use Docker secrets for sensitive data
7. Implement log aggregation and monitoring

---

## Support & Contribution

For issues, questions, or contributions, please refer to the project documentation or contact the development team.

**Happy developing! 🚀**
