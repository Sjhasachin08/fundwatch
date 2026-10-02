# FundWatch — Mutual Fund Intelligence Platform

A full-stack platform for browsing, analyzing and comparing mutual fund data, built from
a real "fund watch" Excel workbook (41 category worksheets, ~1,970 live schemes).

This project was built and **verified end-to-end** during development: the backend was
booted, roles/admin were seeded, the actual `AS_ON_17-Jul-2026.xlsx` workbook was uploaded
through the live `/api/imports/upload` endpoint (42 sheets processed → 1,968 schemes + 140
New Fund Offerings imported correctly, split across their 3 real sub-sections), and every
frontend page's API call was hit directly and checked against the running server. Three real
bugs (a column-naming mismatch, an index-definition issue, and a merged-cell parsing edge case
in the NFO sheet) were found and fixed this way before packaging.

---

## 1. What's included

**Backend** (`/backend` — Node.js, Express, Sequelize, MySQL):
- JWT authentication, 5-role RBAC (SuperAdmin, Admin, DataOperator, Viewer, Guest) driven by
  a data-defined `permissions` JSON on each role (no hardcoded switch statements)
- Normalized schema: Users, Roles, Categories, AMCs, Schemes, Returns, Risk Measures,
  Market Cap Allocation, Sector Allocation, Fund Managers, Benchmarks, Uploads, Import Logs,
  Activity Logs, Watchlist/Favorites, Dashboard Settings, and per-import Scheme Snapshots
  (NAV/AUM history + a basis for rollback)
- Excel import service (ExcelJS) that **auto-detects category worksheets** by scanning for a
  "Launch Date" header — no sheet names are hardcoded, so dropping in a new worksheet next
  quarter creates a new category automatically
- Dashboard, category, scheme, search, compare, watchlist, user and import REST APIs
- A cron job stub (node-cron) for scheduled maintenance tasks
- Activity logging on writes (who changed what, old value → new value)

**Frontend** (`/frontend` — React 18, Vite, Redux Toolkit, React Query, Tailwind, Recharts):
- Dark glassmorphism "terminal" UI (same design language as the standalone dashboard demo)
- Login, Home (live KPIs + charts), Category pages (auto-generated per worksheet, with
  filterable/sortable/exportable data grid), Scheme detail (returns, risk, allocations, NAV
  trend), Compare (up to 5 funds, radar chart), Watchlist, **New Fund Offerings** (on-going /
  recently-launched / SEBI-filing NFOs, grouped by section), and an Admin area (Excel upload +
  import history, user/role management) gated by RBAC

---

## 2. Quick start

### Option A — zero config (fastest way to try it)
```bash
cd backend
npm install
npm run seed      # creates the 5 roles + a super admin user, using SQLite by default
npm start         # http://localhost:5000
```
No `.env` file is required — SQLite is the built-in default even without one. Copy
`.env.example` to `.env` only if you want to change the admin credentials, JWT secret, or
switch to MySQL.

SQLite data is saved in `backend/dev.sqlite` and remains available across restarts on that
computer. This database, uploaded workbooks, and real `.env` credentials are intentionally
not included in GitHub. A fresh clone creates its own database; import the workbook again to
populate it. Separate computers do not share or synchronize data automatically. To use one
shared database, configure MySQL with private credentials in each machine's `.env` and point
all instances at the same secured MySQL server. Never commit that `.env` file.

### Option B — real MySQL (recommended for anything beyond a demo)
```bash
mysql -u root -p -e "CREATE DATABASE mf_intelligence;"
cd backend
cp .env.example .env
# edit .env: set DB_DIALECT=mysql and your DB_HOST/DB_USER/DB_PASSWORD
npm install
npm run seed
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to localhost:5000)
```

### Login
```
Email:    admin@fundwatch.local
Password: Admin@12345
```
(Change `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env` before seeding if you want different defaults.)

If login ever fails with "no valid role assigned" (e.g. after pulling in model/schema changes),
run the one-command fix instead of manually deleting files:
```bash
npm run reset      # deletes dev.sqlite and reseeds in one step
```

### Import your data
Sign in → **Admin → Upload Data** → choose your `.xlsx` file. Large workbooks (40+ sheets,
~2,000 rows) take roughly 2–3 minutes because each row's returns/risk/allocation values are
upserted individually for clean per-field version history — this is a deliberate
correctness-over-speed tradeoff, noted as an optimization opportunity below.

---

## 3. Design notes worth knowing

