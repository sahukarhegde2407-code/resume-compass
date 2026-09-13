# Resume Compass

SkillMatch AI - 

You are building SkillMatch AI, an AI-powered resume screening tool. No authentication needed. Public demo with session-only data.

Core Purpose

Help recruiters rank candidates against job descriptions using AI-powered semantic analysis + keyword matching. Decision-support tool (not auto-reject).

Tech Stack

Frontend: React 18 + TypeScript + Tailwind + shadcn/ui + Framer Motion

Backend: Supabase (PostgreSQL + Storage + Edge Functions/Deno)

AI: Groq API (llama-3.3-70b-versatile)

Parsing: unpdf (PDF) + mammoth (DOCX)

Database Schema

job_descriptions

id (uuid), title, company, raw_text, required_skills[], preferred_skills[], 

min_experience_years, max_experience_years, education_requirement, role_summary, 

job_level ('Junior'/'Mid'/'Senior'/'Lead'), created_at

candidates

id (uuid), job_description_id (fk), full_name, email, phone, file_name, file_path, 

raw_text, parsed_skills[], parsed_education (json), parsed_experience (json), 

total_experience_years, current_role, current_company, 

status ('pending'/'processing'/'analyzed'/'shortlisted'/'rejected'/'failed'), 

error_message, created_at, analyzed_at

match_results

id (uuid), candidate_id (fk), job_description_id (fk), overall_score, keyword_score, 

semantic_score, matched_skills[], missing_skills[], bonus_skills[], ai_summary, 

strengths, concerns, rank, created_at

Storage

Bucket: resumes (public) — PDFs & DOCXs, max 5MB each

Edge Functions (Deno)

1. parse-jd

Input: { raw_text }

Groq Prompt: Extract job requirements. Return JSON with required_skills, preferred_skills, min_experience_years, max_experience_years, education_requirement, role_summary (2-3 sentences), job_level. ONLY JSON, no markdown.

Output: Parsed JD object

Store: job_descriptions table

Timeout: 30s

2. extract-text

Input: { file_path, file_name }

Logic:

Fetch file from Supabase Storage

If PDF → unpdf (esm.sh)

If DOCX → mammoth (esm.sh)

Return cleaned raw_text

Output: { raw_text }

3. parse-resume

Input: { raw_text, candidate_id }

Groq Prompt: Parse resume. Return JSON with full_name, email, phone, current_role, current_company, skills[], education[], experience[], total_experience_years. ONLY JSON.

Output: Parsed candidate object

Store: Update candidates table, set status='analyzed'

4. analyze-match

Input: { candidate_id, job_description_id }

Logic:

Fetch candidate skills & JD required_skills

keyword_score = (matched_count / total_required) × 100

Groq: "Analyze candidate vs JD. Return JSON with matched_skills, missing_skills, bonus_skills, contextual_fit_score (0-100), ai_summary (2-3 sentences), strengths (1-2 points), concerns (1-2 points). ONLY JSON."

semantic_score = contextual_fit_score

overall_score = (0.4 × keyword_score) + (0.6 × semantic_score)

Rank all candidates for this JD by overall_score DESC

Output: Match result object

Store: match_results table

Color System

Use Hex Primary (Indigo) #4F46E5 Secondary (Violet) #7C3AED Success (Emerald) #10B981 Warning (Amber) #F59E0B Error (Rose) #EF4444

Score Colors:( dude i need the ui in the same color like has the logo ) 

≥75%: Green (Success)

50-74%: Amber (Warning)

<50%: Rose (Error)

User Flow

Hero → Animated gradient, headline "Rank Resumes in Seconds", CTA "Paste Job Description"

JD Modal → Paste text (min 200 chars), character counter (red <200, amber 200-499, green ≥500), button "Parse & Continue"

JD Breakdown → 4 cards (Required Skills, Preferred Skills, Experience, Education) with animated counters & staggered skill pills

Dropzone → Drag-drop PDFs/DOCX (up to 20, max 5MB each), shows selected files as pills

Upload Progress → Per-file status (spinner → pulsing dot → checkmark), total progress bar, auto-close on done

Dashboard → Ranked candidates sorted by overall_score DESC

Desktop: Table (Rank | Name | Score ring | Matched Skills | Missing | Actions)

