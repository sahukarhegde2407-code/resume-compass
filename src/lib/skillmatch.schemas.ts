import { z } from "zod";

export const sessionTokenSchema = z.string().uuid();

export const jobLevelSchema = z.enum(["Junior", "Mid", "Senior", "Lead"]);

export const parsedJobSchema = z.object({
  title: z.string().trim().min(1).max(160),
  company: z.string().trim().min(1).max(160),
  required_skills: z.array(z.string().trim().min(1).max(80)).max(40),
  preferred_skills: z.array(z.string().trim().min(1).max(80)).max(40),
  min_experience_years: z.number().min(0).max(60).nullable(),
  max_experience_years: z.number().min(0).max(60).nullable(),
  education_requirement: z.string().trim().max(500).nullable(),
  role_summary: z.string().trim().min(1).max(1200),
  job_level: jobLevelSchema,
});

export const educationSchema = z.object({
  degree: z.string().trim().max(240),
  institution: z.string().trim().max(240),
  year: z.string().trim().max(40).nullable(),
});

export const experienceSchema = z.object({
  role: z.string().trim().max(240),
  company: z.string().trim().max(240),
  duration: z.string().trim().max(120),
  highlights: z.array(z.string().trim().max(500)).max(12),
});

export const parsedResumeSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(255).nullable(),
  phone: z.string().trim().max(60).nullable(),
  current_role: z.string().trim().max(200).nullable(),
  current_company: z.string().trim().max(200).nullable(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100),
  education: z.array(educationSchema).max(12),
  experience: z.array(experienceSchema).max(30),
  total_experience_years: z.number().min(0).max(70).nullable(),
});

export const matchAnalysisSchema = z.object({
  matched_skills: z.array(z.string().trim().min(1).max(80)).max(60),
  missing_skills: z.array(z.string().trim().min(1).max(80)).max(60),
  bonus_skills: z.array(z.string().trim().min(1).max(80)).max(60),
  contextual_fit_score: z.number().min(0).max(100),
  ai_summary: z.string().trim().min(1).max(1500),
  strengths: z.array(z.string().trim().min(1).max(500)).min(1).max(4),
  concerns: z.array(z.string().trim().min(1).max(500)).min(1).max(4),
});

export type ParsedJob = z.infer<typeof parsedJobSchema>;
export type ParsedResume = z.infer<typeof parsedResumeSchema>;
export type MatchAnalysis = z.infer<typeof matchAnalysisSchema>;
