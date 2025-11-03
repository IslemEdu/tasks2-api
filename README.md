# Task API

A minimal, secure backend for user-owned tasks — built with raw Express and PostgreSQL.

## Why This Exists
- Prove I can build and ship a real CRUD API
- Learn data ownership, validation, and SQL safety
- Foundation for auth, files, and freelancing

## Local Setup

1. **Database**: PostgreSQL with password `mypgpassword`
2. **Create DB**:
   ```bash
   createdb taskapi
Run schema:
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

4-Start server:
npm install
node index.js

API Contract
All routes require explicit user_id in query or body to simulate ownership (real auth comes later).

POST /tasks
Body: { "title": "string", "user_id": integer }
Success: 201 Created + task object
Errors:
400 INVALID_INPUT — missing/empty title, invalid user_id
404 NOT_FOUND — user_id doesn’t exist
GET /tasks?user_id=1
Success: 200 OK + array of tasks (may be empty)
Error: 400 INVALID_INPUT — invalid user_id
PATCH /tasks/:id?user_id=1
Body: { "title"?: "string", "completed"?: boolean } (at least one field required)
Success: 200 OK + updated task
Errors:
400 INVALID_INPUT — empty body, invalid types, whitespace-only title
404 NOT_FOUND — task not found or wrong user
DELETE /tasks/:id?user_id=1
Success: 204 No Content
Errors:
400 INVALID_INPUT — invalid ID or user_id
404 NOT_FOUND — task not found or wrong user
Error Format
All errors return a consistent JSON structure:
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation"
  }
}
Known error codes:

INVALID_INPUT (400)
NOT_FOUND (404)
INTERNAL_ERROR (500)
Health Check
GET /health → returns { "status": "OK", "db": "connected" } if DB is reachable