# Personal Worklog

Multi-user app for **Tasks**, **Commits**, and **Reports**.  
Stack: Next.js + Prisma + PostgreSQL + Better Auth. Deploy on **Render**.

## Features

- **Auth** — register / login (email + password); each user only sees their own data
- **Tasks** — create, filter by status (todo / doing / done), complete, delete
- **Commits** — sync your commits from GitHub; import Clockify CSV time entries
- **Reports** — range totals + daily chart (commits & logged hours)
- **Settings** — GitHub PAT (encrypted), default repo, sync-since date

## Local development

### 1. Postgres

```bash
docker compose up -d
```

Or point `DATABASE_URL` at any Postgres instance.

### 2. Env

```bash
cp .env.example .env
```

Edit if needed. Defaults match `docker-compose.yml`.

### 3. Migrate & run

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → register an account.

### GitHub sync

1. Create a [fine-grained or classic PAT](https://github.com/settings/tokens) with access to the target repo
2. **Settings** → paste token, set `owner/repo`, sync since date → Save
3. **Commits** → Sync from GitHub

### CSV import

On **Commits**, paste a Clockify CSV:

```text
Email,Start date,Start time,Duration,Project,Description
```

## Deploy on Render

1. Push this repo to GitHub
2. In Render: **New** → **Blueprint** → select the repo (`render.yaml`)
   - Or manually: create **PostgreSQL** + **Web Service**
3. Web Service settings:
   - **Build**: `npm install && npx prisma generate && npm run build`
   - **Start**: `npx prisma migrate deploy && npm run start`
4. Set env vars:
   - `DATABASE_URL` — from Render Postgres (Internal Database URL)
   - `BETTER_AUTH_SECRET` — long random string
   - `BETTER_AUTH_URL` — your public URL, e.g. `https://personal-worklog.onrender.com`
   - `ENCRYPTION_KEY` — long random string (for GitHub token encryption)
5. Deploy. First free-tier boot may take ~1 minute (cold start).

## Project layout

```text
src/app/(app)/tasks|commits|reports|settings   # protected pages
src/app/api/tasks|commits|reports|settings     # APIs (user-scoped)
src/app/api/auth/[...all]                      # Better Auth
prisma/schema.prisma
render.yaml
```

## Notes

- Timesheet CSV import requires no Clockify API — paste file contents only
- Estimated commit hours use 45 minutes per commit (same idea as the git→Clockify export)
- Do not commit real `.env` files or GitHub tokens
