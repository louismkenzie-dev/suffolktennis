export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      booking_invitations: {
        Row: {
          child_id: string | null
          child_name: string | null
          created_at: string
          event_id: string
          id: string
          invited_by: string | null
          opened_at: string | null
          parent_email: string
          parent_name: string | null
          parent_user_id: string | null
          reminded_at: string | null
          sent_at: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          child_id?: string | null
          child_name?: string | null
          created_at?: string
          event_id: string
          id?: string
          invited_by?: string | null
          opened_at?: string | null
          parent_email: string
          parent_name?: string | null
          parent_user_id?: string | null
          reminded_at?: string | null
          sent_at?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          child_id?: string | null
          child_name?: string | null
          created_at?: string
          event_id?: string
          id?: string
          invited_by?: string | null
          opened_at?: string | null
          parent_email?: string
          parent_name?: string | null
          parent_user_id?: string | null
          reminded_at?: string | null
          sent_at?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_invitations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_pence: number
          child_dob: string | null
          child_id: string | null
          child_name: string
          created_at: string
          currency: string
          event_id: string
          id: string
          invitation_id: string | null
          medical_notes: string | null
          membership_id: string | null
          paid_at: string | null
          parent_email: string
          parent_name: string
          parent_phone: string | null
          parent_user_id: string | null
          photo_consent: boolean
          session_slot: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_env: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_pence?: number
          child_dob?: string | null
          child_id?: string | null
          child_name: string
          created_at?: string
          currency?: string
          event_id: string
          id?: string
          invitation_id?: string | null
          medical_notes?: string | null
          membership_id?: string | null
          paid_at?: string | null
          parent_email: string
          parent_name: string
          parent_phone?: string | null
          parent_user_id?: string | null
          photo_consent?: boolean
          session_slot?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_env?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_pence?: number
          child_dob?: string | null
          child_id?: string | null
          child_name?: string
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          invitation_id?: string | null
          medical_notes?: string | null
          membership_id?: string | null
          paid_at?: string | null
          parent_email?: string
          parent_name?: string
          parent_phone?: string | null
          parent_user_id?: string | null
          photo_consent?: boolean
          session_slot?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_env?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "booking_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_membership_fk"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          btm_number: string | null
          county_rank: number | null
          created_at: string
          current_coach: string | null
          date_of_birth: string | null
          description: string | null
          favorite_player: string | null
          favorite_shot: string | null
          gender: string | null
          handedness: string | null
          has_medical_needs: boolean
          has_send_needs: boolean
          home_club: string | null
          id: string
          medical_conditions: string[]
          medical_details: string | null
          medical_needs: string | null
          name: string
          national_rank: number | null
          parent_user_id: string
          photo_url: string | null
          send_conditions: string[]
          send_details: string | null
          updated_at: string
        }
        Insert: {
          btm_number?: string | null
          county_rank?: number | null
          created_at?: string
          current_coach?: string | null
          date_of_birth?: string | null
          description?: string | null
          favorite_player?: string | null
          favorite_shot?: string | null
          gender?: string | null
          handedness?: string | null
          has_medical_needs?: boolean
          has_send_needs?: boolean
          home_club?: string | null
          id?: string
          medical_conditions?: string[]
          medical_details?: string | null
          medical_needs?: string | null
          name: string
          national_rank?: number | null
          parent_user_id: string
          photo_url?: string | null
          send_conditions?: string[]
          send_details?: string | null
          updated_at?: string
        }
        Update: {
          btm_number?: string | null
          county_rank?: number | null
          created_at?: string
          current_coach?: string | null
          date_of_birth?: string | null
          description?: string | null
          favorite_player?: string | null
          favorite_shot?: string | null
          gender?: string | null
          handedness?: string | null
          has_medical_needs?: boolean
          has_send_needs?: boolean
          home_club?: string | null
          id?: string
          medical_conditions?: string[]
          medical_details?: string | null
          medical_needs?: string | null
          name?: string
          national_rank?: number | null
          parent_user_id?: string
          photo_url?: string | null
          send_conditions?: string[]
          send_details?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coaches: {
        Row: {
          achievements: Json
          bio: string | null
          created_at: string
          display_order: number
          experience: string | null
          id: string
          linked_user_id: string | null
          name: string
          philosophy: string | null
          photo_url: string | null
          published: boolean
          qualification: string | null
          quote: string | null
          role: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          achievements?: Json
          bio?: string | null
          created_at?: string
          display_order?: number
          experience?: string | null
          id?: string
          linked_user_id?: string | null
          name: string
          philosophy?: string | null
          photo_url?: string | null
          published?: boolean
          qualification?: string | null
          quote?: string | null
          role?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          achievements?: Json
          bio?: string | null
          created_at?: string
          display_order?: number
          experience?: string | null
          id?: string
          linked_user_id?: string | null
          name?: string
          philosophy?: string | null
          photo_url?: string | null
          published?: boolean
          qualification?: string | null
          quote?: string | null
          role?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_invitations: {
        Row: {
          child_id: string
          created_at: string
          event_id: string
          id: string
          invited_by: string | null
          notes: string | null
          parent_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          child_id: string
          created_at?: string
          event_id: string
          id?: string
          invited_by?: string | null
          notes?: string | null
          parent_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          event_id?: string
          id?: string
          invited_by?: string | null
          notes?: string | null
          parent_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sessions: {
        Row: {
          created_at: string
          end_time: string | null
          event_id: string
          id: string
          notes: string | null
          session_date: string
          start_time: string | null
          venue: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          event_id: string
          id?: string
          notes?: string | null
          session_date: string
          start_time?: string | null
          venue?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          session_date?: string
          start_time?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_signups: {
        Row: {
          child_dob: string | null
          child_gender: string | null
          child_name: string
          created_at: string
          event_id: string
          id: string
          medical_notes: string | null
          parent_club: string | null
          parent_email: string
          parent_name: string
          parent_phone: string | null
          photo_consent: boolean
          player_coach: string | null
          session_slot: string | null
        }
        Insert: {
          child_dob?: string | null
          child_gender?: string | null
          child_name: string
          created_at?: string
          event_id: string
          id?: string
          medical_notes?: string | null
          parent_club?: string | null
          parent_email: string
          parent_name: string
          parent_phone?: string | null
          photo_consent?: boolean
          player_coach?: string | null
          session_slot?: string | null
        }
        Update: {
          child_dob?: string | null
          child_gender?: string | null
          child_name?: string
          created_at?: string
          event_id?: string
          id?: string
          medical_notes?: string | null
          parent_club?: string | null
          parent_email?: string
          parent_name?: string
          parent_phone?: string | null
          photo_consent?: boolean
          player_coach?: string | null
          session_slot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_signups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          age_group: string | null
          capacity: number | null
          cost: string | null
          created_at: string
          description: string | null
          end_date: string | null
          event_date: string
          event_type: string
          featured: boolean
          id: string
          location: string | null
          monthly_amount_pence: number | null
          poster_url: string | null
          price_pence: number | null
          programme_months: number | null
          programme_type: string
          session_slots: Json
          sign_up_deadline: string | null
          sign_up_enabled: boolean
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          age_group?: string | null
          capacity?: number | null
          cost?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_date: string
          event_type?: string
          featured?: boolean
          id?: string
          location?: string | null
          monthly_amount_pence?: number | null
          poster_url?: string | null
          price_pence?: number | null
          programme_months?: number | null
          programme_type?: string
          session_slots?: Json
          sign_up_deadline?: string | null
          sign_up_enabled?: boolean
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          age_group?: string | null
          capacity?: number | null
          cost?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_date?: string
          event_type?: string
          featured?: boolean
          id?: string
          location?: string | null
          monthly_amount_pence?: number | null
          poster_url?: string | null
          price_pence?: number | null
          programme_months?: number | null
          programme_type?: string
          session_slots?: Json
          sign_up_deadline?: string | null
          sign_up_enabled?: boolean
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          booking_id: string | null
          cancelled_at: string | null
          child_name: string
          created_at: string
          current_period_end: string | null
          event_id: string
          id: string
          last_payment_failed_at: string | null
          monthly_amount_pence: number
          months_paid: number
          months_total: number
          parent_email: string
          parent_user_id: string | null
          started_at: string
          status: string
          stripe_customer_id: string | null
          stripe_env: string
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          cancelled_at?: string | null
          child_name: string
          created_at?: string
          current_period_end?: string | null
          event_id: string
          id?: string
          last_payment_failed_at?: string | null
          monthly_amount_pence: number
          months_paid?: number
          months_total: number
          parent_email: string
          parent_user_id?: string | null
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_env?: string
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          cancelled_at?: string | null
          child_name?: string
          created_at?: string
          current_period_end?: string | null
          event_id?: string
          id?: string
          last_payment_failed_at?: string | null
          monthly_amount_pence?: number
          months_paid?: number
          months_total?: number
          parent_email?: string
          parent_user_id?: string | null
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_env?: string
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_progress: {
        Row: {
          achieved: boolean
          age_group: string
          created_at: string
          id: string
          milestone: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved?: boolean
          age_group: string
          created_at?: string
          id?: string
          milestone: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved?: boolean
          age_group?: string
          created_at?: string
          id?: string
          milestone?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_reports: {
        Row: {
          child_id: string
          coach_comments: string | null
          competitive_schedule: string | null
          county: string | null
          created_at: string
          id: string
          individual_coach: string | null
          national_coach: string | null
          programme: string | null
          programme_review: Json | null
          region: string | null
          report_date: string
          report_pdf_url: string | null
          report_title: string
          talent_characteristics: Json | null
          updated_at: string
          weekly_schedule: string | null
        }
        Insert: {
          child_id: string
          coach_comments?: string | null
          competitive_schedule?: string | null
          county?: string | null
          created_at?: string
          id?: string
          individual_coach?: string | null
          national_coach?: string | null
          programme?: string | null
          programme_review?: Json | null
          region?: string | null
          report_date?: string
          report_pdf_url?: string | null
          report_title: string
          talent_characteristics?: Json | null
          updated_at?: string
          weekly_schedule?: string | null
        }
        Update: {
          child_id?: string
          coach_comments?: string | null
          competitive_schedule?: string | null
          county?: string | null
          created_at?: string
          id?: string
          individual_coach?: string | null
          national_coach?: string | null
          programme?: string | null
          programme_review?: Json | null
          region?: string | null
          report_date?: string
          report_pdf_url?: string | null
          report_title?: string
          talent_characteristics?: Json | null
          updated_at?: string
          weekly_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_reports_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      player_watch: {
        Row: {
          accent: string
          achievements: string[]
          badge: string | null
          created_at: string
          description: string | null
          display_order: number
          gallery: Json
          id: string
          main_image_url: string | null
          name: string
          published: boolean
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          accent?: string
          achievements?: string[]
          badge?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          gallery?: Json
          id?: string
          main_image_url?: string | null
          name: string
          published?: boolean
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          accent?: string
          achievements?: string[]
          badge?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          gallery?: Json
          id?: string
          main_image_url?: string | null
          name?: string
          published?: boolean
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_city: string | null
          address_line1: string | null
          address_line2: string | null
          address_postcode: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          newsletter_subscribed: boolean
          parent_notes: string | null
          phone: string | null
          player_age_group: string | null
          player_name: string | null
          playing_ability: string | null
          plays_tennis: boolean
          primary_phone: string | null
          secondary_phone: string | null
          sponsorship_company: string | null
          sponsorship_details: string | null
          sponsorship_interest: boolean
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postcode?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          newsletter_subscribed?: boolean
          parent_notes?: string | null
          phone?: string | null
          player_age_group?: string | null
          player_name?: string | null
          playing_ability?: string | null
          plays_tennis?: boolean
          primary_phone?: string | null
          secondary_phone?: string | null
          sponsorship_company?: string | null
          sponsorship_details?: string | null
          sponsorship_interest?: boolean
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postcode?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          newsletter_subscribed?: boolean
          parent_notes?: string | null
          phone?: string | null
          player_age_group?: string | null
          player_name?: string | null
          playing_ability?: string | null
          plays_tennis?: boolean
          primary_phone?: string | null
          secondary_phone?: string | null
          sponsorship_company?: string | null
          sponsorship_details?: string | null
          sponsorship_interest?: boolean
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sporting_schedule: {
        Row: {
          category: string
          child_id: string
          created_at: string
          duration_minutes: number
          end_time: string | null
          event_date: string
          id: string
          is_tournament: boolean
          location: string | null
          notes: string | null
          parent_user_id: string
          recurrence_end_date: string | null
          recurrence_group_id: string | null
          recurrence_rule: string | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          child_id: string
          created_at?: string
          duration_minutes?: number
          end_time?: string | null
          event_date: string
          id?: string
          is_tournament?: boolean
          location?: string | null
          notes?: string | null
          parent_user_id: string
          recurrence_end_date?: string | null
          recurrence_group_id?: string | null
          recurrence_rule?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          child_id?: string
          created_at?: string
          duration_minutes?: number
          end_time?: string | null
          event_date?: string
          id?: string
          is_tournament?: boolean
          location?: string | null
          notes?: string | null
          parent_user_id?: string
          recurrence_end_date?: string | null
          recurrence_group_id?: string | null
          recurrence_rule?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sporting_schedule_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      suffolk_news: {
        Row: {
          article_date: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          media: Json
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          article_date?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          media?: Json
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          article_date?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          media?: Json
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tennis_goals: {
        Row: {
          category: string
          child_id: string
          completed: boolean
          created_at: string
          description: string | null
          id: string
          parent_user_id: string
          progress: number
          set_by: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          child_id: string
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          parent_user_id: string
          progress?: number
          set_by?: string | null
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          child_id?: string
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          parent_user_id?: string
          progress?: number
          set_by?: string | null
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tennis_goals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_scans: {
        Row: {
          id: string
          result: string
          scanned_at: string
          scanned_by: string | null
          session_id: string | null
          ticket_id: string
        }
        Insert: {
          id?: string
          result: string
          scanned_at?: string
          scanned_by?: string | null
          session_id?: string | null
          ticket_id: string
        }
        Update: {
          id?: string
          result?: string
          scanned_at?: string
          scanned_by?: string | null
          session_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_scans_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_scans_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          booking_id: string
          event_id: string
          id: string
          issued_at: string
          qr_token: string
          status: string
        }
        Insert: {
          booking_id: string
          event_id: string
          id?: string
          issued_at?: string
          qr_token?: string
          status?: string
        }
        Update: {
          booking_id?: string
          event_id?: string
          id?: string
          issued_at?: string
          qr_token?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          detail: string | null
          display_order: number
          google_maps_url: string | null
          highlights: Json
          id: string
          image_url: string | null
          intro: string | null
          location: string | null
          logo_bg_color: string | null
          logo_url: string | null
          name: string
          published: boolean
          slug: string | null
          tagline: string | null
          updated_at: string
          venue_type: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          detail?: string | null
          display_order?: number
          google_maps_url?: string | null
          highlights?: Json
          id?: string
          image_url?: string | null
          intro?: string | null
          location?: string | null
          logo_bg_color?: string | null
          logo_url?: string | null
          name: string
          published?: boolean
          slug?: string | null
          tagline?: string | null
          updated_at?: string
          venue_type?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          detail?: string | null
          display_order?: number
          google_maps_url?: string | null
          highlights?: Json
          id?: string
          image_url?: string | null
          intro?: string | null
          location?: string | null
          logo_bg_color?: string | null
          logo_url?: string | null
          name?: string
          published?: boolean
          slug?: string | null
          tagline?: string | null
          updated_at?: string
          venue_type?: string
          website_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_parent_emails: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "parent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "parent"],
    },
  },
} as const
