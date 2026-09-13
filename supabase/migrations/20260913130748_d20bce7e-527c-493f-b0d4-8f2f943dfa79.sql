CREATE TYPE public.skillmatch_job_level AS ENUM ('Junior', 'Mid', 'Senior', 'Lead');
CREATE TYPE public.skillmatch_candidate_status AS ENUM ('pending', 'processing', 'analyzed', 'shortlisted', 'rejected', 'failed');

CREATE TABLE public.screening_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.screening_sessions TO service_role;
ALTER TABLE public.screening_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.job_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.screening_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  company text NOT NULL DEFAULT 'Company not specified',
  raw_text text NOT NULL,
  required_skills text[] NOT NULL DEFAULT '{}',
  preferred_skills text[] NOT NULL DEFAULT '{}',
  min_experience_years numeric(4,1),
  max_experience_years numeric(4,1),
  education_requirement text,
  role_summary text,
  job_level public.skillmatch_job_level NOT NULL DEFAULT 'Mid',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.job_descriptions TO service_role;
ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.screening_sessions(id) ON DELETE CASCADE,
  job_description_id uuid NOT NULL REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'Processing candidate',
  email text,
  phone text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  raw_text text,
  parsed_skills text[] NOT NULL DEFAULT '{}',
  parsed_education jsonb NOT NULL DEFAULT '[]'::jsonb,
  parsed_experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_experience_years numeric(4,1),
  current_job_title text,
  current_company text,
  status public.skillmatch_candidate_status NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  analyzed_at timestamptz
);
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.screening_sessions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL UNIQUE REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_description_id uuid NOT NULL REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
  overall_score numeric(5,2) NOT NULL,
  keyword_score numeric(5,2) NOT NULL,
  semantic_score numeric(5,2) NOT NULL,
  matched_skills text[] NOT NULL DEFAULT '{}',
  missing_skills text[] NOT NULL DEFAULT '{}',
  bonus_skills text[] NOT NULL DEFAULT '{}',
  ai_summary text NOT NULL,
  strengths text[] NOT NULL DEFAULT '{}',
  concerns text[] NOT NULL DEFAULT '{}',
  rank integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_results_overall_score_range CHECK (overall_score BETWEEN 0 AND 100),
  CONSTRAINT match_results_keyword_score_range CHECK (keyword_score BETWEEN 0 AND 100),
  CONSTRAINT match_results_semantic_score_range CHECK (semantic_score BETWEEN 0 AND 100),
  CONSTRAINT match_results_rank_positive CHECK (rank > 0)
);
GRANT ALL ON public.match_results TO service_role;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

CREATE INDEX job_descriptions_session_created_idx ON public.job_descriptions(session_id, created_at DESC);
CREATE INDEX candidates_job_status_idx ON public.candidates(job_description_id, status);
CREATE INDEX candidates_session_created_idx ON public.candidates(session_id, created_at DESC);
CREATE INDEX match_results_job_score_idx ON public.match_results(job_description_id, overall_score DESC);
CREATE INDEX match_results_session_idx ON public.match_results(session_id);

CREATE OR REPLACE FUNCTION public.skillmatch_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER screening_sessions_set_updated_at BEFORE UPDATE ON public.screening_sessions FOR EACH ROW EXECUTE FUNCTION public.skillmatch_set_updated_at();
CREATE TRIGGER job_descriptions_set_updated_at BEFORE UPDATE ON public.job_descriptions FOR EACH ROW EXECUTE FUNCTION public.skillmatch_set_updated_at();
CREATE TRIGGER candidates_set_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.skillmatch_set_updated_at();
CREATE TRIGGER match_results_set_updated_at BEFORE UPDATE ON public.match_results FOR EACH ROW EXECUTE FUNCTION public.skillmatch_set_updated_at();