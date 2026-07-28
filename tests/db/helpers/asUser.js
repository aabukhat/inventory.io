import { supabase } from '../../../src/lib/supabase.js'

// src/lib/*.js functions all close over the single supabase singleton rather
// than accepting an injectable client, so "acting as" a given test user means
// swapping the singleton's active session before calling the real lib
// function — this exercises the exact client code path the app uses (RLS +
// RPC + trigger together), which is what catches client/server permission
// mismatches. Tests using this must run serially within a file (Vitest's
// default — never mark these test.concurrent).
export async function asUser(session, fn) {
  const { error } = await supabase.auth.setSession(session)
  if (error) throw error
  return await fn()
}
