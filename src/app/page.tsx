"use client"

import { useState } from "react"
import { analyzeText, getErrorMessage } from "@/lib/api"
import type { AnalysisResult, RiskTier } from "@/types"
import { RISK_TIER_CONFIG } from "@/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Brain, Users, Clock, AlertTriangle,
  ArrowRight, Loader2, Plus,
} from "lucide-react"
import Link from "next/link"

const MOCK_PATIENTS = [
  { id: "p1", name: "Patient A", lastSession: "2 hours ago",  risk: "High"     as RiskTier },
  { id: "p2", name: "Patient B", lastSession: "Yesterday",    risk: "Moderate" as RiskTier },
  { id: "p3", name: "Patient C", lastSession: "3 days ago",   risk: "Low"      as RiskTier },
  { id: "p4", name: "Patient D", lastSession: "Last week",    risk: "Crisis"   as RiskTier },
]

const RECENT_SESSIONS = [
  { id: "s1", patientId: "p1", patientName: "Patient A", time: "2 hours ago", risk: "High"     as RiskTier, preview: "Mentioned feeling hopeless about the future..." },
  { id: "s2", patientId: "p4", patientName: "Patient D", time: "3 hours ago", risk: "Crisis"   as RiskTier, preview: "Expressed thoughts about not wanting to continue..." },
  { id: "s3", patientId: "p2", patientName: "Patient B", time: "Yesterday",   risk: "Moderate" as RiskTier, preview: "Feeling anxious about upcoming work presentation..." },
]

function QuickAnalyzeSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      <div className="skeleton h-5 w-24 rounded" />
      <div className="skeleton h-4 w-full rounded" />
      <div className="skeleton h-4 w-4/5 rounded" />
      <div className="flex gap-2 pt-1">
        <div className="skeleton h-6 w-16 rounded-full" />
        <div className="skeleton h-6 w-20 rounded-full" />
        <div className="skeleton h-6 w-14 rounded-full" />
      </div>
    </div>
  )
}

function QuickAnalyzeResult({ result }: { result: AnalysisResult }) {
  const cfg = RISK_TIER_CONFIG[result.risk_tier]

  return (
    <div className="space-y-3 pt-2 animate-in fade-in duration-300">
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", cfg.bg, cfg.border)}>
        <span className={cn("text-sm font-semibold", cfg.color)}>
          {cfg.label}
        </span>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto capitalize">
          {result.confidence} confidence
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs capitalize">{result.context_label}</Badge>
        <Badge variant="outline" className="text-xs">{result.raw_class}</Badge>
        <span className="text-xs text-[var(--color-text-faint)] ml-auto font-mono">
          {result.raw_score.toFixed(3)}
        </span>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {result.signal_labels.map((sig) => (
          <span
            key={sig}
            className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-offset)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
          >
            {sig}
          </span>
        ))}
      </div>

      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
        {result.summary}
      </p>

      {result.evidence_spans.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">Evidence</p>
          <div className="flex gap-1.5 flex-wrap">
            {result.evidence_spans.slice(0, 4).map((span, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
              >
                "{span.text}"
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [quickText, setQuickText]     = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [quickResult, setQuickResult] = useState<AnalysisResult | null>(null)
  const [quickError, setQuickError]   = useState<string | null>(null)

  const needsReview = MOCK_PATIENTS.filter(
    (p) => p.risk === "High" || p.risk === "Crisis"
  )

  async function handleQuickAnalyze() {
    if (!quickText.trim() || isAnalyzing) return
    setIsAnalyzing(true)
    setQuickResult(null)
    setQuickError(null)
    try {
      const result = await analyzeText({ text: quickText, mode: "paste" })
      setQuickResult(result)
    } catch (e) {
      setQuickError(getErrorMessage(e))
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">

      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[var(--color-primary)] flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Therapist Assistant</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              size="sm"
              className="gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              New Patient
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Patients", value: MOCK_PATIENTS.length,    icon: Users,          color: "text-[var(--color-primary)]"      },
            { label: "Needs Review",    value: needsReview.length,       icon: AlertTriangle,  color: "text-orange-500"                  },
            { label: "Sessions Today",  value: RECENT_SESSIONS.length,   icon: Clock,          color: "text-[var(--color-text-muted)]"   },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="panel-card">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={cn("w-5 h-5 shrink-0", color)} />
                <div>
                  <p className="text-2xl font-bold leading-none">{value}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_400px] gap-6 items-start">

          <div className="space-y-6">

            {needsReview.length > 0 && (
              <Card className="panel-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Needs Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {needsReview.map((p) => {
                    const cfg = RISK_TIER_CONFIG[p.risk]
                    return (
                      <Link
                        key={p.id}
                        href={`/patients/${p.id}`}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-[var(--color-surface-offset)] flex items-center justify-center text-xs font-medium">
                            {p.name.split(" ")[1]}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{p.lastSession}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", cfg.bg, cfg.color, cfg.border)}>
                            {cfg.label}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-faint)] group-hover:text-[var(--color-text-muted)] transition-colors" />
                        </div>
                      </Link>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            <Card className="panel-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
                  All Patients
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0">
                {MOCK_PATIENTS.map((p) => {
                  const cfg = RISK_TIER_CONFIG[p.risk]
                  return (
                    <Link
                      key={p.id}
                      href={`/patients/${p.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[var(--color-surface-offset)] transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center text-xs font-medium text-[var(--color-primary)]">
                          {p.name.split(" ")[1]}
                        </div>
                        <span className="text-sm">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--color-text-faint)]">{p.lastSession}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full", cfg.bg, cfg.color)}>
                          {p.risk}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="panel-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                  Recent Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {RECENT_SESSIONS.map((s) => {
                  const cfg = RISK_TIER_CONFIG[s.risk]
                  return (
                    <Link
                      key={s.id}
                      href={`/patients/${s.patientId}`}
                      className="block px-3 py-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{s.patientName}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--color-text-faint)]">{s.time}</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full", cfg.bg, cfg.color)}>
                            {s.risk}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{s.preview}</p>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          <Card className="panel-card sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-[var(--color-primary)]" />
                Quick Analyze
              </CardTitle>
              <p className="text-xs text-[var(--color-text-muted)]">
                Paste any patient text for an instant analysis. No patient association required.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <Textarea
                placeholder="Paste a message, note, or journal entry..."
                className="resize-none text-sm min-h-[140px] bg-[var(--color-surface-2)] border-[var(--color-border)] focus:border-[var(--color-primary)] transition-colors"
                value={quickText}
                onChange={(e) => {
                  setQuickText(e.target.value)
                  if (quickResult) setQuickResult(null)
                  if (quickError)  setQuickError(null)
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleQuickAnalyze()
                }}
              />

              <Button
                className="w-full gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white"
                disabled={!quickText.trim() || isAnalyzing}
                onClick={handleQuickAnalyze}
              >
                {isAnalyzing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                  : "Analyze"
                }
              </Button>

              <p className="text-xs text-center text-[var(--color-text-faint)]">⌘ + Enter to analyze</p>

              {isAnalyzing && <QuickAnalyzeSkeleton />}

              {quickError && !isAnalyzing && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
                  {quickError}
                </div>
              )}

              {quickResult && !isAnalyzing && (
                <QuickAnalyzeResult result={quickResult} />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}