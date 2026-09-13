# SkillMatch AI implementation plan

## Goal
Build a public, no-login resume screening application that persists job descriptions, uploaded resumes, analysis results, and recruiter decisions in Supabase. Use Groq `llama-3.3-70b-versatile` for structured extraction and contextual matching, while keeping the deterministic 40% keyword / 60% contextual score formula.

## Product experience
- Create a dark, high-contrast visual system inspired by the uploaded ResumeAI logo: near-black/navy surfaces, teal-to-coral highlights, warm amber glints, and restrained indigo/violet controls.
- Start at a full-screen animated “Rank Resumes in Seconds” page with a focused job-description action and footer theme control.
- Guide users through one continuous workspace: job description modal, parsed requirement summary, resume dropzone, per-file progress, ranked dashboard, and a right-side candidate detail view.
- Keep the dashboard dense and recruiter-friendly: desktop table, mobile candidate cards, score-based color semantics, search, sorting, score threshold, shortlist/reject controls, empty/error/retry states, and clear “decision support” wording.
- Use the supplied Alice, Bob, and Carol examples as deterministic demo fixtures for visual and scoring verification without spending Groq credits repeatedly.

## Data and privacy
- Add `screening_sessions`, `job_descriptions`, `candidates`, and `match_results` tables with indexes, timestamps, enums/checks for bounded static values, explicit grants, and RLS enabled.
- Associate every record with a long random browser session ID so data persists across refreshes in the same browser without requiring an account.
- Keep resume objects in a **private** `resumes` bucket with a 5 MB limit. The original public-bucket request is intentionally tightened because resumes contain contact details and employment history.
- Do not grant direct anonymous table or bucket access. Validated server actions use the server-only Supabase client and scope every read/write to the browser session ID.
- Persist shortlist/reject decisions and recalculate rank after each successful analysis.

## Processing workflow
1. Validate job text at 200–5,000 characters in both browser and server.
2. Call Groq server-side for strict JSON job extraction, validate the response, and store the normalized job description.
3. Validate up to 20 PDF/DOCX files, their real extension/type, and 5 MB size. Issue short-lived signed upload URLs so files upload directly to private storage.
4. Download each stored file server-side, extract PDF/DOCX text using Worker-compatible parsing libraries, normalize it, and reject empty or oversized text.
5. Call Groq for strict resume extraction, validate and store candidate fields, then run contextual matching.
6. Compute keyword score locally, accept only a bounded 0–100 contextual score from Groq, calculate the weighted overall score, store rationale/skills, and rerank all candidates for the job.
7. Process files sequentially by default to reduce API spend and shared rate-limit pressure; expose per-file progress and retry only failed files.

## Technical approach
- Keep the project’s TanStack Start + React 19 foundation rather than downgrading to React 18.
- Use TanStack server functions for app-internal database, parsing, and Groq operations. This replaces the requested Deno Edge Functions because this project already has a first-class server runtime.
- Use Zod validation at every browser/server/API boundary and validate Groq JSON before persistence.
- Keep the Groq API key server-only as `GROQ_API_KEY`; request it through the secure secret form after the backend surface is ready.
- Add Framer Motion for the specified transitions, with reduced-motion fallbacks and lazy-loaded candidate detail content.
- Use existing shadcn controls for buttons, dialogs, sliders, selects, accordions, sheets, progress, and toasts.

## Main code areas
- Design tokens, typography, global animations, and theme behavior in the global stylesheet and root page shell.
- Focused screening components for the job modal, requirement breakdown, upload queue, score ring, filters, result table/cards, and candidate detail sheet.
- Shared schemas/types for validated inputs, parsed AI output, status values, and score calculations.
- Server functions/helpers for session creation, signed uploads, text extraction, Groq requests, persistence, ranking, and status updates.
- One database migration for schema, grants, RLS, indexes, and safe demo seed records where appropriate; one storage bucket plus object policies.

## Validation
- Verify database grants and RLS prevent direct anonymous access.
- Exercise one real Groq request for job parsing and one real candidate analysis, surfacing Groq’s exact actionable error message when it fails.
- Check the supplied scoring formula and candidate ordering with deterministic fixtures.
- Test file validation, retry behavior, filters, status toggles, modal/sheet focus behavior, and keyboard operation.
- Visually verify the complete flow at 320 px mobile, tablet, and 1440 px desktop, including no overlap and reduced-motion behavior.
- Confirm every content route has app-specific title, description, Open Graph, and Twitter metadata.

## Known constraint
Without authentication, persistence is browser-session scoped rather than account scoped. Clearing browser storage loses access to prior screenings, although the records remain in Supabase until cleanup is added later.
