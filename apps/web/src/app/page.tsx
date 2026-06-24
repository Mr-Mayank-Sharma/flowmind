"use client"

import Link from "next/link"
import { Sparkles, Bot, GitBranch, LayoutDashboard, Shield, Cpu, Store, Brain, Server, ArrowRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

const features = [
  { icon: GitBranch, title: "Visual Workflow Builder", description: "Drag-and-drop pipeline editor with AI agents, triggers, conditions, and 50+ integrations." },
  { icon: Bot, title: "Autonomous AI Agents", description: "Self-learning agents with contextual memory, skill acquisition, and multi-model orchestration." },
  { icon: LayoutDashboard, title: "Unified Control Center", description: "Manage local LLMs (Ollama, LM Studio), frameworks, and infrastructure from one dashboard." },
  { icon: Store, title: "Workflow Marketplace", description: "Discover, install, and customize pre-built workflows with one click." },
  { icon: Shield, title: "Enterprise Governance", description: "RBAC, audit logging, SSO, and fine-grained permission controls for teams of any size." },
  { icon: Cpu, title: "Multi-Model Routing", description: "Intelligent routing across OpenAI, Anthropic, Google, Mistral, Ollama with cost optimization." },
  { icon: Brain, title: "Context Engine", description: "Episodic, semantic, and procedural memory with vector search for persistent agent context." },
  { icon: Server, title: "MCP Protocol Support", description: "Connect any tool via Model Context Protocol with built-in OAuth and credential management." },
]

const stats = [
  { value: "50+", label: "Pre-built Workflows" },
  { value: "8", label: "LLM Providers" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "SOC 2", label: "Compliant" },
]

const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    features: ["1 user", "5 workflows", "Basic agents", "Community support"],
    cta: "Get Started",
    href: "/login",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    features: ["1 user", "Unlimited workflows", "Advanced agents", "Email support", "Custom models", "API access"],
    cta: "Start Free Trial",
    href: "/login",
    popular: true,
  },
  {
    name: "Team",
    price: "$99",
    period: "/month",
    features: ["5 users", "Unlimited everything", "Priority support", "SSO/SAML", "Audit logs", "Team management", "RBAC"],
    cta: "Contact Sales",
    href: "/login",
    popular: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: ["Unlimited users", "Dedicated support", "On-premise deployment", "Custom integrations", "SLA guarantee", "Training & onboarding"],
    cta: "Talk to Us",
    href: "/login",
    popular: false,
  },
]

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            Enterprise AI Orchestration Platform
          </div>
          <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Build, Deploy & Monitor
            <br />
            <span className="text-primary">AI Agents at Scale</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
            The unified platform for visual workflow automation, autonomous AI agents, multi-model orchestration,
            and enterprise-grade governance. Deploy on your infrastructure or ours.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="gap-2 text-base px-8">
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/home">
              <Button variant="outline" size="lg" className="gap-2 text-base px-8">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 bg-surface/50">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Everything you need for AI at scale</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From visual workflow builders to enterprise governance — FlowMind provides the complete toolkit
            for building, deploying, and monitoring AI agents in production.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="group rounded-xl border border-border/50 bg-surface p-5 hover:border-primary/20 hover:bg-primary/[0.02] transition-all"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 mb-3 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-y border-border/50 bg-surface/50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start for free. Scale as you grow. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 flex flex-col ${
                  plan.popular
                    ? "border-primary/30 bg-primary/[0.03] ring-1 ring-primary/20"
                    : "border-border/50 bg-surface"
                }`}
              >
                {plan.popular && (
                  <div className="text-xs font-medium text-primary mb-3">Most Popular</div>
                )}
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <div className="mt-3 mb-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground ml-1">{plan.period}</span>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}>
                  <Button
                    variant={plan.popular ? "default" : "outline"}
                    className="w-full"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to build your AI workforce?</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Join thousands of teams using FlowMind to build, deploy, and scale AI agents.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/login">
            <Button size="lg" className="gap-2">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/home">
            <Button variant="outline" size="lg">
              Explore Dashboard
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">FlowMind</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} FlowMind. All rights reserved. Enterprise AI Orchestration Platform.
          </p>
        </div>
      </footer>
    </div>
  )
}
