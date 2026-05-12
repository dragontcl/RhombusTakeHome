# RhombusRegex

An LLM-assisted spreadsheet transformation tool. Upload a CSV or Excel file, describe a
pattern in plain English, and the app generates a regex, applies it to a column you
choose, and lets you download the result.

> **Live demo:** _paste your Vercel URL here after deploying_
>
> **First request may take 30–60s** while the Render free-tier backend wakes from
> sleep. Subsequent requests are instant.

This repository is a monorepo. The React frontend lives at the project root; the
Django backend lives in `backend/`. Vercel and Render are configured to pick up the
right subdirectory automatically.

---

## What it does

1. **Upload** — drag/drop a CSV, XLSX, XLS, XLSM, or XLSB file. The backend streams
   the file straight to disk via a custom Django upload handler (no full-buffer in
   memory) and validates the type from both extension and content-type.
2. **Preview** — the first rows are rendered as a paginated table. Page size is
   selectable (10 / 100 / 1000).
3. **Describe a pattern** — pick the target column, type something like
   *"find email addresses"* or *"phone numbers in any format"*, and click
   **Generate Regex**.
4. **LLM generates the regex** — backend calls Anthropic Claude Haiku 4.5 with the
   description, the column name, and 10 sample values from the column. It returns
   structured JSON containing the regex, a short explanation, and a sensible default
   replacement (e.g. `REDACTED`, `***-***-****`, `[link removed]`).
5. **Edit if needed** — both the generated regex and the suggested replacement are
   editable inputs.
6. **Apply** — the backend compiles the regex, runs `re.sub` over every row in the
   target column, writes the transformed file to disk, and returns the new file's id.
7. **Preview & download** — the table swaps to show the transformed data. A
   **Download CSV** button serves the new file as an attachment, and **View Original**
   flips back to the source.

---

## Architecture

```
┌──────────────────────────┐       multipart/form-data         ┌──────────────────────────┐
│   React frontend (CRA)   │ ────────────────────────────────▶ │   Django backend         │
│   Deployed on Vercel     │ ◀──────────────────────────────── │   Deployed on Render     │
└──────────────────────────┘       JSON / streamed file        └──────────────────────────┘
                                                                          │
                                                                          ▼
                                                       ┌──────────────────────────────┐
                                                       │   Anthropic Claude API       │
                                                       │   claude-haiku-4-5           │
                                                       │   structured JSON outputs    │
                                                       └──────────────────────────────┘
```

### Backend endpoints

| Method  | Path                          | Purpose                                                              |
|---------|-------------------------------|----------------------------------------------------------------------|
| `POST`  | `/upload/`                    | Streaming multipart upload. Custom handler writes chunks to disk and validates type before any body bytes are persisted. Returns `{id, name, size, content_type}`. |
| `GET`   | `/preview/<id>/`              | Paginated preview. Query params `offset` and `limit`. Returns `{columns, rows, offset, limit, has_more}`. Parses CSV via `csv`, XLSX/XLSM via `openpyxl` (read-only streaming), XLS via `xlrd`, XLSB via `pyxlsb`. |
| `POST`  | `/generate-regex/`            | Body `{file_id, target_column, description}`. Calls Claude with samples from the column. Returns `{regex, explanation, replacement}` via structured outputs. |
| `POST`  | `/transform/`                 | Body `{file_id, target_column, regex, replacement}`. Applies `re.sub` to every row, writes a new CSV. Returns `{download_id, match_count, row_count}`. |
| `GET`   | `/download/<id>/`             | Serves a transformed file as `Content-Disposition: attachment`.      |

### Tech stack

| Layer        | Choice                                                                 |
|--------------|------------------------------------------------------------------------|
| Frontend     | React 19 (Create React App)                                            |
| Styling      | Inline styles (a dark `RhombusRegex` aesthetic; no Tailwind/Material)  |
| Backend      | Django 6.0 + django-cors-headers + whitenoise + gunicorn               |
| File parsing | `csv` (stdlib), `openpyxl`, `xlrd`, `pyxlsb`                           |
| LLM          | Anthropic Python SDK calling `claude-haiku-4-5` with structured JSON output |
| Env handling | `python-dotenv` reads `backend/.env` on Django startup                 |
| Deployment   | Render (backend, `render.yaml` Blueprint) and Vercel (frontend)        |

---

## Repo layout

