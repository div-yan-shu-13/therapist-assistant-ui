// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL     = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const TIMEOUT_MS   = 30_000   // 30s — model inference can be slow on first run

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path:    string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal:  controller.signal,
      ...options,
    })

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const body = await res.json()
        message = body?.detail ?? body?.error ?? message
      } catch {
        // body wasn't JSON — keep the status message
      }
      throw new ApiError(message, res.status)
    }

    return res.json() as Promise<T>
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timed out. The model may still be loading.", 408)
    }
    throw new ApiError(
      err instanceof Error ? err.message : "Network error",
      0
    )
  } finally {
    clearTimeout(timer)
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error)    return err.message
  return "An unexpected error occurred."
}

// ─── Types (mirror app/schemas.py exactly) ────────────────────────────────────

export type RiskTier      = "Low" | "Moderate" | "High" | "Crisis"
export type ContextLabel  = "self-directed" | "third-person" | "support-seeking" | "ambiguous"
export type ConfidenceLevel = "strong" | "medium" | "cautious"
export type MemoryType    = "life_event" | "relationship" | "recurring_theme" | "protective_factor"
export type InputMode     = "paste" | "chat"

export interface EvidenceSpan {
  text:       string
  label:      string
  score:      number
  start_idx:  number | null
  end_idx:    number | null
}

export interface MemoryCandidate {
  type:        MemoryType
  title:       string
  description: string
  confidence:  number
}

// ─── /analyze ─────────────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  text:       string
  patient_id?: string
  mode?:      InputMode
}

export interface AnalyzeResponse {
  risk_tier:      RiskTier
  context_label:  ContextLabel
  signal_labels:  string[]
  confidence:     ConfidenceLevel
  summary:        string
  evidence_spans: EvidenceSpan[]
  raw_class:      string
  raw_score:      number
}

export async function analyzeText(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  return apiFetch<AnalyzeResponse>("/analyze", {
    method: "POST",
    body:   JSON.stringify({
      text:       req.text,
      patient_id: req.patient_id ?? null,
      mode:       req.mode ?? "paste",
    }),
  })
}

// ─── /extract-memory ──────────────────────────────────────────────────────────

export interface MemoryRequest {
  text:       string
  patient_id?: string
}

export interface MemoryResponse {
  candidates: MemoryCandidate[]
  count:      number
}

export async function extractMemory(req: MemoryRequest): Promise<MemoryResponse> {
  return apiFetch<MemoryResponse>("/extract-memory", {
    method: "POST",
    body:   JSON.stringify({
      text:       req.text,
      patient_id: req.patient_id ?? null,
    }),
  })
}

// ─── /health ──────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status:       string
  model_loaded: boolean
  version:      string
}

export async function checkHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health")
}

// ─── runFullAnalysis — called by the workspace store ──────────────────────────
// Fires both endpoints in parallel. Memory extraction is best-effort:
// if it fails (e.g. model returned nothing), we return empty candidates
// rather than failing the whole analysis.

export async function runFullAnalysis(
  text:       string,
  patient_id?: string
): Promise<{ analysis: AnalyzeResponse; memory: MemoryResponse }> {
  const [analysis, memory] = await Promise.allSettled([
    analyzeText({ text, patient_id, mode: "paste" }),
    extractMemory({ text, patient_id }),
  ])

  if (analysis.status === "rejected") {
    // Re-throw the analysis error — it's the primary call
    throw analysis.reason
  }

  return {
    analysis: analysis.value,
    memory:
      memory.status === "fulfilled"
        ? memory.value
        : { candidates: [], count: 0 },
  }
}