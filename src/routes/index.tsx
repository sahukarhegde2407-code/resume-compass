import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight, Award, BriefcaseBusiness, Check, CheckCircle2, ChevronLeft, CircleAlert,
  CloudUpload, FileText, GraduationCap, LoaderCircle, Mail, Moon, Phone, Search,
  ShieldCheck, Sparkles, Sun, Target, ThumbsDown, ThumbsUp, Trash2, UserRound, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { createResumeUpload, getWorkspace, parseJobDescription, processResume, updateCandidateStatus } from "@/lib/skillmatch.functions";
import type { Database, Json } from "@/integrations/supabase/types";

type Job = Database["public"]["Tables"]["job_descriptions"]["Row"];
type Candidate = Database["public"]["Tables"]["candidates"]["Row"];
type Result = Database["public"]["Tables"]["match_results"]["Row"];
type QueueFile = { file: File; status: "ready" | "uploading" | "analyzing" | "done" | "failed"; error?: string };

const SAMPLE_JD = `Senior React Developer\n\nTechCorp Inc. seeks a Senior React Developer to lead frontend development.\n\nRequirements:\n- 5+ years web development\n- React & TypeScript proficiency\n- Node.js backend integration\n- PostgreSQL knowledge\n- REST API design & implementation\n- Docker containerization\n- Bachelor's in CS or equivalent\n\nNice to have: AWS, GraphQL, Jest, React Testing Library, Figma`;

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "SkillMatch AI — Rank Resumes in Seconds" },
    { name: "description", content: "Compare resumes with job requirements using explainable AI and transparent weighted scoring." },
    { property: "og:title", content: "SkillMatch AI — Resume Screening" },
    { property: "og:description", content: "Rank resumes with explainable skill and contextual matching." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SkillMatchPage,
});

function getSessionToken() {
  const key = "skillmatch-session";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const token = crypto.randomUUID();
  sessionStorage.setItem(key, token);
  return token;
}

