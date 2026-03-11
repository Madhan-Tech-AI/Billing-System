import { supabase } from '../supabase/client'
import type { PosSession, ScanEvent } from '../supabase/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export async function createSession(cashierName: string): Promise<PosSession> {
  const { data, error } = await supabase
    .from('pos_sessions')
    .insert([{ cashier_name: cashierName, status: 'active' }])
    .select()
    .single()

  if (error) throw new Error(`Failed to create session: ${error.message}`)
  return data
}

export async function endSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('pos_sessions')
    .update({ status: 'closed' })
    .eq('id', sessionId)

  if (error) throw new Error(`Failed to end session: ${error.message}`)
}

export async function insertScanEvent(
  sessionId: string,
  barcode: string
): Promise<ScanEvent> {
  const { data, error } = await supabase
    .from('scan_events')
    .insert([{ session_id: sessionId, barcode }])
    .select()
    .single()

  if (error) throw new Error(`Failed to insert scan event: ${error.message}`)
  return data
}

export function subscribeToScanEvents(
  sessionId: string,
  onScan: (barcode: string) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`scan-events-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'scan_events',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const event = payload.new as ScanEvent
        onScan(event.barcode)
      }
    )
    .subscribe()

  return channel
}

export function unsubscribeChannel(channel: RealtimeChannel): void {
  supabase.removeChannel(channel)
}
