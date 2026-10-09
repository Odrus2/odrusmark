# Odrusmark

Odrusmark is a static public website and authenticated client workspace for starting projects around goals, problems and opportunities. Clients describe what they want to accomplish; Odrusmark can determine relevant capabilities during scoping. The frontend is HTML, CSS and JavaScript modules. Supabase provides authentication and PostgreSQL, so GitHub Pages can host the app without a server.

## What is implemented

- Public overview plus capabilities, technology, ideas, projects, about and contact pages
- Supabase email/password signup, sign-in, email confirmation messaging, password reset and logout
- Authenticated client overview with live project and legacy research-request lists
- Project creation using a natural-language objective, success criteria, context, prior attempts, desired timeline and optional attachments
- Private project overview with status and intake details, plus private project attachments (up to 5, 10 MB each)
- Original research-request intake and request-detail flow preserved
- Editable client profile name
- Additive `projects` database table and RLS policies, plus private Supabase Storage bucket policies. Existing research requests and profiles are retained.
- No fake users, sample records, fake AI features or service-role credentials

The current workspace handles secure intake, private attachments, and basic status/detail viewing. Project tasks, research workspace, deliverables, findings and messaging are future capabilities and are described as such in the interface.

## Configure Supabase

1. Create a Supabase project and save its database password in a password manager.
2. In **Project Settings → API** (or **API Keys**), copy the **Project URL** and the **publishable/anon public key**. A key beginning `sb_publishable_` or the legacy anon JWT can be used in a browser. Never use `service_role` or `sb_secret_` keys in a static app.
3. Put these values in `js/config.js`, replacing `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY`.
4. Open **SQL Editor → New query**, paste `supabase.sql`, and run it. The schema uses `create if not exists` and replaceable policies/triggers so it preserves existing Odrusmark tables/data and adds `projects` and a private Storage bucket.
5. In **Table Editor**, confirm RLS is enabled on `profiles`, `research_requests` and `projects`.

The browser key is public by design. RLS and SQL grants enforce private data. New Auth users receive a `client` profile via a database trigger. Role changes must be made in an owner-controlled Supabase SQL session, for example:

```sql
update public.profiles set role = 'admin' where email = 'verified-staff@example.com';
```

The frontend cannot edit a profile role. Researchers and admins can see all projects through RLS and can update project status; only admins can delete. Clients can read their own projects and insert projects with ownership fixed to `auth.uid()`. Clients have no project update or delete policy. Similar isolation policies remain on research requests. No staff dashboard is exposed in this MVP.

Attachments use the non-public `odrusmark-project-files` bucket. Object names follow `<owner UUID>/<project UUID>/<randomized filename>`. Storage RLS checks the caller and parent project. Files are listed through authenticated storage access and opened with five-minute signed URLs. The bucket accepts common document, text, spreadsheet, CSV and image formats and enforces a 10 MB maximum per file.

## Configure email authentication

1. In **Authentication → Providers → Email**, enable email/password sign-in.
2. Choose whether email confirmation is required. For production, configure SMTP delivery; signup then instructs users to confirm through their email before signing in.
3. In **Authentication → URL Configuration**, set the Site URL to your deployment (eventually `https://odrusmark.com`). Add the production URLs and the exact GitHub Pages staging URL to allowed Redirect URLs, including `https://odrusmark.com/**`, `https://www.odrusmark.com/**` if used, and `https://OWNER.github.io/REPOSITORY/**` while staging.
4. Use Supabase's `{{ .ConfirmationURL }}` in confirmation and recovery email templates. Allow the deployed `reset-password.html` path for password recovery redirects.

Auth sessions persist and refresh through the official Supabase JavaScript client. Client-side route checks provide the expected UX; RLS remains the actual protection for private records.

## Run locally

Serve the files over HTTP; ES modules and Auth redirects do not work correctly from `file://` URLs. For example:

```sh
python -m http.server 8000
```

Open `http://localhost:8000` and add that origin to Supabase's allowed redirects during local setup.

## Deploy to GitHub Pages

1. Commit the site to a GitHub repository. Configure the public Supabase URL/key in `js/config.js` before deployment; never commit database passwords or service secrets.
2. Open repository **Settings → Pages**. Choose **Deploy from a branch**, select the production branch and repository root, then save.
3. Wait for the GitHub Pages URL and add its Auth redirect path in Supabase. Verify confirmation and password-reset redirects.
4. Set Supabase's Site URL to the production origin once the custom domain is serving.

No backend server or build step is required. `js/config.js` is a browser-side config file; GitHub Pages cannot inject secret environment variables, and none are needed in this architecture.

## Connect `odrusmark.com`

1. In repository **Settings → Pages → Custom domain**, enter `odrusmark.com` and save. Commit the generated `CNAME` file if GitHub does not create it.
2. At the DNS provider, set the GitHub Pages apex A records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`.
3. If using `www`, add a CNAME to `OWNER.github.io`. Do not alter `press.odrusmark.com` DNS records; this setup concerns the apex and optional `www` only.
4. After DNS propagates, enable **Enforce HTTPS** in GitHub Pages settings.
5. Update Supabase Site URL and redirect allowlist to the final canonical host.

## Launch configuration still needed

- Supabase project URL and public key in `js/config.js`
- SMTP/auth confirmation decisions, redirect allowlist and email templates
- A monitored company contact address; `hello@odrusmark.com` is a placeholder
- GitHub repository owner/name, publishing branch and domain DNS changes
- Business privacy notice, terms and data-retention policy before collecting client submissions

This workspace has no Supabase credentials, so live signup, email delivery, database connectivity, RLS behavior and custom-domain routing cannot be verified here. The SQL and client are wired for a real Supabase project; those live checks must be done after configuration.

## Files

```text
index.html, research.html, technology.html, ideas.html, projects.html
about.html, contact.html, signup.html, login.html, dashboard.html
new-project.html, project.html, request.html, request-details.html
profile.html, reset-password.html
css/styles.css
js/config.js, supabase.js, auth.js, site.js, ui.js
js/dashboard.js, project.js, request.js, request-details.js, profile.js, reset-password.js
supabase.sql
```