function SkillMatchPage() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const parseJob = useServerFn(parseJobDescription);
  const loadWorkspace = useServerFn(getWorkspace);
  const getUpload = useServerFn(createResumeUpload);
  const process = useServerFn(processResume);
  const setStatus = useServerFn(updateCandidateStatus);
  const [sessionToken, setSessionToken] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [jdOpen, setJdOpen] = useState(false);
  const [jdText, setJdText] = useState(SAMPLE_JD);
  const [parsing, setParsing] = useState(false);
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState("score");
  const [dark, setDark] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async (token = sessionToken) => {
    if (!token) return;
    const data = await loadWorkspace({ data: { sessionToken: token } });
    setJob(data.job); setCandidates(data.candidates); setResults(data.results);
  };

  useEffect(() => {
    const token = getSessionToken(); setSessionToken(token); void refresh(token);
  }, []);
  useEffect(() => { const id = setTimeout(() => setDebouncedQuery(query), 300); return () => clearTimeout(id); }, [query]);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);

  const rows = useMemo(() => results.map((result) => ({
    result,
    candidate: candidates.find((candidate) => candidate.id === result.candidate_id),
  })).filter((row): row is { result: Result; candidate: Candidate } => Boolean(row.candidate))
    .filter(({ candidate, result }) => candidate.full_name.toLowerCase().includes(debouncedQuery.toLowerCase()) && result.overall_score >= minScore)
    .sort((a, b) => sort === "name" ? a.candidate.full_name.localeCompare(b.candidate.full_name) : sort === "date" ? b.candidate.created_at.localeCompare(a.candidate.created_at) : b.result.overall_score - a.result.overall_score),
  [results, candidates, debouncedQuery, minScore, sort]);
  const selectedRow = rows.find((row) => row.candidate.id === selected) ?? results.map((result) => ({ result, candidate: candidates.find((candidate) => candidate.id === result.candidate_id) })).find((row) => row.candidate?.id === selected);

  const submitJd = async () => {
    if (jdText.trim().length < 200) return;
    setParsing(true);
    try { const parsed = await parseJob({ data: { sessionToken, rawText: jdText } }); setJob(parsed); setCandidates([]); setResults([]); setJdOpen(false); toast.success("Job requirements parsed"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not parse the job description."); }
    finally { setParsing(false); }
  };

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const valid = incoming.filter((file) => /\.(pdf|docx)$/i.test(file.name) && file.size <= 5 * 1024 * 1024);
    if (valid.length !== incoming.length) toast.error("Only PDF/DOCX files up to 5 MB are accepted.");
    setQueue((current) => [...current, ...valid.slice(0, Math.max(0, 20 - current.length))].map((file) => ({ file, status: "ready" })));
  };

  const runUpload = async () => {
    if (!job || queue.length === 0) return;
    setUploading(true);
    const next = [...queue];
    for (let i = 0; i < next.length; i += 1) {
      if (next[i].status === "done") continue;
      try {
        next[i] = { ...next[i], status: "uploading" }; setQueue([...next]);
        const signed = await getUpload({ data: { sessionToken, jobId: job.id, fileName: next[i].file.name } });
        const { error } = await supabase.storage.from("resumes").uploadToSignedUrl(signed.path, signed.token, next[i].file, { contentType: next[i].file.type });
        if (error) throw error;
        next[i] = { ...next[i], status: "analyzing" }; setQueue([...next]);
        await process({ data: { sessionToken, jobId: job.id, fileName: next[i].file.name, filePath: signed.path } });
        next[i] = { ...next[i], status: "done" }; setQueue([...next]);
        await refresh();
      } catch (error) {
        next[i] = { ...next[i], status: "failed", error: error instanceof Error ? error.message : "Processing failed" }; setQueue([...next]);
      }
    }
    setUploading(false); toast.success("Resume analysis complete");
  };

  const toggleStatus = async (candidate: Candidate, status: "shortlisted" | "rejected") => {
    const next = candidate.status === status ? "analyzed" : status;
    await setStatus({ data: { sessionToken, candidateId: candidate.id, status: next } });
    await refresh(); toast.success(next === "analyzed" ? "Decision cleared" : `Candidate ${next}`);
  };

  return <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-3" aria-label="SkillMatch AI home">
          <span className="logo-mark"><FileText className="size-5" /></span><span className="font-display text-lg font-bold">SkillMatch <span className="text-gradient">AI</span></span>
        </button>
        <div className="flex items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:block">Decision support, not auto-rejection</span><ShieldCheck className="size-4 text-success" /></div>
      </div>
    </header>

    {!job ? <section className="hero-grid relative flex min-h-[92vh] items-center pt-16">
      <div className="mx-auto w-full max-w-7xl px-5 py-20 lg:px-8">
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }} className="max-w-4xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm text-accent"><Sparkles className="size-4" /> Explainable AI screening</div>
          <h1 className="font-display text-5xl font-bold leading-[1.02] sm:text-7xl lg:text-8xl">Rank Resumes<br/><span className="text-gradient">in Seconds</span></h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">Turn a job description and a stack of resumes into a transparent, ranked shortlist—without losing the human judgment that matters.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Button variant="hero" size="lg" onClick={() => setJdOpen(true)}>Paste Job Description <ArrowRight /></Button><Button variant="outline" size="lg" onClick={() => { setJdText(SAMPLE_JD); setJdOpen(true); }}><Sparkles /> Try sample role</Button></div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground"><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> Semantic + keyword match</span><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> Explainable scores</span><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> PDF & DOCX</span></div>
        </motion.div>
      </div>
      <div className="hero-signal" aria-hidden="true" />
    </section> : <Workspace job={job} rows={rows} candidates={candidates} queue={queue} uploading={uploading} minScore={minScore} sort={sort} query={query} fileInput={fileInput} onEdit={() => setJdOpen(true)} onFiles={addFiles} onRemove={(index) => setQueue((current) => current.filter((_, i) => i !== index))} onUpload={runUpload} onQuery={setQuery} onSort={setSort} onScore={setMinScore} onSelect={setSelected} onStatus={toggleStatus} />}

    <footer className="border-t border-border py-5"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 text-xs text-muted-foreground lg:px-8"><span>SkillMatch AI · Recruiter decision support</span><Button variant="ghost" size="icon" onClick={() => setDark((value) => !value)} aria-label="Toggle color theme">{dark ? <Sun /> : <Moon />}</Button></div></footer>

    <Dialog open={jdOpen} onOpenChange={setJdOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle className="font-display text-2xl">Paste job description</DialogTitle><DialogDescription>We’ll extract requirements and create a structured scorecard.</DialogDescription></DialogHeader><Textarea value={jdText} onChange={(event) => setJdText(event.target.value.slice(0, 5000))} className="min-h-72 resize-y" placeholder="Paste the full role description…" aria-label="Job description"/><div className="flex items-center justify-between text-xs"><span className={jdText.length < 200 ? "text-destructive" : jdText.length < 500 ? "text-warning" : "text-success"}>{jdText.length.toLocaleString()} / 5,000 characters</span>{jdText.length >= 200 && <span className="flex items-center gap-1 text-success"><Check className="size-4"/> Ready to parse</span>}</div><DialogFooter><Button variant="outline" onClick={() => setJdOpen(false)}>Cancel</Button><Button variant="hero" onClick={submitJd} disabled={jdText.trim().length < 200 || parsing}>{parsing ? <LoaderCircle className="animate-spin"/> : <Sparkles/>}{parsing ? "Parsing…" : "Parse & Continue"}</Button></DialogFooter></DialogContent></Dialog>

    <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-[94vw] xl:max-w-6xl">{selectedRow?.candidate && <CandidateDetail candidate={selectedRow.candidate} result={selectedRow.result} onStatus={toggleStatus} onBack={() => setSelected(null)} />}</SheetContent></Sheet>
  </main>;
}

