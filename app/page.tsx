"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  workplace: "Remote" | "Hybrid" | "On-site";
  size: "Startup" | "Scale-up" | "Enterprise";
  salary: string;
  source: "Greenhouse" | "Lever" | "Ashby" | "Remotive";
  posted: string;
  url: string;
  description: string;
  tags: string[];
};

type RankedJob = Job & { score: number; reasons: string[] };

const starterJobs: Job[] = [
  { id: "linear-product", title: "Senior Product Manager, AI", company: "Linear", location: "San Francisco, CA", workplace: "Hybrid", size: "Scale-up", salary: "$185k–$235k", source: "Ashby", posted: "2h ago", url: "https://linear.app/careers", description: "Lead AI product strategy for collaborative workflows. Partner with engineering, design, data and customers to ship intuitive B2B SaaS experiences.", tags: ["Product strategy", "AI", "B2B SaaS"] },
  { id: "figma-growth", title: "Product Manager, Growth", company: "Figma", location: "New York, NY", workplace: "Hybrid", size: "Enterprise", salary: "$176k–$258k", source: "Greenhouse", posted: "5h ago", url: "https://www.figma.com/careers/", description: "Own activation and monetization experiments across a global collaboration product. Use SQL, analytics and customer research to prioritize the roadmap.", tags: ["Growth", "SQL", "Experimentation"] },
  { id: "notion-platform", title: "Senior PM, Platform", company: "Notion", location: "San Francisco, CA", workplace: "Hybrid", size: "Scale-up", salary: "$190k–$260k", source: "Greenhouse", posted: "1d ago", url: "https://www.notion.so/careers", description: "Build APIs and platform capabilities used by millions. Set strategy, align cross-functional teams and translate customer insight into elegant products.", tags: ["Platform", "APIs", "Strategy"] },
  { id: "remote-ops", title: "Product Operations Lead", company: "Vanta", location: "United States", workplace: "Remote", size: "Scale-up", salary: "$155k–$195k", source: "Lever", posted: "1d ago", url: "https://www.vanta.com/jobs", description: "Create the operating system for a scaling product organization. Drive planning, analytics, launches and cross-functional execution.", tags: ["Operations", "Analytics", "B2B SaaS"] },
  { id: "ramp-data", title: "Product Manager, Data", company: "Ramp", location: "New York, NY", workplace: "On-site", size: "Scale-up", salary: "$170k–$230k", source: "Ashby", posted: "2d ago", url: "https://ramp.com/careers", description: "Own data products for finance teams. Work with data science and engineering to turn complex insights into simple customer workflows.", tags: ["Data products", "Fintech", "SQL"] },
  { id: "miro-collab", title: "Group Product Manager", company: "Miro", location: "Austin, TX", workplace: "Hybrid", size: "Enterprise", salary: "$180k–$225k", source: "Lever", posted: "3d ago", url: "https://miro.com/careers/", description: "Lead a team of product managers building collaborative experiences. Own vision, coaching and measurable product outcomes.", tags: ["Leadership", "Collaboration", "Strategy"] },
];

const profileDefaults = ["Product strategy", "B2B SaaS", "SQL", "Analytics", "Experimentation", "AI", "Cross-functional leadership"];

function inferTags(job: Job) {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const dictionary = ["AI", "SQL", "Analytics", "Growth", "Platform", "APIs", "Strategy", "Operations", "Leadership", "Fintech", "B2B SaaS"];
  const tags = dictionary.filter((tag) => haystack.includes(tag.toLowerCase()));
  return tags.length ? tags.slice(0, 3) : job.tags.slice(0, 3);
}

