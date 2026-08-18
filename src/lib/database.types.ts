/**
 * Generated Supabase schema types — DO NOT EDIT BY HAND.
 *
 * The database is currently empty; the real schema is still in the Lovable
 * project and has not been imported yet (see docs/SUPABASE.md).
 *
 * Once the schema is applied, regenerate this file with:
 *   supabase gen types typescript --project-id twtmkvorzpvwnznqzcrw > src/lib/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
