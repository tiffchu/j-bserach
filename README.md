# Scout — Your AI job radar

Scout is a private job-search dashboard that collects roles from public job-board APIs, filters them around your preferences, and ranks them against a profile derived from your CV.

The current release is an MVP: it demonstrates the complete search, filtering, ranking, saving, and CV-upload workflow without requiring an AI API key.

## Product demo

<video src="assets/demo.mp4" controls width="100%">
  Your browser does not support embedded video. Open the demo using the link below.
</video>

[Watch or download the Scout demo](assets/demo.mp4)

## What Scout can do

- Search jobs by title, company, or skill.
- Filter by location, workplace type, company-size category, and minimum match score.
- Rank each role and explain the strongest matching signals.
- Save jobs to a browser-local shortlist.
- Upload a CV to private Cloudflare R2 object storage.
- Pull and normalize jobs from Greenhouse, Lever, Ashby, and Remotive.
- Merge duplicate listings returned by different sources.
- Keep working when a public source is unavailable by retaining a useful starter feed.

## How matching works

Scout's current ranking engine is deterministic and explainable. It compares the job title, description, and tags with the active profile skills, then adds smaller boosts for:

- relevant product-oriented titles;
- remote or hybrid workplace alignment; and
- recently published roles.

The result is capped at 98%, and the interface shows up to three reasons behind each score. The scoring logic lives in `app/page.tsx` and can later be replaced or augmented with embeddings or an LLM-based evaluator.

Company size is not consistently exposed by the supported job-board APIs. The MVP therefore assigns a stable demonstration category from the company name. Production use should replace this with a verified company-data provider.

## Supported job sources

Scout uses public, read-only listing endpoints:

| Source | Adapter | Authentication |
| --- | --- | --- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs` | None for published jobs |
| Lever | `api.lever.co/v0/postings/{slug}` | None for published jobs |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{slug}` | None for public boards |
| Remotive | `remotive.com/api/remote-jobs` | None |

Each adapter converts its source-specific response into one common job shape. A failed source is skipped without failing the full sync.

## Short product walkthrough

1. Open Scout. The dashboard initially displays a representative job feed and demo match profile.
2. Select **Add your CV** and upload a PDF, DOCX, TXT, or Markdown file up to 10 MB.
3. Use the search field and filters to narrow roles by location, company size, or workplace type.
4. Select a minimum match threshold such as **80%+** or **90%+**.
5. Review **Why it fits** on each job card to understand its score.
6. Select **Save** to add a role to your local shortlist, or **View role** to open the original listing.
7. Select **Sync live jobs** to query the configured public job sources.
8. Open **Manage sources** to see the currently supported adapters.

Saved jobs remain on the current device using `localStorage`. They are not yet synchronized between browsers.

## CV behavior and privacy

CV files are uploaded through `POST /api/cv` and stored in the private `CV_FILES` R2 bucket using a generated object key. File names are sanitized, and uploads are limited to 10 MB.

For TXT and Markdown files, the browser can currently detect known profile terms and refresh the active skill list. PDF and DOCX files are stored successfully, but full document extraction is not implemented yet. Until a parser or model-backed profile service is added, those formats use the existing demonstration skills for scoring.

The deployed site is owner-only. Before making Scout public or multi-user, add authenticated ownership metadata, per-user object access, retention rules, and a CV deletion endpoint.

## How it was built

Scout uses:

- React 19 and TypeScript for the interactive dashboard;
- Vinext and Vite for the Next.js-style application and Cloudflare Worker build;
- Tailwind CSS as the stylesheet build layer, with the product styling in `app/globals.css`;
- a Cloudflare Worker for job aggregation and CV uploads;
- Cloudflare R2 for CV file storage; and
- OpenAI Sites for private deployment and resource binding.

The main request flow is:

```text
Browser dashboard
  ├── GET /api/jobs ──> source adapters ──> normalized job list ──> client ranking
  ├── POST /api/cv ──> private R2 bucket
  └── Saved roles ──> browser localStorage
```

Important files:

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Dashboard UI, filters, saving, upload flow, and scoring |
| `app/globals.css` | Responsive product design and animation |
| `worker/index.ts` | Worker entry point and CV upload endpoint |
| `worker/jobs.ts` | Greenhouse, Lever, Ashby, and Remotive adapters |
| `.openai/hosting.json` | Sites project plus the logical R2 binding |
| `vite.config.ts` | Vinext, Sites, and local Cloudflare binding setup |
| `public/og.png` | Social sharing card |

Cloudflare D1 and Drizzle are included by the underlying project structure but are not currently used by Scout. D1 is the natural next step for durable user profiles, synced saved jobs, source configuration, and application tracking.

## Run locally

### Prerequisites

- Node.js 22.13 or newer
- pnpm 11 or newer

If pnpm is not installed, a recent Node installation can enable it through Corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### Install and start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

The Vite configuration creates a local version of the declared `CV_FILES` R2 binding, so the upload flow can be exercised without a separate `wrangler.jsonc` file.

### Validate a production build

```bash
pnpm build
```

Optional checks:

```bash
pnpm lint
pnpm test
```

## Query the job API

The job endpoint accepts comma-separated company board slugs and a result limit:

```text
GET /api/jobs?greenhouse=figma,airbnb&lever=spotify&ashby=linear&remotive=1&limit=80
```

Supported parameters:

| Parameter | Example | Meaning |
| --- | --- | --- |
| `greenhouse` | `figma,airbnb` | Greenhouse board slugs |
| `lever` | `spotify` | Lever site slugs |
| `ashby` | `linear` | Ashby board slugs |
| `remotive` | `1` | Include the Remotive feed |
| `limit` | `80` | Maximum normalized results, capped at 200 |

To change the default companies used by the dashboard, update the request in `syncJobs()` inside `app/page.tsx`.

## Current limitations and next steps

- Add full PDF and DOCX text extraction.
- Generate the profile and match rationale from the actual CV rather than a fixed skill dictionary.
- Store profiles, preferences, saved roles, and application status in D1.
- Add editable source slugs to the interface instead of configuring them in code.
- Replace inferred company size with verified company metadata.
- Add scheduled background scans and notifications for new high-scoring roles.
- Add tests for source normalization, scoring, upload validation, and failure handling.

## Responsible source use

Scout links users back to the original listing. Respect each provider's terms, attribution requirements, caching guidance, and rate limits. Prefer an official public API over HTML scraping whenever one is available.