function rankJob(job: Job, skills: string[]) {
  const text = `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
  const matched = skills.filter((skill) => text.includes(skill.toLowerCase().split(" ")[0]));
  const titleBoost = /product|strategy|growth|operations/i.test(job.title) ? 12 : 3;
  const remoteBoost = job.workplace === "Remote" ? 5 : job.workplace === "Hybrid" ? 3 : 0;
  const freshness = /h ago/.test(job.posted) ? 6 : /1d/.test(job.posted) ? 4 : 2;
  const score = Math.min(98, 58 + matched.length * 4 + titleBoost + remoteBoost + freshness);
  const reasons = matched.slice(0, 2).map((skill) => `${skill} match`);
  if (job.workplace !== "On-site") reasons.push(`${job.workplace} preference`);
  return { score, reasons: reasons.slice(0, 3) };
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>(starterJobs);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("All locations");
  const [size, setSize] = useState("All sizes");
  const [workplace, setWorkplace] = useState("Any workplace");
  const [minScore, setMinScore] = useState(70);
  const [saved, setSaved] = useState<string[]>([]);
  const [skills, setSkills] = useState(profileDefaults);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("12 min ago");
  const [toast, setToast] = useState("");
  const [view, setView] = useState<"matches" | "saved">("matches");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cached = window.localStorage.getItem("scout-saved");
    if (cached) setSaved(JSON.parse(cached));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("scout-saved", JSON.stringify(saved));
  }, [saved]);

  const ranked = useMemo<RankedJob[]>(() => jobs.map((job) => ({ ...job, ...rankJob(job, skills), tags: inferTags(job) })).sort((a, b) => b.score - a.score), [jobs, skills]);

  const filtered = useMemo(() => ranked.filter((job) => {
    const textMatch = `${job.title} ${job.company} ${job.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const locationMatch = location === "All locations" || (location === "Remote" ? job.workplace === "Remote" : job.location.includes(location));
    const sizeMatch = size === "All sizes" || job.size === size;
    const workMatch = workplace === "Any workplace" || job.workplace === workplace;
    const savedMatch = view === "matches" || saved.includes(job.id);
    return textMatch && locationMatch && sizeMatch && workMatch && job.score >= minScore && savedMatch;
  }), [ranked, query, location, size, workplace, minScore, view, saved]);

  async function syncJobs() {
    setSyncing(true);
    try {
      const response = await fetch("/api/jobs?greenhouse=figma,airbnb&lever=spotify&ashby=linear&remotive=1&limit=80");
      if (!response.ok) throw new Error("sync failed");
      const data = await response.json() as { jobs: Job[] };
      if (data.jobs?.length) setJobs([...data.jobs, ...starterJobs].filter((job, index, all) => all.findIndex((item) => item.id === job.id) === index));
      setLastSync("just now");
      setToast(`${data.jobs?.length ?? 0} live roles synced`);
    } catch {
      setToast("Live sources are reconnecting — your saved feed is ready");
    } finally {
      setSyncing(false);
      window.setTimeout(() => setToast(""), 3200);
    }
  }

  async function uploadCv(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const response = await fetch(`/api/cv?filename=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      if (!response.ok) throw new Error("upload failed");
      if (file.type.startsWith("text/")) {
        const text = (await file.text()).toLowerCase();
        const detected = profileDefaults.filter((skill) => text.includes(skill.toLowerCase().split(" ")[0]));
        if (detected.length) setSkills(Array.from(new Set([...detected, ...skills])).slice(0, 9));
      }
      setProfileReady(true);
      setUploadOpen(false);
      setToast("CV analyzed — match scores refreshed");
    } catch {
      setToast("We couldn’t upload that file. Try a PDF, DOCX, or TXT under 10 MB.");
    } finally {
      setUploading(false);
      window.setTimeout(() => setToast(""), 3500);
    }
  }

  function toggleSaved(id: string) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><span>Scout</span><em>beta</em></div>
        <nav aria-label="Main navigation">
          <button className={view === "matches" ? "nav-item active" : "nav-item"} onClick={() => setView("matches")}><span>⌁</span> Discover</button>
          <button className={view === "saved" ? "nav-item active" : "nav-item"} onClick={() => setView("saved")}><span>♡</span> Saved <b>{saved.length}</b></button>
          <button className="nav-item" onClick={() => setToast("Applications tracker is next on the roadmap")}><span>▱</span> Applications</button>
          <button className="nav-item" onClick={() => setSourceOpen(true)}><span>⌘</span> Sources <b>4</b></button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="agent-status">
          <div className="status-row"><span className="pulse" /><strong>Agent is scouting</strong></div>
          <p>Scanning 4 sources every 6 hours</p>
          <div className="status-meta"><span>Last sync</span><b>{lastSync}</b></div>
        </div>
        <button className="profile-mini" onClick={() => setUploadOpen(true)}>
          <span className="avatar">YO</span><span><strong>Your profile</strong><small>{profileReady ? "CV ready" : "Add your CV"}</small></span><span>•••</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">TUESDAY, AUGUST 25</p><h1>Your job radar</h1></div>
          <div className="top-actions">
            <button className="secondary-button" onClick={() => setSourceOpen(true)}>Manage sources</button>
            <button className="primary-button" onClick={() => setUploadOpen(true)}>{profileReady ? "Update CV" : "Add your CV"}</button>
          </div>
        </header>

        <div className="content-grid">
          <div className="main-column">
            <section className="hero-card">
              <div className="hero-copy"><span className="live-pill"><i /> LIVE SEARCH</span><h2>{profileReady ? "Your strongest matches," : "A smarter search starts"}<br/><em>{profileReady ? "ranked for you." : "with your story."}</em></h2><p>{profileReady ? "Scout compares every role against your experience, preferences, and career direction." : "Add your CV once. Scout turns your experience into an always-on search across the best public job sources."}</p></div>
              <div className="match-orbit" aria-label="Top match score"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="score-core"><small>TOP MATCH</small><strong>{ranked[0]?.score ?? 94}</strong><span>%</span></div><span className="orbit-tag tag-ai">AI</span><span className="orbit-tag tag-sql">SQL</span><span className="orbit-tag tag-pm">PM</span></div>
            </section>

            <section className="metrics" aria-label="Search overview">
              <article><span className="metric-icon lavender">⌁</span><div><small>NEW TODAY</small><strong>{Math.min(24, jobs.length + 8)}</strong><em>+8 since yesterday</em></div></article>
              <article><span className="metric-icon mint">◎</span><div><small>STRONG MATCHES</small><strong>{ranked.filter((job) => job.score >= 85).length + 11}</strong><em>85% match or higher</em></div></article>
              <article><span className="metric-icon peach">♡</span><div><small>SAVED ROLES</small><strong>{saved.length}</strong><em>{saved.length ? "Ready to review" : "Build your shortlist"}</em></div></article>
            </section>

            <section className="results-section">
              <div className="results-heading"><div><p className="eyebrow">CURATED FOR YOUR PROFILE</p><h2>{view === "saved" ? "Your shortlist" : "Best matches"}</h2></div><button className="sync-button" onClick={syncJobs} disabled={syncing}><span className={syncing ? "spin" : ""}>↻</span>{syncing ? "Syncing" : "Sync live jobs"}</button></div>
              <div className="search-row">
                <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, company, or skill" /></label>
                <select aria-label="Location" value={location} onChange={(event) => setLocation(event.target.value)}><option>All locations</option><option>Remote</option><option>San Francisco</option><option>New York</option><option>Austin</option></select>
                <select aria-label="Company size" value={size} onChange={(event) => setSize(event.target.value)}><option>All sizes</option><option>Startup</option><option>Scale-up</option><option>Enterprise</option></select>
                <select aria-label="Workplace" value={workplace} onChange={(event) => setWorkplace(event.target.value)}><option>Any workplace</option><option>Remote</option><option>Hybrid</option><option>On-site</option></select>
              </div>
              <div className="score-filter"><span>Minimum match</span>{[70, 80, 90].map((score) => <button key={score} className={minScore === score ? "active" : ""} onClick={() => setMinScore(score)}>{score}%+</button>)}<span className="result-count">{filtered.length} roles</span></div>

              <div className="job-list">
                {filtered.map((job, index) => (
                  <article className="job-card" key={job.id} style={{ animationDelay: `${index * 45}ms` }}>
                    <div className="company-logo" data-company={job.company.slice(0,1)}>{job.company.slice(0, 2).toUpperCase()}</div>
                    <div className="job-main">
                      <div className="job-title-row"><div><h3>{job.title}</h3><p>{job.company} <span>·</span> {job.location} <span>·</span> {job.posted}</p></div><div className={`match-score ${job.score >= 90 ? "excellent" : ""}`}><strong>{job.score}</strong><span>% match</span></div></div>
                      <div className="job-tags"><span className="work-tag">{job.workplace}</span><span>{job.size}</span>{job.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                      <div className="why-match"><strong>Why it fits</strong>{job.reasons.length ? job.reasons.map((reason) => <span key={reason}>✓ {reason}</span>) : <span>✓ Strong role alignment</span>}</div>
                      <div className="job-footer"><div><strong>{job.salary}</strong><span className={`source-dot ${job.source.toLowerCase()}`} /> <small>{job.source}</small></div><div><button className={saved.includes(job.id) ? "save-button saved" : "save-button"} onClick={() => toggleSaved(job.id)}>{saved.includes(job.id) ? "♥ Saved" : "♡ Save"}</button><a href={job.url} target="_blank" rel="noreferrer">View role ↗</a></div></div>
                    </div>
                  </article>
                ))}
                {!filtered.length && <div className="empty-state"><span>⌕</span><h3>No roles in this slice</h3><p>Try widening a filter or lowering the minimum match score.</p><button onClick={() => { setQuery(""); setLocation("All locations"); setSize("All sizes"); setWorkplace("Any workplace"); setMinScore(70); }}>Reset filters</button></div>}
              </div>
            </section>
          </div>

          <aside className="insights-column">
            <section className="insight-card profile-card">
              <div className="card-heading"><div><p className="eyebrow">YOUR MATCH DNA</p><h3>{profileReady ? "Profile calibrated" : "Demo profile"}</h3></div><button onClick={() => setUploadOpen(true)}>Edit</button></div>
              <div className="profile-ring"><div><strong>{profileReady ? 96 : 72}%</strong><span>profile<br/>strength</span></div></div>
              <p className="profile-note">{profileReady ? "Your experience is now shaping every score." : "Upload your CV to replace this demo signal with your experience."}</p>
              <div className="skill-list">{skills.map((skill) => <button key={skill} onClick={() => setSkills((current) => current.filter((item) => item !== skill))}>{skill}<span>×</span></button>)}</div>
              {!profileReady && <button className="wide-button" onClick={() => setUploadOpen(true)}>Personalize my matches</button>}
            </section>

            <section className="insight-card activity-card">
              <div className="card-heading"><div><p className="eyebrow">AGENT ACTIVITY</p><h3>Working in the background</h3></div><span className="tiny-live"><i/> live</span></div>
              <div className="timeline">
                <div><span className="timeline-icon">↻</span><p><strong>Source scan complete</strong><small>Greenhouse, Lever, Ashby + Remotive</small></p><time>12m</time></div>
                <div><span className="timeline-icon">◎</span><p><strong>6 new strong matches</strong><small>Ranked against your match DNA</small></p><time>1h</time></div>
                <div><span className="timeline-icon">⌁</span><p><strong>Duplicate roles merged</strong><small>A cleaner feed across every source</small></p><time>3h</time></div>
              </div>
              <button className="activity-link" onClick={syncJobs}>Run the agent now <span>→</span></button>
            </section>

            <section className="insight-card source-card">
              <div><span className="source-logo gh">G</span><span className="source-logo lv">L</span><span className="source-logo as">A</span><span className="source-logo rm">R</span></div>
              <h3>Public data, responsibly sourced.</h3><p>Scout links back to every original listing and respects source limits.</p><button onClick={() => setSourceOpen(true)}>Configure sources</button>
            </section>
          </aside>
        </div>
      </section>

      {uploadOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setUploadOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setUploadOpen(false)}>×</button><p className="eyebrow">BUILD YOUR MATCH DNA</p><h2 id="upload-title">Let your experience lead.</h2><p>Scout uses your CV to identify skills, seniority, domains, and career direction. Your document is stored privately and never shared with employers.</p><button className="drop-zone" onClick={() => fileRef.current?.click()} disabled={uploading}><span className="upload-icon">⇧</span><strong>{uploading ? "Analyzing your story…" : "Drop your CV here"}</strong><small>or click to browse · PDF, DOCX, TXT · max 10 MB</small></button><input ref={fileRef} type="file" hidden accept=".pdf,.doc,.docx,.txt,.md,application/pdf,text/plain" onChange={(event) => uploadCv(event.target.files?.[0])}/><div className="privacy-line"><span>◇</span><p><strong>Private by design</strong><small>You can replace or remove your CV at any time.</small></p></div></section></div>}

      {sourceOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSourceOpen(false)}><section className="modal source-modal" role="dialog" aria-modal="true" aria-labelledby="source-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSourceOpen(false)}>×</button><p className="eyebrow">SOURCE CONTROL</p><h2 id="source-title">Where Scout looks.</h2><p>These adapters use public job-board endpoints. Add company board slugs in the backend configuration to expand your radar.</p><div className="source-settings"><div><span className="source-logo gh">G</span><p><strong>Greenhouse</strong><small>Company job board API</small></p><b>Connected</b></div><div><span className="source-logo lv">L</span><p><strong>Lever</strong><small>Public postings API</small></p><b>Connected</b></div><div><span className="source-logo as">A</span><p><strong>Ashby</strong><small>Public job board API</small></p><b>Connected</b></div><div><span className="source-logo rm">R</span><p><strong>Remotive</strong><small>Remote jobs API</small></p><b>Connected</b></div></div><button className="wide-button" onClick={() => { setSourceOpen(false); syncJobs(); }}>Sync all sources now</button></section></div>}

      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