Mobile: Card layout (stacked)

Sort dropdown, score filter slider (0-100), search box (debounce 300ms)

Detail Panel → Slide-in from right

Left: Resume (contact, skills accordion, education, experience, total years badge)

Center: Matched (green pills), Missing (amber pills), Bonus (blue pills)

Right: 3 score rings (Keyword, Contextual Fit, Overall), AI rationale (summary, strengths, concerns)

Actions: Shortlist, Reject, Back to Dashboard

Animations (Framer Motion)

Element Animation Duration Easing Page load Fade + 8px slide-up 200ms ease-out List items Staggered fade-up (40ms delay per) 200ms ease-out Dropzone hover Border pulse + scale 1.02 150ms ease-in-out Checkmark Pop-in scale 0→1 + bounce 300ms spring Score rings Fill 0→100% + count-up number 800ms ease-out Detail panel Slide-in X: 100→0, fade 300ms cubic-bezier(0.68, -0.55, 0.265, 1.55) Accordion Height animate + icon rotate 250ms ease-in-out Skill pills Fade + scale + bounce 200ms spring Button hover Scale 1.02 + shadow 150ms cubic-bezier Toast Slide top-right, fade, auto-dismiss 3s 250ms ease-out

UI Screens

Screen 1: Hero

Full viewport, animated gradient background

Headline: "Rank Resumes in Seconds" (staggered word reveal)

Subheadline + CTA button "Paste Job Description"

Dark mode toggle (footer)

Screen 2: JD Modal

Text area (200-5000 chars)

Character counter with color feedback

Green checkmark when ≥200 chars

"Parse & Continue" button (disabled if <200, shows spinner while parsing)

"Cancel" button

Screen 3: JD Breakdown

Header: Title, Company, Job Level

4-card grid (2 cols mobile, 4 desktop)

Required Skills (green): Counter + animated pills

Preferred Skills (blue): Same

Experience Required (purple): "5-8 years"

Education (indigo): "Bachelor's in CS or equivalent"

Buttons: "Edit JD", "Continue to Resumes" (primary)

Entrance: Staggered fade-up (40ms per card)

Screen 4: Resume Upload

Dropzone: Dashed border, icon, "Drag & drop… or click to select"

Subtext: "PDF/DOCX, up to 5MB, max 20 files"

Hover: Border pulses, card scales 1.02

Selected files: Pills (filename + size + X remove)

Upload Progress Modal:

Title: "Uploading Resumes…"

Total progress bar

Per-file rows: Icon (spinner→dot→checkmark) + filename + progress bar + "X of Y files"

Auto-close on done or "View Results" button

Failed files: Error icon + "Retry"

Screen 5: Dashboard

Header:

JD title, company, job level

Stats: "Total: 3", "Avg Score: 70", "Top: 75"

Sort dropdown: "Score (High→Low)", "Name (A→Z)", "Date (Newest)"

Score slider (0-100)

Search box

Desktop Table:

Rank | Name       | Score    | Matched Skills | Missing    | Actions

#1   | Alice Chen | 75 [████] | React, TS      | AWS        | [Shortlist] [View]

Mobile Cards:

┌────────────────────────────────┐

│ #1 ALICE CHEN                  │

│ Score: 75 [████████░░░░░]     │

│ ✓ React, TypeScript, Node.js   │

│ ✗ AWS                          │

│ [Shortlist] [View Details]     │

└────────────────────────────────┘

Screen 6: Detail Panel (Slide-in from Right)

Desktop (3 columns):

Left - Resume Info:

Contact (open): Name, Email, Phone

Skills (accordion): All skills

Education (accordion): Degrees

Experience (accordion): Jobs with descriptions

Badge: "6 Years Total"

Center - Skill Matching:

Matched (green pills): "React, TypeScript, Node.js, PostgreSQL, REST APIs"

Missing (amber pills): "AWS"

Bonus (blue pills): "GraphQL, Jest"

Right - Score Breakdown:

Keyword Match ring: e.g., "60" (animated)

Contextual Fit ring: e.g., "85"

Overall Match large ring: e.g., "75" (most prominent, rank badge "#1")

AI Rationale:

Summary: 2-3 sentences

Strengths: 1-2 points

Concerns: 1-2 points