function Workspace(props: { job: Job; rows: Array<{ result: Result; candidate: Candidate }>; candidates: Candidate[]; queue: QueueFile[]; uploading: boolean; minScore: number; sort: string; query: string; fileInput: React.RefObject<HTMLInputElement | null>; onEdit: () => void; onFiles: (files: FileList | File[]) => void; onRemove: (index: number) => void; onUpload: () => void; onQuery: (value: string) => void; onSort: (value: string) => void; onScore: (value: number) => void; onSelect: (id: string) => void; onStatus: (candidate: Candidate, status: "shortlisted" | "rejected") => void }) {
  const { job, rows, candidates, queue } = props;
  const scores = rows.map(({ result }) => result.overall_score); const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
  return <div className="mx-auto max-w-7xl px-5 pb-20 pt-24 lg:px-8">
    <section className="mb-10"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex flex-wrap gap-2"><Badge>{job.job_level}</Badge><Badge variant="outline">{job.company}</Badge></div><h1 className="font-display text-3xl font-bold sm:text-4xl">{job.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{job.role_summary}</p></div><Button variant="outline" onClick={props.onEdit}>Edit JD</Button></div>
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RequirementCard icon={<Target/>} label="Required Skills" value={`${job.required_skills.length} skills`} skills={job.required_skills} tone="success" />
        <RequirementCard icon={<Sparkles/>} label="Preferred Skills" value={`${job.preferred_skills.length} skills`} skills={job.preferred_skills} tone="info" />
        <RequirementCard icon={<BriefcaseBusiness/>} label="Experience" value={job.min_experience_years == null ? "Not specified" : `${job.min_experience_years}${job.max_experience_years ? `–${job.max_experience_years}` : "+"} years`} tone="accent" />
        <RequirementCard icon={<GraduationCap/>} label="Education" value={job.education_requirement ?? "Not specified"} tone="primary" />
      </div>
    </section>

    <section className="border-y border-border py-9"><div className="grid gap-7 lg:grid-cols-[1fr_1.15fr]"><div><div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-semibold">Add resumes</h2><p className="mt-1 text-sm text-muted-foreground">PDF/DOCX · 5 MB each · 20 files maximum</p></div><span className="text-sm text-muted-foreground">{queue.length}/20</span></div><div className="dropzone mt-5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); props.onFiles(event.dataTransfer.files); }} onClick={() => props.fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && props.fileInput.current?.click()}><CloudUpload className="size-8 text-accent"/><strong>Drag & drop resumes</strong><span>or click to select files</span><input ref={props.fileInput} hidden type="file" multiple accept=".pdf,.docx" onChange={(event) => event.target.files && props.onFiles(event.target.files)} /></div></div>
      <div className="min-h-44"><div className="flex items-center justify-between"><h3 className="font-display font-semibold">Processing queue</h3>{queue.length > 0 && <Button variant="hero" onClick={props.onUpload} disabled={props.uploading}>{props.uploading ? <LoaderCircle className="animate-spin"/> : <Sparkles/>}{props.uploading ? "Analyzing…" : "Analyze resumes"}</Button>}</div>{queue.length === 0 ? <div className="mt-5 flex h-32 items-center justify-center border border-dashed border-border text-sm text-muted-foreground">Selected files will appear here</div> : <div className="mt-4 space-y-2">{queue.map((item,index)=><div key={`${item.file.name}-${index}`} className="flex items-center gap-3 border-b border-border py-2"><StatusIcon status={item.status}/><span className="min-w-0 flex-1 truncate text-sm">{item.file.name}</span><span className="text-xs text-muted-foreground">{(item.file.size/1024/1024).toFixed(1)} MB</span>{item.status === "ready" && <Button variant="ghost" size="icon" onClick={()=>props.onRemove(index)} aria-label={`Remove ${item.file.name}`}><X/></Button>}</div>)}</div>}</div></div></section>

    <section className="pt-10"><div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm text-accent">Ranked candidates</p><h2 className="font-display mt-1 text-3xl font-bold">Screening dashboard</h2></div><div className="grid grid-cols-3 divide-x divide-border border border-border"><Stat label="Total" value={String(rows.length)}/><Stat label="Avg score" value={String(avg)}/><Stat label="Top" value={String(scores.length ? Math.round(Math.max(...scores)) : 0)}/></div></div>
      <div className="mt-7 grid gap-4 border-y border-border py-4 md:grid-cols-[1fr_220px_220px]"><label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input value={props.query} onChange={(e)=>props.onQuery(e.target.value)} placeholder="Search candidates" className="pl-9"/></label><Select value={props.sort} onValueChange={props.onSort}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="score">Score (High→Low)</SelectItem><SelectItem value="name">Name (A→Z)</SelectItem><SelectItem value="date">Date (Newest)</SelectItem></SelectContent></Select><div className="flex items-center gap-3"><Slider min={0} max={100} value={[props.minScore]} onValueChange={(value)=>props.onScore(value[0])}/><span className="w-12 text-right text-xs">≥{props.minScore}</span></div></div>
      {rows.length === 0 ? <div className="py-20 text-center"><UserRound className="mx-auto size-10 text-muted-foreground"/><h3 className="mt-4 font-display text-lg font-semibold">No ranked candidates yet</h3><p className="mt-2 text-sm text-muted-foreground">Upload resumes above to build your shortlist.</p></div> : <><div className="hidden overflow-hidden border-b border-border md:block"><table className="w-full text-left"><thead className="text-xs uppercase text-muted-foreground"><tr className="border-b border-border"><th className="px-3 py-4">Rank</th><th className="px-3 py-4">Candidate</th><th className="px-3 py-4">Score</th><th className="px-3 py-4">Matched skills</th><th className="px-3 py-4">Missing</th><th className="px-3 py-4 text-right">Actions</th></tr></thead><tbody>{rows.map(({candidate,result},index)=><CandidateRow key={candidate.id} candidate={candidate} result={result} index={index} onSelect={props.onSelect} onStatus={props.onStatus}/>)}</tbody></table></div><div className="grid gap-3 py-5 md:hidden">{rows.map(({candidate,result})=><CandidateCard key={candidate.id} candidate={candidate} result={result} onSelect={props.onSelect} onStatus={props.onStatus}/>)}</div></>}
    </section>
  </div>;
}

