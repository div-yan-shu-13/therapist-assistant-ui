import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { Patient } from "@/types"

// Seed data so the app isn't empty on first load
const SEED_PATIENTS: Patient[] = [
  {
    id:           "p1",
    display_name: "Patient A",
    notes:        "27F, referred for anxiety and depressive episodes.",
    created_at:   "2026-01-10T09:00:00Z",
    last_session: "2026-04-12T14:30:00Z",
  },
  {
    id:           "p2",
    display_name: "Patient B",
    notes:        "34M, generalised anxiety disorder, mild OCD tendencies.",
    created_at:   "2026-02-03T10:00:00Z",
    last_session: "2026-04-11T11:00:00Z",
  },
  {
    id:           "p3",
    display_name: "Patient C",
    notes:        "19F, university student, adjustment difficulties.",
    created_at:   "2026-03-15T14:00:00Z",
    last_session: "2026-04-09T15:30:00Z",
  },
  {
    id:           "p4",
    display_name: "Patient D",
    notes:        "41M, recent bereavement, high-risk watch.",
    created_at:   "2026-01-20T08:00:00Z",
    last_session: "2026-04-13T09:00:00Z",
  },
]

interface PatientsStore {
  patients:      Patient[]
  addPatient:    (patient: Omit<Patient, "id" | "created_at">) => Patient
  updatePatient: (id: string, updates: Partial<Patient>) => void
  removePatient: (id: string) => void
  getPatient:    (id: string) => Patient | undefined
}

export const usePatientsStore = create<PatientsStore>()(
  persist(
    (set, get) => ({
      patients: SEED_PATIENTS,

      addPatient: (data) => {
        const patient: Patient = {
          ...data,
          id:         crypto.randomUUID(),
          created_at: new Date().toISOString(),
        }
        set((state) => ({ patients: [...state.patients, patient] }))
        return patient
      },

      updatePatient: (id, updates) =>
        set((state) => ({
          patients: state.patients.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      removePatient: (id) =>
        set((state) => ({
          patients: state.patients.filter((p) => p.id !== id),
        })),

      getPatient: (id) => get().patients.find((p) => p.id === id),
    }),
    {
      name:    "therapist-patients",
      storage: createJSONStorage(() => localStorage),
    }
  )
)