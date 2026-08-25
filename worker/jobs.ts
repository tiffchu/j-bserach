type NormalizedJob = {
  id: string; title: string; company: string; location: string; workplace: "Remote" | "Hybrid" | "On-site";
  size: "Startup" | "Scale-up" | "Enterprise"; salary: string; source: "Greenhouse" | "Lever" | "Ashby" | "Remotive";
  posted: string; url: string; description: string; tags: string[];
};

const responseHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=900" };
const clean = (value = "") => value.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
const shortAge = (value?: string) => {
  if (!value) return "recently";
  const hours = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};
const companySize = (name: string): NormalizedJob["size"] => {
  const score = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  return (["Startup", "Scale-up", "Enterprise"] as const)[score];
};
const workplace = (location: string): NormalizedJob["workplace"] => /remote|worldwide|anywhere/i.test(location) ? "Remote" : /hybrid/i.test(location) ? "Hybrid" : "On-site";
const keywords = (text: string) => ["AI", "SQL", "Analytics", "Growth", "Platform", "APIs", "Strategy", "Operations", "Leadership", "Fintech", "B2B SaaS"].filter((tag) => text.toLowerCase().includes(tag.toLowerCase())).slice(0, 3);

async function getJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  try {
    const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "ScoutJobRadar/1.0" }, signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status}`);
    return await response.json() as any;
  } finally { clearTimeout(timer); }
}

async function greenhouse(slug: string): Promise<NormalizedJob[]> {
  const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`);
  return (data.jobs || []).map((job: any) => {
    const description = clean(job.content || ""); const location = job.location?.name || "Location flexible";
    return { id: `gh-${slug}-${job.id}`, title: job.title, company: slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), location, workplace: workplace(location), size: companySize(slug), salary: "Compensation listed in role", source: "Greenhouse", posted: shortAge(job.updated_at), url: job.absolute_url, description, tags: keywords(`${job.title} ${description}`) };
  });
}

async function lever(slug: string): Promise<NormalizedJob[]> {
  const data = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json&limit=100`);
  return (Array.isArray(data) ? data : []).map((job: any) => {
    const location = job.categories?.location || "Location flexible"; const description = clean(`${job.descriptionPlain || ""} ${job.additionalPlain || ""}`);
    return { id: `lv-${slug}-${job.id}`, title: job.text, company: slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), location, workplace: workplace(location), size: companySize(slug), salary: job.salaryRange ? `${job.salaryRange.currency || "$"}${job.salaryRange.min}–${job.salaryRange.max}` : "Compensation listed in role", source: "Lever", posted: "recently", url: job.hostedUrl || job.applyUrl, description, tags: keywords(`${job.text} ${description}`) };
  });
}

async function ashby(slug: string): Promise<NormalizedJob[]> {
  const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`);
  return (data.jobs || []).map((job: any) => {
    const location = job.location || "Location flexible"; const description = clean(job.descriptionHtml || job.descriptionPlain || "");
    return { id: `as-${slug}-${job.id || job.jobUrl}`, title: job.title, company: slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), location, workplace: job.isRemote ? "Remote" : workplace(location), size: companySize(slug), salary: job.compensation?.compensationTierSummary || "Compensation listed in role", source: "Ashby", posted: shortAge(job.publishedAt), url: job.jobUrl || job.applyUrl, description, tags: keywords(`${job.title} ${description}`) };
  });
}

async function remotive(): Promise<NormalizedJob[]> {
  const data = await getJson("https://remotive.com/api/remote-jobs?limit=50");
  return (data.jobs || []).map((job: any) => {
    const description = clean(job.description || ""); const location = job.candidate_required_location || "Worldwide";
    return { id: `rm-${job.id}`, title: job.title, company: job.company_name, location, workplace: "Remote", size: companySize(job.company_name), salary: job.salary || "Compensation listed in role", source: "Remotive", posted: shortAge(job.publication_date), url: job.url, description, tags: keywords(`${job.title} ${description}`) };
  });
}

const slugs = (value: string | null) => (value || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8);

export async function handleJobs(request: Request) {
  const params = new URL(request.url).searchParams;
  const tasks: Promise<NormalizedJob[]>[] = [
    ...slugs(params.get("greenhouse")).map(greenhouse),
    ...slugs(params.get("lever")).map(lever),
    ...slugs(params.get("ashby")).map(ashby),
  ];
  if (params.get("remotive") === "1") tasks.push(remotive());
  const settled = await Promise.allSettled(tasks);
  const jobs = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const unique = jobs.filter((job, index, all) => all.findIndex((item) => `${item.title}-${item.company}-${item.location}`.toLowerCase() === `${job.title}-${job.company}-${job.location}`.toLowerCase()) === index);
  const limit = Math.min(200, Math.max(1, Number(params.get("limit")) || 100));
  return new Response(JSON.stringify({ jobs: unique.slice(0, limit), sourcesRequested: tasks.length, sourcesAvailable: settled.filter((item) => item.status === "fulfilled").length, fetchedAt: new Date().toISOString() }), { headers: responseHeaders });
}