```
rhombusregex/                        ← repo root, also the CRA frontend root
├── README.md                        ← (this file)
├── render.yaml                      ← Render Blueprint, uses rootDir: backend
├── .gitignore                       ← combined frontend + backend ignores
├── .vercelignore                    ← excludes backend/ from Vercel build
├── package.json                     ← frontend
├── public/
├── src/
│   ├── App.js                       ← entire UI (upload view, workspace, table)
│   ├── index.js
│   └── index.css
└── backend/                         ← Django project root
    ├── manage.py
    ├── requirements.txt
    ├── runtime.txt                  ← Python 3.12.5
    ├── templates/
    └── RhombusTakeHomeBackend/
        ├── settings.py              ← reads backend/.env, env-driven config
        ├── urls.py                  ← 5 routes
        ├── views.py                 ← view logic + file parsers
        ├── upload_handlers.py       ← custom streaming FileUploadHandler
        ├── wsgi.py
        └── asgi.py
```

At runtime the backend also creates:
- `backend/.env` (local-only, gitignored — holds `ANTHROPIC_API_KEY`)
- `backend/uploads/` (uploaded + transformed files)
- `backend/staticfiles/` (collected by `collectstatic` during Render build)
- `backend/db.sqlite3` (Django creates this for auth tables; we don't use models)

---

## Running locally

### Prerequisites

- Python 3.11 or newer (3.12 recommended; the deployed backend pins 3.12.5).
- Node.js 18 or newer.
- An Anthropic API key — https://console.anthropic.com/settings/keys.

### Clone

```bash
git clone https://github.com/<you>/rhombusregex.git
cd rhombusregex
```

### Backend

Run from the `backend/` subdirectory:

```bash
cd backend

# Create venv and install dependencies
python -m venv .venv
.\.venv\Scripts\activate         # Windows PowerShell
# source .venv/bin/activate      # macOS/Linux

pip install -r requirements.txt

# Create backend/.env with your key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Run the dev server
python manage.py runserver
```

Backend is on `http://localhost:8000`. No database migrations needed — the app
doesn't use models.

### Frontend

In a second terminal, from the repo root:

```bash
npm install
npm start
```

Frontend is on `http://localhost:3000` and points at `http://localhost:8000` by
default. To point at a different backend, create `.env.local` at the repo root:

```
REACT_APP_BACKEND_URL=https://your-backend.example.com
```

Restart `npm start` for env changes to take effect.

### CORS

By default the backend sets `CORS_ALLOW_ALL_ORIGINS=True` (handy for local dev). In
production, set `CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app` as a Render
env var to restrict it.

---

## Deployment

Both services deploy from this single repo with zero hand-editing of platform
configs.

### 1. Push the repo to GitHub

```bash
cd C:\Users\Nuwuy\WebstormProjects\rhombusregex
git init
git add .
git status        # double-check backend/.env is NOT listed
git commit -m "Initial commit"
git remote add origin https://github.com/<you>/rhombusregex.git
git branch -M main
git push -u origin main
```

### 2. Backend → Render (free)

1. Render dashboard → **New +** → **Blueprint**.
2. Connect your GitHub and pick the `rhombusregex` repo. Render reads `render.yaml`
   from the root and sees `rootDir: backend`, so all build/start commands run from
   `backend/`.
3. Apply. Render will prompt for the two env vars marked `sync: false`:
   - `ANTHROPIC_API_KEY` — paste your (rotated) key.
   - `CORS_ALLOWED_ORIGINS` — leave blank for now (filled in after Vercel deploys).
4. First build takes ~3 minutes. When it's green, copy the `*.onrender.com` URL.

### 3. Frontend → Vercel (free)

1. Vercel → **New Project** → import the same `rhombusregex` repo.
2. Framework preset auto-detects **Create React App** at the repo root. The
   `.vercelignore` excludes `backend/` from the build context.
3. Add env var `REACT_APP_BACKEND_URL` = your Render URL (from step 2).
4. Deploy. Copy the `*.vercel.app` URL.

### 4. Lock CORS to the Vercel origin

Back in Render → service → **Environment** → set `CORS_ALLOWED_ORIGINS` to your
Vercel URL. Render auto-redeploys.

That Vercel URL is what you submit.

---

## Design notes

### Streaming upload, not buffered

Django's default upload handlers buffer files in memory (`MemoryFileUploadHandler`,
< 2.5 MB) or write the whole request body to a tmpfile before calling the view.
`backend/RhombusTakeHomeBackend/upload_handlers.py` overrides this — `new_file()`
opens the destination file as soon as the multipart headers are parsed (giving us
the original filename + content-type), `receive_data_chunk()` writes each 64 KiB
chunk directly to disk and returns `None` so no other handler reprocesses the
bytes, and `file_complete()` finalises. If the content-type/extension is bad,
`new_file()` raises `StopUpload` *before any body bytes hit disk*.

This means uploads scale with disk, not RAM. The cost is that the view can't reject
based on parsed contents (only metadata) — fine for this use case.

