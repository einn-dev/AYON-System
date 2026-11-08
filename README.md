# AYON: Web-Based Integrated Research Services Management System

AYON is a web system for the **Mamitua Saber Institute of Research and Creation (MSIRC)** of Mindanao State University – Main Campus, Marawi City.

It puts the institute's research services in one place. Researchers submit proposals online. Their college and the MSIRC offices endorse, validate and approve them with electronic signatures. Everyone can follow where each proposal is at every step.

> Capstone project, Bachelor of Science in Information Technology, MSU – Main Campus
> Developed by **Norhidaya Tocalo** and **Zainab Pumbaya**

---

## Contents

- [What AYON does](#what-ayon-does)
- [Who uses it](#who-uses-it)
- [How a proposal moves](#how-a-proposal-moves)
- [Built with](#built-with)
- [Project folders](#project-folders)
- [Running it on your computer](#running-it-on-your-computer)
- [Settings (environment variables)](#settings-environment-variables)
- [Deployment](#deployment)
- [Security notes](#security-notes)

---

## What AYON does

**For researchers**
- Submit a research proposal in three steps: type, details, and documents
- Save a proposal as a **draft** at any step and finish it later
- Attach a **Main Proposal Document** plus up to **4 supporting documents**, such as the Line-Item Budget, each with its own label
- Follow every proposal on a step-by-step tracker that shows who has it now
- Edit and resubmit a proposal that was returned for revision
- Filter **My Proposals** by status, type and year, and sort it
- Apply for grants and incentives, and browse the Research Repository

**For the college and the MSIRC offices**
- Endorse, validate, approve or return proposals, each with a remarks field
- **Electronic signatures**: a saved signature plus a confirmation tick box, placed on the proposal at each signing step
- Queues that show only what is waiting for each office
- Reports with filters, and a history of the reports each person generated

**For everyone**
- In-app notifications, with email notices for important steps
- **Global search** (Ctrl K) across proposals, research and pages, limited to what each role may see
- A **Help** page with a guide for each role, a status guide, FAQs and the MSIRC contact details
- Announcements from the administrator, shown as a banner

**For the administrator**
- Manage accounts: create users, assign roles, activate or deactivate accounts, reset passwords and verify emails
- Oversee all proposals, move a stuck proposal, and send reminders
- Manage the Research Repository and grants
- Post announcements
- Read the Audit Log and the Email Log

---

## Who uses it

| Role | What they do in AYON |
|---|---|
| Researcher | Submits proposals and follows their progress |
| Chairperson | First college endorsement (department level) |
| Research Coordinator | Second college endorsement |
| College Dean | Last college endorsement |
| Special Assistant | Validates the proposal and forwards it to the Director |
| MSIRC Director | Endorses it to OVCRED, or approves it |
| OVCRED | Grants the final approval |
| MSIRC Staff | Monitors proposals at MSIRC and the Repository (view only) |
| Administrator | Manages accounts, settings, announcements and logs |

---

## How a proposal moves

```
Researcher submits
   │
   ▼
College endorsement:  Chairperson  →  Research Coordinator  →  College Dean
   │   (an office with no account yet is skipped automatically)
   ▼
MSIRC:  Special Assistant (validate)  →  MSIRC Director  →  OVCRED (final approval)
   │
   ▼
Approved  /  Rejected
```

Any office can **return** a proposal to the researcher with a reason. The researcher edits it and resubmits, and it starts again from the college level.

| Status | Meaning |
|---|---|
| Draft | Saved by the researcher, not submitted yet (only the researcher sees it) |
| For College Endorsement | With the Chairperson, Research Coordinator or Dean |
| For Validation | With the Special Assistant |
| For Director Review | With the MSIRC Director |
| For OVCRED Approval | With OVCRED |
| Returned for Revision | Sent back to the researcher to fix |
| Approved / Rejected | The final decision |

---

## Built with

| Part | Technology |
|---|---|
| Front end | React (Create React App), React Router, React Icons |
| Back end | Node.js, Express |
| Database | Supabase (PostgreSQL) |
| File storage | Supabase Storage |
| Sign-in | JSON Web Tokens (JWT), bcrypt password hashing |
| File uploads | Multer (PDF, DOC and DOCX, up to 10 MB each) |
| Email | Brevo API (online), or Gmail through Nodemailer (local) |
| Hosting | Vercel (front end), Render (back end) |

---

## Project folders

```
AYON-System/
├── client/                 React front end (deployed to Vercel)
│   └── src/
│       ├── components/     Shared parts: layout, top bar, tracker, signatures, documents
│       ├── pages/          Sign-in, register, help, terms, privacy
│       │   └── dashboards/ One dashboard per role, plus admin pages
│       ├── data/           Help content, colleges list, legal text
│       ├── services/       API connection (authService.js)
│       └── utils/          Status and role labels
└── server/                 Express API (deployed to Render)
    ├── config/             Supabase connection
    ├── controllers/        What each request does
    ├── middleware/         Sign-in and role checks
    ├── routes/             API addresses (/api/...)
    ├── utils/              Endorsement chain, signatures, files, email, audit log
    └── server.js           Starts the API
```

---

## Running it on your computer

### What you need
- [Node.js](https://nodejs.org) 18 or newer
- A [Supabase](https://supabase.com) project, with a **Storage bucket** for uploaded files
- Git

### 1. Get the code

```bash
git clone https://github.com/einn-dev/AYON-System.git
cd AYON-System
```

### 2. Set up the database

In Supabase, open **SQL Editor** and run these files **in this order**:

1. `ayon_schema_postgres.sql` (the main tables)
2. `add_email_verification.sql`
3. `add_password_management.sql`
4. `add_session_revocation.sql`
5. `add_profile_picture.sql`
6. `add_audit_and_email_log.sql`
7. `add_resubmit.sql`
8. `add_college_endorsement.sql`
9. `add_report_filters.sql`
10. `add_signatures.sql`
11. `add_announcements.sql`
12. `add_proposal_files.sql`

Each file is safe to run more than once.

### 3. Start the server

```bash
cd server
npm install
```

Create a file named `.env` inside `server/` (see [Settings](#settings-environment-variables)), then run:

```bash
node server.js
```

The API runs at `http://localhost:5000`. Opening it in a browser shows "AYON API is running."

### 4. Start the client

Open a second terminal:

```bash
cd client
npm install
npm start
```

The app opens at `http://localhost:3000`. It talks to the server address set in `client/src/services/authService.js`.

### 5. Sign in

The database setup creates one administrator account. Sign in with it, **change its password right away**, then create the other accounts from the Admin pages.

---

## Settings (environment variables)

Put these in `server/.env`. **Never commit this file.** It is already listed in `.gitignore`.

| Name | What it is |
|---|---|
| `PORT` | Port of the API (default `5000`) |
| `SUPABASE_URL` | Your Supabase project address |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server only, keep it secret) |
| `SUPABASE_BUCKET` | Name of the Storage bucket for uploaded files |
| `JWT_SECRET` | A long random text used to sign sign-in tokens |
| `JWT_EXPIRES_IN` | How long a sign-in lasts, for example `8h` |
| `FRONTEND_URL` | Address of the client, for example `https://your-app.vercel.app` (comma-separated if more than one) |
| `APP_URL` | Address used in links inside emails (defaults to the first `FRONTEND_URL`) |
| `BREVO_API_KEY` | Brevo key for sending email online (needed on Render) |
| `BREVO_SENDER_EMAIL` | The "from" address for Brevo emails |
| `BREVO_SENDER_NAME` | The "from" name, for example `AYON – MSIRC` |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail address and app password, used only when `BREVO_API_KEY` is not set |

---

## Deployment

- **Server → Render:** a Web Service with root directory `server`, start command `node server.js`, and all the settings above added under *Environment*.
- **Client → Vercel:** root directory `client`. Vercel builds with `CI=true`, so a code warning stops the build. Fix every warning before you push.
- After a database change, run the new SQL file in Supabase **before** you deploy the server.

---

## Security notes

- Keep `.env` files and Supabase keys out of GitHub. If a key was ever pushed, regenerate it in Supabase.
- Turn on **Row Level Security** for the tables in Supabase. The server uses the service key, so the app keeps working.
- Change the default administrator password after the first sign-in.
- Uploaded files are checked by type (PDF, DOC, DOCX) and size (10 MB) on both the client and the server.

---

## Contact

**Mamitua Saber Institute of Research and Creation (MSIRC)**
MSIRC Building, 2nd Street, Mindanao State University – Main Campus, Marawi City
msirc@msumain.edu.ph · Monday to Friday, 8:00 AM to 5:00 PM