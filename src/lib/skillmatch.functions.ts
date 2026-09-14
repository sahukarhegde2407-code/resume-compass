import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  matchAnalysisSchema,
  parsedJobSchema,
  parsedResumeSchema,
  sessionTokenSchema,
  type MatchAnalysis,
} from "./skillmatch.schemas";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

const parseJobInput = z.object({
  sessionToken: sessionTokenSchema,
  rawText: z.string().trim().min(200).max(5000),
});

const uploadInput = z.object({
  sessionToken: sessionTokenSchema,
  jobId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(240).regex(/\.(pdf|docx)$/i),
});

const processInput = z.object({
  sessionToken: sessionTokenSchema,
  jobId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(240).regex(/\.(pdf|docx)$/i),
  filePath: z.string().trim().min(1).max(600),
});

const workspaceInput = z.object({ sessionToken: sessionTokenSchema });
const statusInput = z.object({
  sessionToken: sessionTokenSchema,
  candidateId: z.string().uuid(),
  status: z.enum(["analyzed", "shortlisted", "rejected"]),
});

function cleanJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

async function groqJson<T>(prompt: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const key = process.env['GROQ_API_KEY'];
  if (!key) throw new Error("Groq is not configured. Add GROQ_API_KEY in project secrets.");

  let lastError = "Groq request failed.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1200));
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You extract recruiting data. Return only valid JSON with exactly the requested keys. Never include markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const body = await response.text();
    if (response.ok) {
      const payload = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Groq returned an empty response.");
      return schema.parse(cleanJson(content));
    }
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      lastError = parsed.error?.message ?? body;
    } catch {
      lastError = body || `Groq request failed (${response.status}).`;
    }
    if (response.status !== 429 && response.status < 500) break;
  }
  throw new Error(lastError);
}

function isTransient(message: string) {
  return /timeout|gateway|fetch failed|econnreset|502|503|504/i.test(message);
}

async function withRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  let lastMessage = "Request failed.";
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error);
      if (!isTransient(lastMessage) || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw new Error(
    isTransient(lastMessage)
      ? "The database is waking up. Please try again in a moment."
      : lastMessage,
  );
}

async function getSession(sessionToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return withRetry(async () => {
    const { data: existing, error } = await supabaseAdmin
      .from("screening_sessions")
      .select("id")
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existing) {
      await supabaseAdmin.from("screening_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", existing.id);
      return existing.id;
    }
    const { data, error: createError } = await supabaseAdmin
      .from("screening_sessions")
      .insert({ session_token: sessionToken })
      .select("id")
      .single();
    if (createError) throw new Error(createError.message);
    return data.id;
  });
}


async function assertJob(sessionId: string, jobId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("job_descriptions")
    .select("*")
    .eq("id", jobId)
    .eq("session_id", sessionId)
    .single();
  if (error) throw new Error("Job description was not found for this browser session.");
  return data;
}