- **RBAC** is enforced via `permissions: { moduleName: ["create","read","update","delete"] }`
  on each Role row, checked by `src/middlewares/rbac.js`. `SuperAdmin` bypasses the check
  entirely. Adjust a role's permissions directly in the `roles` table (or extend
  `AdminUsers.jsx` / add a Roles admin screen) rather than editing code.
- **AMC (fund house) names** are inferred from a known-prefix list matched against each
  scheme name (`extractAMCName` in `excelImportService.js`). This is a heuristic, not sourced
  from a dedicated "AMC" column in the sheet — double-check it against your data if AMC-level
  reporting needs to be precise.
- **NFO sheet** (New Fund Offerings) has a completely different shape from the 41 category
  sheets — no NAV/returns yet, and three stacked sub-sections (On-going / Recently launched /
  SEBI filings) each with slightly different columns, in the same worksheet. It's detected
  generically by the presence of a "Fund Name" header (not by the sheet's literal name) and
  parsed by `parseNFORows` in `excelImportService.js`, which tracks a running "current section"
  as it walks the sheet. One implementation detail worth knowing if you ever touch this parser:
  ExcelJS repeats a merged cell's value across every cell in the merge (e.g. a section-title
  row spanning 4 columns returns the same string 4 times), unlike some other Excel libraries
  that leave only the master cell populated — the parser's "is this a title/label row" check
  is written specifically around that behavior.
- **"Favorites" and "Watchlist"** from the original spec are combined into one `Watchlist`
  table with a `listType` enum, since both are the same user↔scheme relationship with a
  different label.
- **Version history / rollback** is implemented via a `SchemeSnapshot` row written on every
  import (NAV + AUM + date). There's no one-click "rollback to snapshot" endpoint yet — the
  data is there, but restoring it needs a small endpoint that copies a snapshot's values back
  onto the live `Scheme` row.
- **`sequelize.sync()` is used without `{ alter: true }`.** During development, running
  `npm run seed` and then `npm start` back-to-back against the same SQLite file caused
  Sequelize's alter-sync to rebuild the `users` table and silently null out the `roleId`
  foreign key, breaking login. Plain `sync()` still creates any new tables a model adds
  (like the `nfos` table) — it just won't rewrite the schema of tables that already exist.
  **If you change a model's columns or indexes, delete `dev.sqlite` and reseed** rather than
  relying on auto-migration. For real MySQL deployments, use proper `sequelize-cli` migrations
  instead of either approach.
- **`JWT_SECRET` has a fallback** if `.env` is missing entirely, so the app still boots and
  logins work with zero configuration — but the fallback is a fixed, publicly-visible string.
  Set a real `JWT_SECRET` in `.env` before this touches anything beyond your own machine.

## 4. What's a deliberate simplification (not implemented)

The original brief was extremely broad (roughly 150 individual feature bullets). To keep this
a genuinely working project rather than a pile of stubs, the following were **not** built, and
are the clearest next steps if you want to extend it:

- Column pinning/freezing, drag-to-resize, and PDF export in the data grid (CSV export works)
- A dedicated Permission-table-per-module admin UI (permissions currently live directly on
  the Role row as JSON — functionally equivalent, just less clicky)
- Server-side full filter builder (category/AMC/NAV/AUM/return/risk filters exist on the
  category API; a few of the more exotic filters like "Rating" and "Scheme Type" aren't in
  the source data at all, so they're omitted rather than faked)
- A rollback-to-snapshot button (the underlying snapshot data exists, see above)
- Real-time NAV feed / websocket updates (all data is as-of the last Excel import)

## 5. Project layout

```
backend/
  server.js                  entry point
  src/
    config/db.js             Sequelize connection (MySQL or SQLite fallback)
    models/                  Sequelize models + associations (index.js)
    middlewares/              auth (JWT), rbac, upload (multer), error handler
    controllers/              route handlers (incl. nfoController.js)
    services/
      excelImportService.js   the core import/parsing engine (category sheets + NFO sheet)
      dashboardService.js     KPI/aggregate queries
    routes/                   Express routers, mounted under /api (incl. nfoRoutes.js)
    seeders/seedRoles.js      creates roles + super admin
    cron/refreshStats.js      example scheduled job

frontend/
  src/
    api/axios.js              authenticated API client
    store/                    Redux Toolkit auth slice
    components/                Sidebar, TopBar, DataTable, shared UI primitives
    pages/                     Login, Home, CategoryPage, SchemeDetail, Compare,
                                Watchlist, NFOs, Admin/ (Upload, Users)
```