Actions (bottom):

"Shortlist" (toggle, checkmark animation)

"Reject" (toggle, X animation)

"Back to Dashboard"

Mobile: Stacked vertically, same content

Test Data

JD Input

Senior React Developer

TechCorp Inc. seeks a Senior React Developer to lead frontend development.

Requirements:

- 5+ years web development

- React & TypeScript proficiency

- Node.js backend integration

- PostgreSQL knowledge

- REST API design & implementation

- Docker containerization

- Bachelor's in CS or equivalent

Nice to have: AWS, GraphQL, Jest, React Testing Library, Figma

Resume 1: Alice Chen (Expected Score: 75)

Senior React Developer at WebCorp (2 yrs)

- Led frontend team of 4, architected React component library (50+ components)

- TypeScript migration, reduced runtime errors 45%, improved performance 30%

- Mentored 2 junior developers

React Developer at StartupXYZ (2.5 yrs)

- Built customer dashboard, D3.js charts, 40% bundle size reduction

- REST API integrations, test coverage 40→85%

Junior Frontend at TechCorp Inc. (1.5 yrs)

- Built responsive pages, optimized load times

Education: BS Computer Science, Stanford (2018)

Skills: React, TypeScript, Node.js, PostgreSQL, REST APIs, Docker, AWS S3/Lambda, GraphQL, Jest, Testing Library

Total: 6 years

Expected Match: 75 overall (60 keyword, 85 semantic) | Rank #1 | Missing: AWS

Resume 2: Bob Smith (Expected Score: 62)

Full Stack Developer at DataSystems (3 yrs)

- React components, Node.js APIs, MongoDB

Frontend Developer at WebAgency (2 yrs)

- Responsive pages, Vue.js, learned React

Junior at StartupLabs (2 yrs)

Education: Associate, IT (2018)

Skills: React, JavaScript, Node.js, MongoDB, REST APIs, Vue.js, Docker, AWS Lambda

Total: 4 years

Expected Match: 62 overall (50 keyword, 70 semantic) | Rank #2 | Missing: TypeScript, PostgreSQL

Resume 3: Carol Dias (Expected Score: 72)

Senior Frontend Engineer at FinTech (3 yrs)

- Led team of 3, design system (80+ components), Core Web Vitals +40%, mentored developers

Frontend Engineer at MediaCo (3 yrs)

- React components, bundle optimization, mentored 1

Junior Frontend at WebServices (2 yrs)

Education: BS Information Systems, UC Berkeley (2016)

Skills: React, TypeScript, HTML5, CSS3, Next.js, Jest, Testing Library, Webpack, GraphQL, Performance

Total: 7 years

Expected Match: 72 overall (40 keyword, 95 semantic) | Rank #3 | Missing: Node.js, PostgreSQL, REST APIs, Docker

Implementation Notes

Groq Setup: Store API key in Supabase Edge Function secrets

File Parsing: Import unpdf & mammoth from esm.sh

Scoring: overall = (0.4 × keyword) + (0.6 × semantic)

Auto-ranking: Recalculate ranks for all candidates in JD after each analyze-match

Responsive: Table on desktop, cards on mobile (<768px)

Error Handling: Show spinner during API calls, allow file retry on failure

Accessibility: Color contrast ≥4.5:1, semantic HTML, ARIA labels

Performance: Debounce search 300ms, lazy-load detail panels, 60fps animations

Build Checklist

[ ] Database & storage bucket created

[ ] Hero page + animations

[ ] JD modal with validation

[ ] parse-jd Edge Function

[ ] JD breakdown cards

[ ] Dropzone + file upload

[ ] extract-text & parse-resume Edge Functions

[ ] Upload progress modal

[ ] analyze-match Edge Function

[ ] Dashboard with sorting/filtering/search

[ ] Score rings + animations

[ ] Detail panel (3-col desktop, stacked mobile)

[ ] Shortlist/reject toggle

[ ] Dark mode

[ ] Test with 3 dummy resumes

[ ] Responsive design (320px-1440px)

[ ] Error handling & retry

[ ] Deploy & verify

remember to use the logo has the reference for the ui(front end design )  also use some different approach for the features and interfaces yo man take less credits

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8981f41f-83b3-4d74-8acd-71991a2a3cbd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