export const parseJobDescription = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => parseJobInput.parse(input))
  .handler(async ({ data }) => {
    const sessionId = await getSession(data.sessionToken);
    const parsed = await groqJson(
      `Parse this job description as JSON with keys title, company, required_skills, preferred_skills, min_experience_years, max_experience_years, education_requirement, role_summary (2-3 concise sentences), job_level (Junior, Mid, Senior, or Lead). Use null for unknown numeric or education values.\n\nJOB DESCRIPTION:\n${data.rawText}`,
      parsedJobSchema,
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job, error } = await supabaseAdmin.from("job_descriptions").insert({
      session_id: sessionId,
      raw_text: data.rawText,
      ...parsed,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return job;
  });

export const createResumeUpload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadInput.parse(input))
  .handler(async ({ data }) => {
    const sessionId = await getSession(data.sessionToken);
    await assertJob(sessionId, data.jobId);
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${sessionId}/${data.jobId}/${crypto.randomUUID()}-${safeName}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from("resumes").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

async function extractText(fileName: string, bytes: ArrayBuffer): Promise<string> {
  let text = "";
  if (fileName.toLowerCase().endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    text = result.value;
  } else {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    text = pages.join("\n");
  }
  const cleaned = text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length < 80) throw new Error("We could not read enough text from this resume.");
  return cleaned.slice(0, 80_000);
}

function normalizeSkill(skill: string) {
  return skill.toLowerCase().replace(/[^a-z0-9+#.]/g, "");
}

function keywordScore(required: string[], candidate: string[]) {
  if (required.length === 0) return 100;
  const known = new Set(candidate.map(normalizeSkill));
  const matches = required.filter((skill) => known.has(normalizeSkill(skill))).length;
  return Math.round((matches / required.length) * 10000) / 100;
}

async function rerank(jobId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("match_results").select("id, overall_score").eq("job_description_id", jobId).order("overall_score", { ascending: false });
  if (!data) return;
  await Promise.all(data.map((row, index) => supabaseAdmin.from("match_results").update({ rank: index + 1 }).eq("id", row.id)));
}

export const processResume = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => processInput.parse(input))
  .handler(async ({ data }) => {
    const sessionId = await getSession(data.sessionToken);
    const job = await assertJob(sessionId, data.jobId);
    const expectedPrefix = `${sessionId}/${data.jobId}/`;
    if (!data.filePath.startsWith(expectedPrefix)) throw new Error("Invalid resume file path.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: candidate, error: createError } = await supabaseAdmin.from("candidates").insert({
      session_id: sessionId,
      job_description_id: data.jobId,
      file_name: data.fileName,
      file_path: data.filePath,
      status: "processing",
    }).select("id").single();
    if (createError) throw new Error(createError.message);
    try {
      const { data: file, error: fileError } = await supabaseAdmin.storage.from("resumes").download(data.filePath);
      if (fileError) throw new Error(fileError.message);
      const rawText = await extractText(data.fileName, await file.arrayBuffer());
      const parsed = await groqJson(
        `Parse this resume as JSON with keys full_name, email, phone, current_role, current_company, skills, education, experience, total_experience_years. Education items: degree, institution, year (nullable). Experience items: role, company, duration, highlights. Use null when unknown.\n\nRESUME:\n${rawText}`,
        parsedResumeSchema,
      );
      const analysis = await groqJson<MatchAnalysis>(
        `Analyze the candidate against the job. Return JSON with matched_skills, missing_skills, bonus_skills, contextual_fit_score (0-100), ai_summary (2-3 concise sentences), strengths (1-2 points), concerns (1-2 points). Treat this as recruiter decision support, not an automatic hiring decision.\n\nJOB:\n${job.raw_text}\n\nCANDIDATE:\n${rawText}`,
        matchAnalysisSchema,
      );
      const keyword = keywordScore(job.required_skills, parsed.skills);
      const overall = Math.round((keyword * 0.4 + analysis.contextual_fit_score * 0.6) * 100) / 100;
      const { error: updateError } = await supabaseAdmin.from("candidates").update({
        full_name: parsed.full_name,
        email: parsed.email,
        phone: parsed.phone,
        raw_text: rawText,
        parsed_skills: parsed.skills,
        parsed_education: parsed.education,
        parsed_experience: parsed.experience,
        total_experience_years: parsed.total_experience_years,
        current_job_title: parsed.current_role,
        current_company: parsed.current_company,
        status: "analyzed",
        analyzed_at: new Date().toISOString(),
      }).eq("id", candidate.id);
      if (updateError) throw new Error(updateError.message);
      const { error: resultError } = await supabaseAdmin.from("match_results").insert({
        session_id: sessionId,
        candidate_id: candidate.id,
        job_description_id: data.jobId,
        keyword_score: keyword,
        semantic_score: analysis.contextual_fit_score,
        overall_score: overall,
        matched_skills: analysis.matched_skills,
        missing_skills: analysis.missing_skills,
        bonus_skills: analysis.bonus_skills,
        ai_summary: analysis.ai_summary,
        strengths: analysis.strengths,
        concerns: analysis.concerns,
      });
      if (resultError) throw new Error(resultError.message);
      await rerank(data.jobId);
      return { candidateId: candidate.id, score: overall };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resume processing failed.";
      await supabaseAdmin.from("candidates").update({ status: "failed", error_message: message }).eq("id", candidate.id);
      throw new Error(message);
    }
  });

export const getWorkspace = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => workspaceInput.parse(input))
  .handler(async ({ data }) => {
    const sessionId = await getSession(data.sessionToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: jobs, error } = await supabaseAdmin.from("job_descriptions").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    const job = jobs?.[0] ?? null;
    if (!job) return { job: null, candidates: [], results: [] };
    const [{ data: candidates }, { data: results }] = await Promise.all([
      supabaseAdmin.from("candidates").select("*").eq("session_id", sessionId).eq("job_description_id", job.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("match_results").select("*").eq("session_id", sessionId).eq("job_description_id", job.id).order("rank"),
    ]);
    return { job, candidates: candidates ?? [], results: results ?? [] };
  });

export const updateCandidateStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusInput.parse(input))
  .handler(async ({ data }) => {
    const sessionId = await getSession(data.sessionToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("candidates").update({ status: data.status }).eq("id", data.candidateId).eq("session_id", sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
