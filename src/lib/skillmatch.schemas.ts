import { z } from "zod";

export const sessionTokenSchema = z.string().uuid();

export const jobLevelSchema = z.enum(["Junior", "Mid", "Senior", "Lead"]);

/** Models return numbers, nulls or missing keys where we expect text — coerce instead of failing. */
const text = (max: number) =>
  z.preprocess(
    (value) => (value === null || value === undefined ? "" : typeof value === "string" ? value.trim() : String(value)),
    z.string().max(max),
  );

const nullableText = (max: number) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) return null;
    const raw = typeof value === "string" ? value.trim() : String(value);
    return raw.length === 0 ? null : raw.slice(0, max);
  }, z.string().max(max).nullable());

/** Accepts an array, a single string, a comma/newline separated list, or nothing. */
const list = (max: number, itemMax: number) =>
  z.preprocess((value) => {
    const raw = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[\n•;,]+/)
        : value === null || value === undefined
          ? []
          : [value];
    return raw
      .map((item) => (typeof item === "string" ? item.trim() : item === null || item === undefined ? "" : String(item)))
      .filter((item) => item.length > 0)
      .map((item) => item.slice(0, itemMax))
      .slice(0, max);
  }, z.array(z.string()));

const numberOrNull = (min: number, max: number) =>
  z.preprocess((value) => {
    if (typeof value === "number" && Number.isFinite(value)) return Math.min(max, Math.max(min, value));
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ""));
      if (Number.isFinite(parsed)) return Math.min(max, Math.max(min, parsed));
    }
    return null;
  }, z.number().nullable());

const score = z.preprocess((value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}, z.number().min(0).max(100));

export const parsedJobSchema = z.object({
  title: text(160).default("Untitled role"),
  company: text(160).default("Unknown company"),
  required_skills: list(40, 80),
  preferred_skills: list(40, 80),
  min_experience_years: numberOrNull(0, 60),
  max_experience_years: numberOrNull(0, 60),
  education_requirement: nullableText(500),
  role_summary: text(1200),
  job_level: z.preprocess((value) => {
    const raw = String(value ?? "").toLowerCase();
    if (raw.includes("lead") || raw.includes("principal") || raw.includes("staff")) return "Lead";
    if (raw.includes("senior") || raw.includes("sr")) return "Senior";
    if (raw.includes("junior") || raw.includes("entry") || raw.includes("jr")) return "Junior";
    return "Mid";
  }, jobLevelSchema),
});

export const educationSchema = z.object({
  degree: text(240),
  institution: text(240),
  year: nullableText(40),
});

export const experienceSchema = z.object({
  role: text(240),
  company: text(240),
  duration: text(120),
  highlights: list(12, 500),
});

export const parsedResumeSchema = z.object({
  full_name: text(160).default("Unknown candidate"),
  email: z.preprocess((value) => {
    const raw = typeof value === "string" ? value.trim() : "";
    return /.+@.+\..+/.test(raw) ? raw.slice(0, 255) : null;
  }, z.string().nullable()),
  phone: nullableText(60),
  current_role: nullableText(200),
  current_company: nullableText(200),
  skills: list(100, 80),
  education: z.preprocess((value) => (Array.isArray(value) ? value.slice(0, 12) : []), z.array(educationSchema)),
  experience: z.preprocess((value) => (Array.isArray(value) ? value.slice(0, 30) : []), z.array(experienceSchema)),
  total_experience_years: numberOrNull(0, 70),
});

export const matchAnalysisSchema = z.object({
  matched_skills: list(60, 80),
  missing_skills: list(60, 80),
  bonus_skills: list(60, 80),
  contextual_fit_score: score,
  ai_summary: text(1500),
  strengths: list(4, 500),
  concerns: list(4, 500),
});

export type ParsedJob = z.infer<typeof parsedJobSchema>;
export type ParsedResume = z.infer<typeof parsedResumeSchema>;
export type MatchAnalysis = z.infer<typeof matchAnalysisSchema>;
