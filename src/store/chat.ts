import { create } from "zustand"
import { runFullAnalysis, getErrorMessage } from "@/lib/api"
import type { AnalysisResult, MemoryCandidate } from "@/types"

export type ChatRole = "patient" | "therapist"

export interface ChatMessage {
  id:        string
  role:      ChatRole
  text:      string
  timestamp: string
  flagged?:  boolean   // true when sent during a High/Crisis analysis
}

interface ChatStore {
  messages:        ChatMessage[]
  inputMode:       ChatRole
  autoAnalyze:     boolean
  analyzeCount:    number

  // Analysis state
  chatAnalysis:    AnalysisResult | null
  chatCandidates:  MemoryCandidate[]
  isAnalyzing:     boolean
  analysisError:   string | null

  // Actions
  addMessage:      (role: ChatRole, text: string) => void
  setInputMode:    (mode: ChatRole) => void
  toggleAutoAnalyze: () => void
  runChatAnalysis: (patientId?: string) => Promise<void>
  clearChat:       () => void
}

const buildText = (messages: ChatMessage[]) =>
  messages
    .filter((m) => m.role === "patient")
    .map((m) => m.text)
    .join("\n")

export const useChatStore = create<ChatStore>()((set, get) => ({
  messages:       [],
  inputMode:      "patient",
  autoAnalyze:    true,
  analyzeCount:   0,
  chatAnalysis:   null,
  chatCandidates: [],
  isAnalyzing:    false,
  analysisError:  null,

  addMessage: (role, text) => {
    const message: ChatMessage = {
      id:        crypto.randomUUID(),
      role,
      text,
      timestamp: new Date().toISOString(),
    }
    set((s) => ({ messages: [...s.messages, message] }))
  },

  setInputMode:      (mode)  => set({ inputMode: mode }),
  toggleAutoAnalyze: ()      => set((s) => ({ autoAnalyze: !s.autoAnalyze })),

  runChatAnalysis: async (patientId) => {
    const text = buildText(get().messages)
    if (!text.trim()) return

    set({ isAnalyzing: true, analysisError: null })

    try {
      const { analysis, memory } = await runFullAnalysis(text, patientId)

      // Flag the most recent patient message if High/Crisis
      const isFlagged = analysis.risk_tier === "High" || analysis.risk_tier === "Crisis"
      if (isFlagged) {
        set((s) => {
          const msgs = [...s.messages]
          // find last patient message
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "patient") { msgs[i] = { ...msgs[i], flagged: true }; break }
          }
          return { messages: msgs }
        })
      }

      set((s) => ({
        chatAnalysis:   analysis,
        chatCandidates: memory.candidates,
        isAnalyzing:    false,
        analyzeCount:   s.analyzeCount + 1,
      }))
    } catch (err) {
      set({ analysisError: getErrorMessage(err), isAnalyzing: false })
    }
  },

  clearChat: () =>
    set({
      messages:       [],
      chatAnalysis:   null,
      chatCandidates: [],
      isAnalyzing:    false,
      analysisError:  null,
      analyzeCount:   0,
    }),
}))