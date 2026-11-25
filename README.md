# ResumeSender

ResumeSender is a Next.js App Router application for a personal job-application workspace.

## Run locally

```bash
npm install
npm run db:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Backend setup

Provide these variables through your process manager or deployment environment; no environment files are required:

- `DATABASE_URL`: PostgreSQL connection string.
- `NEXTAUTH_SECRET`: a strong random secret for signed sessions.
- `NEXTAUTH_URL`: canonical application URL in deployed environments.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: server-only Google OAuth web-client credentials. The requested scopes are limited to `openid email profile`. Add `http://localhost:3000` as an authorized JavaScript origin and `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
- `STORAGE_PROVIDER`, `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, and `STORAGE_SECRET_ACCESS_KEY`: server-only private object-storage settings.
- `STORAGE_FORCE_PATH_STYLE`: set to `true` only when required by the S3-compatible provider.
- `STORAGE_SIGNED_URL_TTL_SECONDS`: signed preview/download lifetime, limited to 60–300 seconds.
- `RESUME_MAX_FILE_SIZE_BYTES`: upload limit from 1 byte to 5 MiB; defaults to `5242880`.

See [.env.example](./.env.example) for variable names and placeholder values. Copy the placeholders into your deployment's secret manager; do not commit real credentials.

### Google OAuth setup

1. Create or select a project in Google Cloud Console and configure the OAuth consent screen.
2. Create an OAuth 2.0 Client ID with application type **Web application**.
3. Add `http://localhost:3000` under authorized JavaScript origins for local development.
4. Add `http://localhost:3000/api/auth/callback/google` under authorized redirect URIs.
5. For production, add the HTTPS production origin and `https://<your-domain>/api/auth/callback/google`. Set `NEXTAUTH_URL` to that canonical HTTPS origin. For Vercel Preview sign-in, authorize the exact preview origin and callback URL; Google does not accept wildcard origins.
6. Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a strong `NEXTAUTH_SECRET` in the deployment secret manager. For Vercel, configure them in the appropriate Development, Preview, and Production environments, set each `NEXTAUTH_URL` to its canonical origin, then redeploy.

The app uses NextAuth's OAuth state and PKCE checks, JWT sessions, and its HttpOnly, SameSite cookies (secure cookies in production). Google account linking requires Google's verified email claim; no Gmail API or mail-sending scopes are requested. There is no separate password registration flow: first-time Google sign-in creates the user and returning Google identities resolve to that same account.

The database schema is in `prisma/schema.prisma`. `npm run db:deploy` applies checked-in additive migrations without resetting data. `npm run db:check` verifies connectivity using the `DATABASE_URL` process variable. `npm run db:generate` regenerates the Prisma client.

## Private resume storage

Resume uploads require an AWS S3 or S3-compatible bucket. Create a dedicated bucket with public access blocked, object ownership enforced, and default at-rest encryption enabled. Do not configure public ACLs, website hosting, or public-read bucket policies. Give the application credentials only the bucket-scoped `GetObject`, `PutObject`, and `DeleteObject` permissions it needs. Keep all storage variables in the server/deployment secret manager; they are never sent to client code. For Cloudflare R2, use `STORAGE_PROVIDER=s3-compatible`, the account's S3 endpoint, the `auto` region, and credentials scoped to the private bucket.

Uploads accept PDFs only, enforce the declared MIME type, `.pdf` extension, PDF header/trailer structure, and a maximum 5 MiB size. The server checks the PDF signature and rejects common active-content markers. Each object receives a random server-generated key, is stored as a private object, and is never assigned a permanent public URL. Preview and download requests first verify the signed-in user's ownership, then redirect to a short-lived URL (60–300 seconds). Use a separate storage origin and enable bucket-level public-access blocks.

The resume manager uses the `20261121220000_resume_manager` additive migration. It backfills existing resume display names from their filenames and adds database uniqueness for each user's default resume plus persistent per-user API rate-limit buckets. No existing resume records are dropped. A user can have only one default resume; database uniqueness and a per-user transaction lock protect concurrent changes. Active draft, queued, sending, and paused campaigns prevent resume deletion.

## Current implementation

- Responsive dashboard and workspace navigation.
- Google OAuth sign-in with verified-email checks, persistent provider-account linking, and user records stored in PostgreSQL.
- User-scoped recruiter and email-template CRUD APIs with Zod validation and normalized email addresses.
- Duplicate-safe recruiter CSV imports and an explicit, retry-safe import flow for legacy browser contacts/templates.
- Dashboard counts sourced from PostgreSQL.
- Prisma models for users, recruiters, templates, resumes, Gmail accounts, campaigns, recipients, email logs, suppressions, audit logs, outbox events, and job applications.
- Private PDF resume manager with upload progress, preview, download, rename, delete, and default selection.

The legacy browser storage keys are read only to offer a one-time import after sign-in. New data is not persisted to browser storage. Email previews are not sent; Gmail token storage, resume uploads, campaign creation, queue processing, and email delivery are not active in this phase.

Run `npm test` for API validation and ownership tests. Never put OAuth credentials, tokens, or encryption keys in source control or browser code.
