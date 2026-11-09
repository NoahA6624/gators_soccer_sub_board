This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Supabase setup

The app builds without Supabase credentials; at runtime the login page and board show a "Supabase is not configured" message until the env vars below are set.

1. **Create a project** at [supabase.com](https://supabase.com/dashboard) (note the database password).
2. **Link and push the schema** (needs `SUPABASE_ACCESS_TOKEN` from Account → Access Tokens, or run `npx supabase login`):
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push        # applies supabase/migrations/* (tables, RLS, is_editor(), realtime)
   ```
3. **Auth → Providers → Email:** enabled (magic link). Optionally turn off "Allow new users to sign up" once the team has logged in once; otherwise any email can sign in as a read-only viewer.
4. **Auth → URL Configuration:**
   - Site URL: your production URL, e.g. `https://<app>.vercel.app`
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<app>.vercel.app/auth/callback`, and for preview deploys `https://*-<team>.vercel.app/auth/callback`
5. **Env vars** — copy `.env.example` to `.env.local` (never commit it) and set the same values in Vercel → Settings → Environment Variables:
   | Var | Where | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | public |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API (anon / publishable key) | public; RLS protects data |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API (service_role / secret key) | **server only**, never `NEXT_PUBLIC_` |
   | `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN` | project creation / account tokens | CLI only |
6. **Editors:** everyone who signs in can read; only editors can write (RLS). Grant editor rights:
   ```bash
   npx tsx scripts/add-editor.ts coach@ufl.edu   # allowlist + upgrade existing profile
   ```
7. **Import existing data** from the original board ("Download all data (JSON)"). Keep the export outside the repo:
   ```bash
   npx tsx scripts/seed.ts ~/Downloads/gator-sub-board-export.json
   ```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
