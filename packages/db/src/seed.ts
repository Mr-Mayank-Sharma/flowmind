import { prisma } from "./index";
import bcrypt from "bcryptjs";

const CATEGORIES = [
  { name: "SEO & Content Marketing", slug: "seo-content-marketing", icon: "Search", description: "SEO optimization and content creation workflows", sortOrder: 1 },
  { name: "Research & Intelligence", slug: "research-intelligence", icon: "Brain", description: "Research and competitive analysis workflows", sortOrder: 2 },
  { name: "Developer Tools", slug: "developer-tools", icon: "Code", description: "Code review, CI/CD, and developer automation", sortOrder: 3 },
  { name: "Data Processing", slug: "data-processing", icon: "Database", description: "Data extraction, transformation, and validation", sortOrder: 4 },
  { name: "Business Operations", slug: "business-operations", icon: "Building2", description: "Business process automation workflows", sortOrder: 5 },
];

interface GraphNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string | null;
}

interface SeedWorkflow {
  category: string;
  title: string;
  description: string;
  tags: string[];
  icon: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const DEMO_WORKFLOWS: SeedWorkflow[] = [
  {
    category: "SEO & Content Marketing",
    title: "SEO Optimization Pipeline",
    description: "Analyzes a webpage URL for SEO issues, generates optimized meta tags, keyword suggestions, and produces a comprehensive SEO audit report.",
    tags: ["seo", "audit", "meta-tags", "keywords"],
    icon: "🔍",
    nodes: [
      {
        id: "trigger",
        type: "manualTrigger",
        label: "Enter URL",
        position: { x: 300, y: 0 },
        config: { summary: "Provide the webpage URL to analyze" },
      },
      {
        id: "fetch",
        type: "httpRequest",
        label: "Fetch Page HTML",
        position: { x: 300, y: 160 },
        config: {
          method: "GET",
          url: "{{trigger.url}}",
          summary: "Download page content for analysis",
        },
      },
      {
        id: "parse",
        type: "codeExecute",
        label: "Extract SEO Elements",
        position: { x: 300, y: 320 },
        config: {
          language: "javascript",
          code: "const html = input.body; const title = html.match(/<title>(.*?)<\\/title>/)?.[1] || ''; const metaDesc = html.match(/<meta name=\"description\" content=\"(.*?)\"/)?.[1] || ''; const h1s = [...html.matchAll(/<h1[^>]*>(.*?)<\\/h1>/g)].map(m => m[1]); const imgAlts = [...html.matchAll(/<img[^>]*alt=\"([^\"]*?)\"/g)].map(m => m[1]); return { title, metaDesc, h1s, imgAlts, bodyLength: html.length };",
          summary: "Parse meta tags, headings, and image alts",
        },
      },
      {
        id: "analyze",
        type: "aiAgent",
        label: "AI SEO Analyzer",
        position: { x: 300, y: 480 },
        config: {
          prompt: "You are an SEO expert. Analyze the extracted page elements and identify issues: missing meta description, duplicate/missing H1, images without alt text, thin content. Provide a severity (critical/warning/info) for each issue.",
          summary: "Identify SEO problems and score the page",
        },
      },
      {
        id: "optimize",
        type: "aiAgent",
        label: "Generate Optimizations",
        position: { x: 300, y: 640 },
        config: {
          prompt: "Based on the SEO analysis, generate: (1) an optimized title tag (max 60 chars), (2) an optimized meta description (max 160 chars), (3) 10 target keywords with search intent, (4) recommended internal link anchor texts. Format as structured JSON.",
          summary: "Produce actionable SEO recommendations",
        },
      },
      {
        id: "report",
        type: "aiAgent",
        label: "Format Report",
        position: { x: 300, y: 800 },
        config: {
          prompt: "Combine the SEO analysis and optimizations into a clean, formatted markdown report with sections: Executive Summary, Issues Found (table), Optimized Meta Tags, Keyword Recommendations, and Action Items. Include an overall SEO score out of 100.",
          summary: "Assemble final SEO audit report",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "fetch", sourceHandle: null, targetHandle: null, label: null },
      { id: "e2", source: "fetch", target: "parse", sourceHandle: null, targetHandle: null, label: null },
      { id: "e3", source: "parse", target: "analyze", sourceHandle: null, targetHandle: null, label: null },
      { id: "e4", source: "analyze", target: "optimize", sourceHandle: null, targetHandle: null, label: null },
      { id: "e5", source: "optimize", target: "report", sourceHandle: null, targetHandle: null, label: null },
    ],
  },
  {
    category: "Business Operations",
    title: "Email Triage Pipeline",
    description: "Fetches unread emails, classifies them by urgency and category using AI, generates summaries, and sends a digest to a notification channel.",
    tags: ["email", "triage", "classification", "notification"],
    icon: "📧",
    nodes: [
      {
        id: "cron",
        type: "cronTrigger",
        label: "Daily 7 AM Check",
        position: { x: 300, y: 0 },
        config: { schedule: "0 7 * * *", summary: "Runs every morning at 7 AM" },
      },
      {
        id: "fetch-emails",
        type: "httpRequest",
        label: "Fetch Unread Emails",
        position: { x: 300, y: 160 },
        config: {
          method: "POST",
          url: "{{env.EMAIL_API_URL}}/unread",
          headers: { Authorization: "Bearer {{env.EMAIL_API_KEY}}" },
          summary: "Retrieve all unread emails from inbox",
        },
      },
      {
        id: "classify",
        type: "classifier",
        label: "Classify Emails",
        position: { x: 300, y: 320 },
        config: {
          categories: ["urgent", "action-required", "newsletter", "notification", "spam"],
          prompt: "Classify each email into one of the categories based on subject, sender, and body preview. Consider urgency indicators, action verbs, and sender reputation.",
          summary: "Categorize emails by type and urgency",
        },
      },
      {
        id: "summarize-urgent",
        type: "summarizer",
        label: "Summarize Urgent Emails",
        position: { x: 150, y: 480 },
        config: {
          prompt: "Create a concise 2-3 sentence summary of each urgent or action-required email. Highlight the key ask, deadline if any, and required response.",
          summary: "Condense urgent messages for quick review",
        },
      },
      {
        id: "summarize-rest",
        type: "summarizer",
        label: "Summarize Other Emails",
        position: { x: 450, y: 480 },
        config: {
          prompt: "Create a one-line summary for each newsletter, notification, or non-urgent email. Just the topic and key takeaway.",
          summary: "Brief summaries of low-priority mail",
        },
      },
      {
        id: "merge",
        type: "merge",
        label: "Merge Summaries",
        position: { x: 300, y: 640 },
        config: { strategy: "concatenate", summary: "Combine urgent and non-urgent summaries" },
      },
      {
        id: "compose",
        type: "aiAgent",
        label: "Compose Digest",
        position: { x: 300, y: 800 },
        config: {
          prompt: "Compose a clean daily email digest. Format: URGENT section (red flag) with actionable summaries, then OTHER section with brief one-liners. End with a count: X urgent, Y other, Z total. Keep it scannable.",
          summary: "Format the final daily digest",
        },
      },
      {
        id: "send",
        type: "sendMessage",
        label: "Send to Slack",
        position: { x: 300, y: 960 },
        config: {
          channel: "{{env.SLACK_CHANNEL}}",
          summary: "Post digest to team Slack channel",
        },
      },
    ],
    edges: [
      { id: "e1", source: "cron", target: "fetch-emails", sourceHandle: null, targetHandle: null, label: null },
      { id: "e2", source: "fetch-emails", target: "classify", sourceHandle: null, targetHandle: null, label: null },
      { id: "e3", source: "classify", target: "summarize-urgent", sourceHandle: null, targetHandle: null, label: "urgent" },
      { id: "e4", source: "classify", target: "summarize-rest", sourceHandle: null, targetHandle: null, label: "other" },
      { id: "e5", source: "summarize-urgent", target: "merge", sourceHandle: null, targetHandle: null, label: null },
      { id: "e6", source: "summarize-rest", target: "merge", sourceHandle: null, targetHandle: null, label: null },
      { id: "e7", source: "merge", target: "compose", sourceHandle: null, targetHandle: null, label: null },
      { id: "e8", source: "compose", target: "send", sourceHandle: null, targetHandle: null, label: null },
    ],
  },
  {
    category: "Developer Tools",
    title: "AI Code Review Pipeline",
    description: "Triggered by a GitHub PR webhook, fetches the diff, analyzes code quality and security, and posts a structured review comment back to the PR.",
    tags: ["code-review", "github", "security", "ci"],
    icon: "🔍",
    nodes: [
      {
        id: "webhook",
        type: "webhookTrigger",
        label: "PR Opened Webhook",
        position: { x: 300, y: 0 },
        config: {
          path: "/webhook/github/pr",
          events: ["pull_request.opened", "pull_request.synchronize"],
          summary: "Listens for GitHub PR events",
        },
      },
      {
        id: "fetch-diff",
        type: "httpRequest",
        label: "Fetch PR Diff",
        position: { x: 300, y: 160 },
        config: {
          method: "GET",
          url: "https://api.github.com/repos/{{trigger.repo}}/pulls/{{trigger.pr_number}}",
          headers: { Accept: "application/vnd.github.v3.diff", Authorization: "Bearer {{env.GITHUB_TOKEN}}" },
          summary: "Retrieve the full diff for the pull request",
        },
      },
      {
        id: "fetch-files",
        type: "httpRequest",
        label: "Fetch Changed Files",
        position: { x: 300, y: 320 },
        config: {
          method: "GET",
          url: "https://api.github.com/repos/{{trigger.repo}}/pulls/{{trigger.pr_number}}/files",
          headers: { Authorization: "Bearer {{env.GITHUB_TOKEN}}" },
          summary: "Get file-level details for the PR",
        },
      },
      {
        id: "analyze-code",
        type: "aiAgent",
        label: "Code Quality Review",
        position: { x: 150, y: 480 },
        config: {
          prompt: "You are a senior code reviewer. Analyze the diff for: code quality issues, potential bugs, performance concerns, naming improvements, and missing error handling. For each finding, specify the file, line range, severity (critical/warning/suggestion), and a concrete fix suggestion.",
          summary: "Review code quality and correctness",
        },
      },
      {
        id: "analyze-security",
        type: "aiAgent",
        label: "Security Review",
        position: { x: 450, y: 480 },
        config: {
          prompt: "You are a security engineer. Analyze the diff for: SQL injection, XSS, CSRF, insecure dependencies, hardcoded secrets, improper auth checks, path traversal, and SSRF. For each finding, provide severity (critical/high/medium/low), CWE ID, and remediation steps.",
          summary: "Scan for security vulnerabilities",
        },
      },
      {
        id: "merge-reviews",
        type: "merge",
        label: "Merge Findings",
        position: { x: 300, y: 640 },
        config: { strategy: "merge", summary: "Combine quality and security findings" },
      },
      {
        id: "format",
        type: "aiAgent",
        label: "Format PR Comment",
        position: { x: 300, y: 800 },
        config: {
          prompt: "Format the combined review findings into a GitHub PR comment. Use markdown with: a summary line, then tables for each severity level, file-by-file breakdown, and an overall verdict (APPROVE / REQUEST_CHANGES / COMMENT). Keep it constructive and specific.",
          summary: "Generate the final PR review comment",
        },
      },
      {
        id: "post-comment",
        type: "httpRequest",
        label: "Post Review Comment",
        position: { x: 300, y: 960 },
        config: {
          method: "POST",
          url: "https://api.github.com/repos/{{trigger.repo}}/issues/{{trigger.pr_number}}/comments",
          headers: { Authorization: "Bearer {{env.GITHUB_TOKEN}}", "Content-Type": "application/json" },
          body: '{"body": "{{format.output}}"}',
          summary: "Post the review as a GitHub PR comment",
        },
      },
    ],
    edges: [
      { id: "e1", source: "webhook", target: "fetch-diff", sourceHandle: null, targetHandle: null, label: null },
      { id: "e2", source: "fetch-diff", target: "fetch-files", sourceHandle: null, targetHandle: null, label: null },
      { id: "e3", source: "fetch-files", target: "analyze-code", sourceHandle: null, targetHandle: null, label: null },
      { id: "e4", source: "fetch-files", target: "analyze-security", sourceHandle: null, targetHandle: null, label: null },
      { id: "e5", source: "analyze-code", target: "merge-reviews", sourceHandle: null, targetHandle: null, label: null },
      { id: "e6", source: "analyze-security", target: "merge-reviews", sourceHandle: null, targetHandle: null, label: null },
      { id: "e7", source: "merge-reviews", target: "format", sourceHandle: null, targetHandle: null, label: null },
      { id: "e8", source: "format", target: "post-comment", sourceHandle: null, targetHandle: null, label: null },
    ],
  },
  {
    category: "SEO & Content Marketing",
    title: "Content Generation Pipeline",
    description: "Takes a topic and keywords, researches the subject via web search, generates a full SEO-optimized article, and outputs publish-ready markdown.",
    tags: ["content", "writing", "seo", "research"],
    icon: "✍️",
    nodes: [
      {
        id: "trigger",
        type: "manualTrigger",
        label: "Enter Topic & Keywords",
        position: { x: 300, y: 0 },
        config: {
          summary: "Provide topic, target keywords, and desired tone",
          schema: {
            topic: { type: "string", required: true },
            keywords: { type: "string", required: true },
            tone: { type: "string", default: "professional" },
          },
        },
      },
      {
        id: "research",
        type: "webResearcher",
        label: "Research Topic",
        position: { x: 300, y: 160 },
        config: {
          prompt: "Research the topic thoroughly. Find: (1) top 5 ranking pages and their key points, (2) common questions people ask, (3) statistics and data points, (4) expert quotes if available, (5) related subtopics to cover. Be comprehensive.",
          summary: "Gather research data and sources",
        },
      },
      {
        id: "outline",
        type: "aiAgent",
        label: "Generate Outline",
        position: { x: 300, y: 320 },
        config: {
          prompt: "Based on the research, create a detailed article outline. Include: a compelling title, H1, 4-6 H2 sections with H3 subsections, key points to cover in each section, suggested word count per section, and internal linking opportunities. Target 2000+ words total.",
          summary: "Create article structure from research",
        },
      },
      {
        id: "write",
        type: "contentWriter",
        label: "Write Full Article",
        position: { x: 300, y: 480 },
        config: {
          prompt: "Write the complete article following the outline. Use the research data, statistics, and expert insights gathered. Include: an engaging introduction with hook, well-structured body paragraphs, practical examples, and a strong conclusion with CTA. Use the specified tone throughout.",
          tone: "{{trigger.tone}}",
          summary: "Produce the full article content",
        },
      },
      {
        id: "seo-optimize",
        type: "aiAgent",
        label: "SEO Optimize",
        position: { x: 300, y: 640 },
        config: {
          prompt: "Optimize the article for SEO: (1) ensure primary keyword appears in title, first paragraph, and 2-3 H2s, (2) add LSI keywords naturally, (3) optimize meta description to 155 chars, (4) suggest image alt texts for any mentioned visuals, (5) add FAQ schema-ready questions at the end. Provide the optimized version.",
          summary: "Apply SEO best practices to content",
        },
      },
      {
        id: "format",
        type: "aiAgent",
        label: "Final Formatting",
        position: { x: 300, y: 800 },
        config: {
          prompt: "Format the final article as clean markdown ready for publishing. Include: frontmatter (title, description, tags, date), proper heading hierarchy, code blocks where relevant, bullet points and numbered lists for scannability, and a table of contents. Add a meta description block at the top.",
          summary: "Produce publish-ready markdown",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "research", sourceHandle: null, targetHandle: null, label: null },
      { id: "e2", source: "research", target: "outline", sourceHandle: null, targetHandle: null, label: null },
      { id: "e3", source: "outline", target: "write", sourceHandle: null, targetHandle: null, label: null },
      { id: "e4", source: "write", target: "seo-optimize", sourceHandle: null, targetHandle: null, label: null },
      { id: "e5", source: "seo-optimize", target: "format", sourceHandle: null, targetHandle: null, label: null },
    ],
  },
  {
    category: "Data Processing",
    title: "Data Extraction Pipeline",
    description: "Fetches content from a source URL, extracts structured data using an AI-powered schema, validates the output against a JSON schema, and delivers clean data.",
    tags: ["data", "extraction", "validation", "scraping"],
    icon: "📊",
    nodes: [
      {
        id: "trigger",
        type: "manualTrigger",
        label: "Enter URL & Schema",
        position: { x: 300, y: 0 },
        config: {
          summary: "Provide the source URL and desired output JSON schema",
          schema: {
            url: { type: "string", required: true },
            extractionSchema: { type: "object", required: true, description: "JSON schema defining the desired output structure" },
          },
        },
      },
      {
        id: "fetch",
        type: "httpRequest",
        label: "Fetch Content",
        position: { x: 300, y: 160 },
        config: {
          method: "GET",
          url: "{{trigger.url}}",
          summary: "Download the source page content",
        },
      },
      {
        id: "clean",
        type: "codeExecute",
        label: "Clean HTML",
        position: { x: 300, y: 320 },
        config: {
          language: "javascript",
          code: "const html = input.body; const text = html.replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '').replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim(); return { cleanedText: text, metadata: { title: html.match(/<title>(.*?)<\\/title>/)?.[1], links: [...html.matchAll(/href=\"(https?:\\/\\/[^\"#]+)\"/g)].map(m => m[1]).slice(0, 20) } };",
          summary: "Strip scripts, styles, and normalize whitespace",
        },
      },
      {
        id: "extract",
        type: "dataExtractor",
        label: "AI Data Extraction",
        position: { x: 300, y: 480 },
        config: {
          prompt: "Extract structured data from the cleaned content. Follow the provided JSON schema exactly. For any field that cannot be found, use null rather than guessing. Be precise with dates (ISO 8601), numbers (numeric type), and arrays.",
          schema: "{{trigger.extractionSchema}}",
          summary: "Extract structured data matching the schema",
        },
      },
      {
        id: "validate",
        type: "codeExecute",
        label: "Validate Output",
        position: { x: 300, y: 640 },
        config: {
          language: "javascript",
          code: "const data = input.extracted; const errors = []; for (const [key, val] of Object.entries(data)) { if (val === null || val === undefined) errors.push(`Missing: ${key}`); if (typeof val === 'string' && val.trim() === '') errors.push(`Empty: ${key}`); } return { valid: errors.length === 0, errors, data, confidence: ((Object.keys(data).length - errors.length) / Object.keys(data).length * 100).toFixed(0) + '%' };",
          summary: "Validate extracted data against expectations",
        },
      },
      {
        id: "format",
        type: "aiAgent",
        label: "Format & Deliver",
        position: { x: 300, y: 800 },
        config: {
          prompt: "Take the validated extracted data and format it as a clean, well-structured JSON response. Add: extraction metadata (source URL, timestamp, confidence score), any warnings about missing fields, and a human-readable summary of what was extracted. If validation failed, explain what's missing and suggest alternatives.",
          summary: "Produce the final structured output",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "fetch", sourceHandle: null, targetHandle: null, label: null },
      { id: "e2", source: "fetch", target: "clean", sourceHandle: null, targetHandle: null, label: null },
      { id: "e3", source: "clean", target: "extract", sourceHandle: null, targetHandle: null, label: null },
      { id: "e4", source: "extract", target: "validate", sourceHandle: null, targetHandle: null, label: null },
      { id: "e5", source: "validate", target: "format", sourceHandle: null, targetHandle: null, label: null },
    ],
  },
];

async function seed() {
  console.log("Seeding marketplace flows...");

  const passwordHash = await bcrypt.hash("admin123", 10);

  const org = await prisma.org.upsert({
    where: { slug: "flowmind" },
    update: {},
    create: { name: "FlowMind Inc.", slug: "flowmind", tier: "ENTERPRISE" },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@flowmind.ai" },
    update: {},
    create: {
      email: "admin@flowmind.ai",
      name: "FlowMind Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      orgId: org.id,
    },
  });

  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: adminUser.id } },
    update: {},
    create: { orgId: org.id, userId: adminUser.id, role: "OWNER" },
  });

