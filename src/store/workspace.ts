import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { runFullAnalysis, getErrorMessage } from "@/lib/api"
import type {
  Patient,
  Session,
  AnalysisResult,
  MemoryCandidate,
  SavedMemory,
  InputMode,
} from "@/types"

interface WorkspaceStore {
  // ── Active patient ──────────────────────────────────────────────────────
  activePatient: Patient | null
  setActivePatient: (patient: Patient | null) => void

  // ── Input ───────────────────────────────────────────────────────────────
  inputText: string
  inputMode: InputMode
  setInputText: (text: string) => void
  setInputMode: (mode: InputMode) => void
  clearInput: () => void

  // ── Analysis ─────────────────────────────────────────────────────────
  analysisResult: AnalysisResult | null
  isAnalyzing: boolean
  analysisError: string | null
  runAnalysis: () => Promise<void>
  clearAnalysis: () => void

  // ── Memory candidates ───────────────────────────────────────────────────
  memoryCandidates: MemoryCandidate[]
  acceptMemoryCandidate: (index: number) => void
  rejectMemoryCandidate: (index: number) => void
  clearMemoryCandidates: () => void

  // ── Saved memories ──────────────────────────────────────────────────────
  savedMemories: SavedMemory[]
  setSavedMemories: (memories: SavedMemory[]) => void
  addSavedMemory: (memory: SavedMemory) => void
  removeMemory: (id: string) => void

  // ── Sessions ─────────────────────────────────────────────────────────
  sessions: Session[]
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  clearSessions: () => void

  // ── UI ──────────────────────────────────────────────────────────────────
  activeTab: "analysis" | "memory" | "history" | "chat"
  setActiveTab: (tab: "analysis" | "memory" | "history" | "chat") => void

  // ── Reset ───────────────────────────────────────────────────────────────
  resetWorkspace: () => void
}

// Non-persisted fields — reset every load
const volatileState = {
  inputText:        "",
  inputMode:        "paste" as InputMode,
  analysisResult:   null,
  isAnalyzing:      false,
  analysisError:    null,
  memoryCandidates: [],
  activeTab:        "analysis" as const,
}

// Persisted fields — survive page refresh
const persistedState = {
  activePatient: null,
  savedMemories: [],
  sessions:      [],
}

const initialState = { ...volatileState, ...persistedState }

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ── Patient ──────────────────────────────────────────────────────
      setActivePatient: (patient) => set({ activePatient: patient }),

      // ── Input ────────────────────────────────────────────────────────
      setInputText: (text) => set({ inputText: text }),
      setInputMode: (mode) => set({ inputMode: mode }),
      clearInput:   ()     => set({ inputText: "" }),

      // ── Analysis ─────────────────────────────────────────────────────
      runAnalysis: async () => {
        const { inputText, activePatient } = get()
        if (!inputText.trim()) return

        set({
          isAnalyzing:      true,
          analysisError:    null,
          analysisResult:   null,
          memoryCandidates: [],
        })

        try {
          const { analysis, memory } = await runFullAnalysis(
            inputText,
            activePatient?.id
          )

          // Build a session record
          const session: Session = {
            id:           crypto.randomUUID(),
            patient_id:   activePatient?.id ?? "anonymous",
            source_type:  "paste",
            raw_text:     inputText,
            created_at:   new Date().toISOString(),
            analysis,
          }

          set((state) => ({
            analysisResult:   analysis,
            memoryCandidates: memory.candidates,
            isAnalyzing:      false,
            activeTab:        "analysis",
            // Prepend new session — latest first
            sessions: [session, ...state.sessions].slice(0, 50),
          }))
        } catch (error) {
          set({
            analysisError: getErrorMessage(error),
            isAnalyzing:   false,
          })
        }
      },

      clearAnalysis: () =>
        set({
          analysisResult:   null,
          analysisError:    null,
          memoryCandidates: [],
        }),

      // ── Memory candidates ─────────────────────────────────────────────
      acceptMemoryCandidate: (index) => {
        const { memoryCandidates, savedMemories, activePatient } = get()
        const candidate = memoryCandidates[index]
        if (!candidate) return

        const newMemory: SavedMemory = {
          id:                    crypto.randomUUID(),
          patient_id:            activePatient?.id ?? "anonymous",
          type:                  candidate.type,
          title:                 candidate.title,
          description:           candidate.description,
          first_seen_session_id: "current",
          last_seen_session_id:  "current",
          therapist_verified:    true,
          status:                "active",
          created_at:            new Date().toISOString(),
          updated_at:            new Date().toISOString(),
        }

        set({
          savedMemories:    [...savedMemories, newMemory],
          memoryCandidates: memoryCandidates.filter((_, i) => i !== index),
        })
      },

      rejectMemoryCandidate: (index) =>
        set((state) => ({
          memoryCandidates: state.memoryCandidates.filter((_, i) => i !== index),
        })),

      clearMemoryCandidates: () => set({ memoryCandidates: [] }),

      // ── Saved memories ────────────────────────────────────────────────
      setSavedMemories: (memories) => set({ savedMemories: memories }),
      addSavedMemory:   (memory)   =>
        set((state) => ({ savedMemories: [...state.savedMemories, memory] })),
      removeMemory: (id) =>
        set((state) => ({
          savedMemories: state.savedMemories.filter((m) => m.id !== id),
        })),

      // ── Sessions ──────────────────────────────────────────────────────
      setSessions:   (sessions) => set({ sessions }),
      clearSessions: ()         => set({ sessions: [] }),
      addSession: (session) =>
        set((state) => ({
          sessions: [session, ...state.sessions].slice(0, 50),
        })),

      // ── UI ────────────────────────────────────────────────────────────
      setActiveTab: (tab) => set({ activeTab: tab }),

      // ── Reset ─────────────────────────────────────────────────────────
      // Only resets volatile state — sessions + memories survive
      resetWorkspace: () => set(volatileState),
    }),
    {
      name: "therapist-workspace",
      storage: createJSONStorage(() => localStorage),
      // Only persist these fields — skip loading states and transient UI
      partialize: (state) => ({
        activePatient: state.activePatient,
        savedMemories: state.savedMemories,
        sessions:      state.sessions,
      }),
    }
  )
)