### File ID format

`<uuid32>.<ext>` — the extension is embedded in the id so `/preview/` and
`/download/` can route to the right parser without a sidecar metadata file. The URL
regex `^[0-9a-f]{32}\.(csv|xls|xlsx|xlsm|xlsb)$` rejects anything else, so the id is
safe to concatenate onto the filesystem path.

### Pagination, lazy fetching

The preview endpoint walks rows from the top each call (the parsers are
streaming/iterator-based, so this is cheap). The frontend caches loaded rows in
state and only re-fetches when the user pages past what's loaded. Page size in the
UI (10 / 100 / 1000) is decoupled from the backend fetch batch (`max(pageSize, 100)`)
so even a 10-row page doesn't churn the network.

### One regex generator call instead of two

The LLM returns regex + replacement together in a single structured-output call.
Cheaper than two calls, and the model has more context to pick a sensible default
replacement when it sees the description alongside the pattern.

### Why a separate `/transform/` step

The backend applies the regex, never the frontend. This means:
- Pagination across transformed data works correctly (every page is read from the
  transformed file on disk, not lazily transformed on demand)
- The downloaded file is byte-identical to what's previewed
- Large files don't have to round-trip rows through the browser

### Excel format coverage

| Extension | Library    | Mode                                  |
|-----------|------------|---------------------------------------|
| `.csv`    | stdlib     | streaming via `csv.reader`            |
| `.xlsx`   | openpyxl   | `read_only=True, data_only=True` — streams via `iter_rows` |
| `.xlsm`   | openpyxl   | same                                  |
| `.xls`    | xlrd       | loads full sheet (xls is capped at ~65k rows so this is fine) |
| `.xlsb`   | pyxlsb     | streams via `sheet.rows()`            |

`.xls` and `.xlsb` upload OK but are read into memory; the others stream.

### Number formatting

Whole-number floats from Excel (e.g. `1.0`) render as `1` via a small `_stringify`
helper, since Excel stores integers as IEEE 754 doubles. CSV values are passed
through as strings.

### Security posture

- `backend/.env` is gitignored. The Anthropic key never enters source control.
- File IDs are validated against a strict regex before being joined to a filesystem
  path — no path traversal.
- The `StreamingFileUploadHandler` validates extension/content-type *before*
  writing to disk, so rejected uploads don't fill the disk.
- CORS is permissive in dev (`*`) but should be locked to the Vercel origin in
  production via `CORS_ALLOWED_ORIGINS` on Render.
- The user-supplied regex is compiled with `re.compile()`, which is safe (Python's
  re module doesn't support arbitrary code in patterns), but a deliberately
  catastrophic pattern (`(a+)+b`) could spike CPU on a large file. For production,
  wrap `re.sub` in a timeout (e.g. via `signal.SIGALRM` on POSIX or a watchdog
  thread).
- LLM-produced regexes are validated by `re.compile()` server-side before being
  returned; the API surfaces a clear error if Claude ever emits an invalid pattern.

### Known limitations

- **Ephemeral storage on Render free tier.** Uploaded and transformed files survive
  the lifetime of a single Render instance but get wiped on every redeploy and on
  spin-up after idle. For a take-home demo this is fine; for production, swap the
  `backend/uploads/` directory for S3/GCS.
- **First request slow.** Render free web services spin down after ~15 min of
  inactivity. The first request after spin-down takes 30–60s while the container
  wakes.
- **No auth.** Anyone with the URL can upload, transform, and download. Fine for a
  demo; for real use, gate every endpoint behind a session check.
- **In-memory transform.** `/transform/` loads the entire file into a list of rows
  before writing the output. Fine for the take-home (CSVs of any normal size); for
  very large files (>1M rows), stream the transform row-by-row.
- **Generate Regex always overwrites Replace With.** If the user has typed a custom
  replacement and clicks Generate Regex again, their text is replaced with the
  LLM's new suggestion. Acceptable UX given the LLM's suggestion is usually a good
  starting point and the field is one click to edit again.

---

## Future improvements (in priority order)

1. **Match preview before Apply.** Show a "13 matches in this column" count next to
   the regex, with the first few matches highlighted in sample rows, *before* the
   user commits to a transformation.
2. **Multi-column transform.** Apply the regex to several columns at once.
3. **Undo.** Keep the original file id alongside transformed ones, with a one-click
   revert.
4. **Regex tester panel.** A live "try the regex against this row" panel so the
   user can see what they're about to commit to.
5. **Object storage for `uploads/`.** Required for production durability.
6. **Auth + per-user file isolation.**

## Demo Video

https://github.com/user-attachments/assets/3e71a544-7bfd-4c6b-8d1d-d69a66e23df8