  console.log(`  Admin: admin@flowmind.ai / admin123`);

  for (const cat of CATEGORIES) {
    await prisma.flowCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`  Created ${CATEGORIES.length} categories`);

    const downloadCounts = [1247, 892, 634, 1103, 478];
    const ratingAvgs = [4.8, 4.6, 4.9, 4.7, 4.5] as const;

  for (let i = 0; i < DEMO_WORKFLOWS.length; i++) {
    const flow = DEMO_WORKFLOWS[i]!;
    const graph = { nodes: flow.nodes as unknown as Record<string, unknown>[], edges: flow.edges as unknown as Record<string, unknown>[] };
    const pipeline = await prisma.pipeline.create({
      data: {
        userId: adminUser.id,
        name: flow.title,
        description: flow.description,
        category: flow.category,
        tags: flow.tags,
        icon: flow.icon,
        graph: graph as never,
        isPublic: true,
        status: "ACTIVE",
      },
    });

    await prisma.marketplaceFlow.create({
      data: {
        pipelineId: pipeline.id,
        creatorId: adminUser.id,
        category: flow.category,
        title: flow.title,
        description: flow.description,
        tags: flow.tags,
        downloads: downloadCounts[i]!,
        ratingAvg: ratingAvgs[i]!,
        ratingCount: Math.floor(Math.random() * 200) + 50,
        isFeatured: i < 3,
        isVerified: true,
      },
    });

    console.log(`  Created: ${flow.title} (${flow.nodes.length} nodes, ${flow.edges.length} edges)`);
  }

  console.log("Seed complete!");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
