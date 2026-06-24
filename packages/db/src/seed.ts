import { prisma } from "./index";
import bcrypt from "bcryptjs";

const DEFAULT_FLOWS = [
  {
    category: "SEO & Content Marketing",
    title: "SEO Project Optimizer",
    description: "Audits website, generates meta tags, keyword clusters, internal link suggestions, schema markup. Produces full SEO report with implementation guide.",
    tags: ["seo", "marketing", "audit", "keywords"],
    icon: "🔍",
  },
  {
    category: "SEO & Content Marketing",
    title: "Blog Post Writer",
    description: "Researches topic, writes full SEO-optimized blog post with headers, FAQs, and meta description. Ready-to-publish content.",
    tags: ["content", "blog", "writing", "seo"],
    icon: "✍️",
  },
  {
    category: "SEO & Content Marketing",
    title: "Content Gap Analyzer",
    description: "Analyzes your domain against 3 competitor URLs to find keyword gaps, content opportunities, and missing pages.",
    tags: ["seo", "competitor", "research", "content"],
    icon: "📊",
  },
  {
    category: "Research & Intelligence",
    title: "Deep Researcher",
    description: "Multi-source research with synthesis, citations, and executive summary. Exports to PDF, Markdown, or DOCX.",
    tags: ["research", "report", "analysis", "academic"],
    icon: "📚",
  },
  {
    category: "Research & Intelligence",
    title: "Competitor Intelligence",
    description: "Analyzes competitor products, pricing, messaging, reviews, and job postings. Produces competitive analysis dashboard.",
    tags: ["research", "competitor", "business", "analysis"],
    icon: "🎯",
  },
  {
    category: "Video & Media Production",
    title: "YouTube Video Maker",
    description: "End-to-end video creation: script → voiceover → image prompts → FFmpeg assembly → draft upload.",
    tags: ["video", "youtube", "content", "media"],
    icon: "🎬",
  },
  {
    category: "Video & Media Production",
    title: "Short-Form Video Creator",
    description: "Creates platform-optimized short videos for TikTok, Instagram Reels, and YouTube Shorts with scripts, captions, and thumbnails.",
    tags: ["video", "social", "tiktok", "reels"],
    icon: "📱",
  },
  {
    category: "Photo & Visual Design",
    title: "Brand Kit Generator",
    description: "Generates logo concepts, color palette, typography, and brand guidelines PDF from brand name and industry.",
    tags: ["design", "brand", "logo", "identity"],
    icon: "🎨",
  },
  {
    category: "Photo & Visual Design",
    title: "Social Media Asset Maker",
    description: "Creates sized images for Instagram, LinkedIn, Twitter, and Facebook from brand kit and post copy.",
    tags: ["design", "social", "marketing", "images"],
    icon: "🖼️",
  },
  {
    category: "Content Writing",
    title: "Email Newsletter Writer",
    description: "Writes full newsletter from topic list, optimized for open rates, formatted for Mailchimp and Beehiiv.",
    tags: ["writing", "email", "newsletter", "marketing"],
    icon: "📧",
  },
  {
    category: "Content Writing",
    title: "Landing Page Copywriter",
    description: "Creates complete landing page copy: headline, subheading, features, social proof, FAQ, and CTA.",
    tags: ["writing", "landing-page", "copy", "marketing"],
    icon: "📄",
  },
  {
    category: "Marketing Automation",
    title: "Lead Nurture Sequence",
    description: "Creates 7-email drip sequence for new leads with personalization hooks and progressive engagement.",
    tags: ["marketing", "email", "leads", "automation"],
    icon: "📈",
  },
  {
    category: "Marketing Automation",
    title: "Cold Email Campaign",
    description: "Researches prospects, personalizes emails, sequences follow-ups, and tracks replies automatically.",
    tags: ["marketing", "email", "outreach", "sales"],
    icon: "📨",
  },
  {
    category: "Business Operations",
    title: "Meeting Note Summarizer",
    description: "Records/transcribes meeting audio, extracts action items, assigns owners, and sends summary email.",
    tags: ["productivity", "meetings", "notes", "automation"],
    icon: "🎙️",
  },
  {
    category: "Business Operations",
    title: "Expense Report Processor",
    description: "Scans receipt images, categorizes expenses, generates reports, and routes for approval.",
    tags: ["finance", "expenses", "automation", "receipts"],
    icon: "💰",
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

  for (const flow of DEFAULT_FLOWS) {
    const pipeline = await prisma.pipeline.create({
      data: {
        userId: adminUser.id,
        name: flow.title,
        description: flow.description,
        category: flow.category,
        tags: flow.tags,
        icon: flow.icon,
        graph: {
          nodes: [
            {
              id: "trigger-1",
              type: "manualTrigger",
              label: "Manual Trigger",
              position: { x: 250, y: 0 },
              config: {},
            },
            {
              id: "ai-1",
              type: "aiAgent",
              label: flow.title,
              position: { x: 250, y: 200 },
              config: { prompt: flow.description },
            },
          ],
          edges: [
            {
              id: "e-trigger-ai",
              source: "trigger-1",
              target: "ai-1",
              sourceHandle: null,
              targetHandle: null,
              label: null,
            },
          ],
        },
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
        downloads: Math.floor(Math.random() * 1000),
        ratingAvg: +(3.5 + Math.random() * 1.5).toFixed(1),
        ratingCount: Math.floor(Math.random() * 50) + 1,
        isFeatured: Math.random() > 0.7,
        isVerified: true,
      },
    });

    console.log(`  Created: ${flow.title}`);
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
