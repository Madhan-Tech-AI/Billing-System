import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PosSession } from '../supabase/types'
import { createSession, endSession } from '../services/scannerService'

interface SessionStore {
  session: PosSession | null
  cashierName: string
  loading: boolean
  error: string | null
  startSession: (name: string) => Promise<PosSession>
  endSession: () => Promise<void>
  setCashierName: (name: string) => void
  clearError: () => void
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      session: null,
      cashierName: '',
      loading: false,
      error: null,

      startSession: async (name: string) => {
        set({ loading: true, error: null })
        try {
          const session = await createSession(name)
          set({ session, cashierName: name, loading: false })
          return session
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to start session'
          set({ error: message, loading: false })
          throw err
        }
      },

      endSession: async () => {
        const { session } = get()
        if (!session) return
        set({ loading: true })
        try {
          await endSession(session.id)
          set({ session: null, loading: false })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to end session'
          set({ error: message, loading: false })
        }
      },

      setCashierName: (name: string) => set({ cashierName: name }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'pos-session',
      partialize: (state) => ({
        cashierName: state.cashierName,
        session: state.session,
      }),
    }
  )
)