function RequirementCard({icon,label,value,skills,tone}:{icon:React.ReactNode;label:string;value:string;skills?:string[];tone:string}) { return <motion.article initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`requirement-card tone-${tone}`}><div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">{icon}{label}</div><strong className="mt-4 block text-lg">{value}</strong>{skills && <div className="mt-3 flex max-h-16 flex-wrap gap-1 overflow-hidden">{skills.slice(0,5).map(s=><span key={s} className="skill-pill">{s}</span>)}</div>}</motion.article> }
function Stat({label,value}:{label:string;value:string}) { return <div className="min-w-24 px-5 py-3 text-center"><strong className="font-display block text-xl">{value}</strong><span className="text-xs text-muted-foreground">{label}</span></div> }
function StatusIcon({status}:{status:QueueFile["status"]}) { if(status==="done") return <CheckCircle2 className="size-4 text-success"/>; if(status==="failed") return <CircleAlert className="size-4 text-destructive"/>; if(status==="uploading"||status==="analyzing") return <LoaderCircle className="size-4 animate-spin text-accent"/>; return <FileText className="size-4 text-muted-foreground"/> }
function scoreTone(score:number) { return score>=75?"success":score>=50?"warning":"destructive" }
function ScoreRing({score,label,large=false}:{score:number;label:string;large?:boolean}) { const tone=scoreTone(score); return <div className={`score-ring ${large?"score-ring-large":""}`} style={{"--score":`${score*3.6}deg`} as React.CSSProperties}><div><strong className={`text-${tone}`}>{Math.round(score)}</strong><span>{label}</span></div></div> }
function CandidateRow({candidate,result,index,onSelect,onStatus}:{candidate:Candidate;result:Result;index:number;onSelect:(id:string)=>void;onStatus:(c:Candidate,s:"shortlisted"|"rejected")=>void}) { return <motion.tr initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:index*.04}} className="border-b border-border/70"><td className="px-3 py-5 font-display text-lg">#{result.rank}</td><td className="px-3 py-5"><strong className="block">{candidate.full_name}</strong><span className="text-xs text-muted-foreground">{candidate.current_job_title ?? candidate.file_name}</span></td><td className="px-3 py-5"><ScoreRing score={result.overall_score} label="match"/></td><td className="max-w-56 px-3 py-5"><Pills items={result.matched_skills.slice(0,3)} tone="match"/></td><td className="max-w-48 px-3 py-5"><Pills items={result.missing_skills.slice(0,2)} tone="missing"/></td><td className="px-3 py-5"><div className="flex justify-end gap-2"><Button variant={candidate.status==="shortlisted"?"success":"outline"} size="sm" onClick={()=>onStatus(candidate,"shortlisted")}><ThumbsUp/> Shortlist</Button><Button variant="ghost" size="sm" onClick={()=>onSelect(candidate.id)}>View <ArrowRight/></Button></div></td></motion.tr> }
function CandidateCard({candidate,result,onSelect,onStatus}:{candidate:Candidate;result:Result;onSelect:(id:string)=>void;onStatus:(c:Candidate,s:"shortlisted"|"rejected")=>void}) { return <article className="candidate-card"><div className="flex items-start justify-between"><div><span className="text-xs text-accent">RANK #{result.rank}</span><h3 className="font-display mt-1 text-lg font-bold">{candidate.full_name}</h3></div><ScoreRing score={result.overall_score} label="match"/></div><div className="mt-4"><Pills items={result.matched_skills.slice(0,4)} tone="match"/></div><div className="mt-2"><Pills items={result.missing_skills.slice(0,3)} tone="missing"/></div><div className="mt-5 flex gap-2"><Button variant={candidate.status==="shortlisted"?"success":"outline"} size="sm" onClick={()=>onStatus(candidate,"shortlisted")}><ThumbsUp/> Shortlist</Button><Button variant="ghost" size="sm" onClick={()=>onSelect(candidate.id)}>View details <ArrowRight/></Button></div></article> }
function Pills({items,tone}:{items:string[];tone:"match"|"missing"|"bonus"}) { return <div className="flex flex-wrap gap-1.5">{items.map(item=><span key={item} className={`pill pill-${tone}`}>{item}</span>)}</div> }

function CandidateDetail({candidate,result,onStatus,onBack}:{candidate:Candidate;result:Result;onStatus:(c:Candidate,s:"shortlisted"|"rejected")=>void;onBack:()=>void}) {
  const education = Array.isArray(candidate.parsed_education) ? candidate.parsed_education as Array<Record<string,Json|undefined>> : [];
  const experience = Array.isArray(candidate.parsed_experience) ? candidate.parsed_experience as Array<Record<string,Json|undefined>> : [];
  return <div className="pb-24"><SheetHeader><div className="flex items-center gap-3"><Badge>#{result.rank}</Badge><SheetTitle className="font-display text-2xl">{candidate.full_name}</SheetTitle></div><SheetDescription>{candidate.current_job_title ?? "Candidate"}{candidate.current_company ? ` at ${candidate.current_company}` : ""}</SheetDescription></SheetHeader><div className="mt-7 grid gap-8 xl:grid-cols-[.9fr_1fr_1fr]">
    <section><h3 className="detail-heading"><UserRound/> Resume profile</h3><div className="mt-4 space-y-2 text-sm">{candidate.email&&<p className="flex gap-2"><Mail className="size-4 text-muted-foreground"/>{candidate.email}</p>}{candidate.phone&&<p className="flex gap-2"><Phone className="size-4 text-muted-foreground"/>{candidate.phone}</p>}<Badge variant="outline">{candidate.total_experience_years ?? 0} years total</Badge></div><Accordion type="multiple" defaultValue={["skills"]} className="mt-5"><AccordionItem value="skills"><AccordionTrigger>Skills</AccordionTrigger><AccordionContent><Pills items={candidate.parsed_skills} tone="bonus"/></AccordionContent></AccordionItem><AccordionItem value="education"><AccordionTrigger>Education</AccordionTrigger><AccordionContent>{education.map((item,i)=><div key={i} className="mb-3 text-sm"><strong>{String(item.degree??"")}</strong><p className="text-muted-foreground">{String(item.institution??"")} {item.year?`· ${String(item.year)}`:""}</p></div>)}</AccordionContent></AccordionItem><AccordionItem value="experience"><AccordionTrigger>Experience</AccordionTrigger><AccordionContent>{experience.map((item,i)=><div key={i} className="mb-4 border-l-2 border-accent pl-3 text-sm"><strong>{String(item.role??"")}</strong><p className="text-muted-foreground">{String(item.company??"")} · {String(item.duration??"")}</p></div>)}</AccordionContent></AccordionItem></Accordion></section>
    <section><h3 className="detail-heading"><Target/> Skill matching</h3><MatchGroup title="Matched" items={result.matched_skills} tone="match"/><MatchGroup title="Missing" items={result.missing_skills} tone="missing"/><MatchGroup title="Bonus" items={result.bonus_skills} tone="bonus"/></section>
    <section><h3 className="detail-heading"><Award/> Score breakdown</h3><div className="mt-5 flex flex-wrap items-center justify-center gap-5"><ScoreRing score={result.keyword_score} label="Keyword"/><ScoreRing score={result.semantic_score} label="Context"/><ScoreRing score={result.overall_score} label="Overall" large/></div><div className="mt-7 border-t border-border pt-6"><h4 className="font-display font-semibold">AI rationale</h4><p className="mt-3 text-sm leading-6 text-muted-foreground">{result.ai_summary}</p><h5 className="mt-5 text-sm font-semibold text-success">Strengths</h5><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{result.strengths.map(x=><li key={x}>{x}</li>)}</ul><h5 className="mt-5 text-sm font-semibold text-warning">Concerns</h5><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{result.concerns.map(x=><li key={x}>{x}</li>)}</ul></div></section>
  </div><div className="fixed bottom-0 right-0 z-10 flex w-full flex-wrap justify-end gap-2 border-t border-border bg-background/95 p-4 backdrop-blur-xl sm:w-[94vw] xl:w-[72rem]"><Button variant="ghost" onClick={onBack}><ChevronLeft/> Back to dashboard</Button><Button variant={candidate.status==="rejected"?"destructive":"outline"} onClick={()=>onStatus(candidate,"rejected")}><ThumbsDown/> Reject</Button><Button variant={candidate.status==="shortlisted"?"success":"hero"} onClick={()=>onStatus(candidate,"shortlisted")}><ThumbsUp/> Shortlist</Button></div></div>;
}
function MatchGroup({title,items,tone}:{title:string;items:string[];tone:"match"|"missing"|"bonus"}) { return <div className="mt-6"><div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-semibold">{title}</h4><span className="text-xs text-muted-foreground">{items.length}</span></div><Pills items={items} tone={tone}/></div> }
