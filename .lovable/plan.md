# Fix SkillMatch AI preview and Vercel deployment

## Current state
- The Lovable preview still shows "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY" even though the key exists in the project secret store — the binding has gone stale.
- The user wants to deploy to Vercel but does not know where to find the service role key or how to add it to Vercel.
- The user uploaded their Supabase API Keys page; the service role key is the "Secret keys" → "default" value.

## Plan

1. **Rebind Supabase secrets in Lovable**
   - Run `supabase--rebind_secrets` to refetch the canonical `SUPABASE_SERVICE_ROLE_KEY` and refresh the runtime environment.
   - This fixes the Lovable preview without touching `.env`.

2. **Give the user exact Vercel instructions**
   - In Vercel, go to Project → Settings → Environment Variables.
   - Add `SUPABASE_SERVICE_ROLE_KEY` with the value from Supabase Dashboard → Project Settings → API → "Secret keys" → default (the `sb_secret_...` key).
   - Add `GROQ_API_KEY` with the existing Groq key (`gsk_...`).
   - Keep the existing 6 browser keys (`VITE_SUPABASE_*`, etc.) already in Vercel.
   - Redeploy.

3. **Verify the preview works end to end**
   - Reload the Lovable preview and confirm the Supabase error banner is gone.
   - Run a full workflow: paste a sample job description, upload a resume, confirm parsing/scoring/ranking completes.
   - Fix any runtime errors that surface during the test.

4. **Confirm Vercel build target**
   - Ensure `vercel.json` is present and `NITRO_PRESET=vercel` is used for the Vercel build.

## Out of scope
- No code changes to the screening logic unless the end-to-end test reveals a bug.
- No `.env` edits; secrets stay in Lovable secrets and Vercel env vars only.
