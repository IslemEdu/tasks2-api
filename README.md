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
