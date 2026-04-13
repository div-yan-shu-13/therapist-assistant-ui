import type {
  AnalyzeRequest,
  AnalysisResult,
  MemoryRequest,
  MemoryResponse,
  HealthResponse,
} from "@/types"

// ─── Base config ──────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// ─── Error types ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    message?: string
  ) {
    super(message ?? detail)
    this.name = "ApiError"
  }
}

export class ModelNotLoadedError extends ApiError {
  constructor() {
    super(503, "Model is not loaded", "The analysis model is not ready. Please try again shortly.")
    this.name = "ModelNotLoadedError"
  }
}

export class NetworkError extends Error {
  constructor() {
    super("Could not reach the analysis server. Make sure it is running on port 8000.")
    this.name = "NetworkError"
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      // Next.js 15 — no-store by default, explicit here for clarity
      cache: "no-store",
      ...options,
    })
  } catch {
    // fetch() itself threw — server is unreachable
    throw new NetworkError()
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`

    try {
      const body = await response.json()
      detail = body.detail ?? body.error ?? detail
    } catch {
      // response body wasn't JSON — use the default detail
    }

    if (response.status === 503) throw new ModelNotLoadedError()

    throw new ApiError(response.status, detail)
  }

  return response.json() as Promise<T>
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * Check if the FastAPI service and model are ready.
 */
export async function checkHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health")
}

/**
 * Analyze patient text for risk tier, context, signals, and evidence spans.
 */
export async function analyzeText(
  request: AnalyzeRequest
): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>("/analyze", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

/**
 * Extract structured memory candidates from patient text.
 * Returns candidates for therapist review — nothing is saved automatically.
 */
export async function extractMemory(
  request: MemoryRequest
): Promise<MemoryResponse> {
  return apiFetch<MemoryResponse>("/extract-memory", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

// ─── Combined call ────────────────────────────────────────────────────────────
// Runs analyze + extract-memory in parallel since both are independent.
// This is the main call the workspace makes on every submission.

export interface FullAnalysisResult {
  analysis: AnalysisResult
  memory: MemoryResponse
}

export async function runFullAnalysis(
  text: string,
  patientId?: string
): Promise<FullAnalysisResult> {
  const [analysis, memory] = await Promise.all([
    analyzeText({
      text,
      patient_id: patientId,
      mode: "paste",
    }),
    extractMemory({
      text,
      patient_id: patientId,
    }),
  ])

  return { analysis, memory }
}

// ─── Error message helper ─────────────────────────────────────────────────────
// Converts any thrown error into a clean string for the UI.

export function getErrorMessage(error: unknown): string {
  if (error instanceof ModelNotLoadedError) {
    return "The analysis model is not ready. Please check the server and try again."
  }
  if (error instanceof NetworkError) {
    return "Could not reach the analysis server. Make sure it is running on port 8000."
  }
  if (error instanceof ApiError) {
    return `Analysis failed: ${error.detail}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return "An unexpected error occurred."
}