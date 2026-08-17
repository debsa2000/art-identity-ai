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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_email_log: {
        Row: {
          body: string
          created_at: string
          error_message: string | null
          id: string
          kind: string
          recipient_email: string
          recipient_id: string
          send_status: string
          sent_by: string | null
          subject: string
          template_key: string | null
        }
        Insert: {
          body: string
          created_at?: string
          error_message?: string | null
          id?: string
          kind: string
          recipient_email: string
          recipient_id: string
          send_status?: string
          sent_by?: string | null
          subject: string
          template_key?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          recipient_email?: string
          recipient_id?: string
          send_status?: string
          sent_by?: string | null
          subject?: string
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_email_log_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_email_log_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          artist_id: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
        }
        Insert: {
          artist_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
        }
        Update: {
          artist_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
        }
        Relationships: []
      }
      ai_content: {
        Row: {
          artist_statement: string | null
          biography: string | null
          collection_description: string | null
          elevator_pitch: string | null
          generated_at: string | null
          homepage_copy: string | null
          instagram_bio: string | null
          is_public: boolean
          seo_description: string | null
          short_statement: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_statement?: string | null
          biography?: string | null
          collection_description?: string | null
          elevator_pitch?: string | null
          generated_at?: string | null
          homepage_copy?: string | null
          instagram_bio?: string | null
          is_public?: boolean
          seo_description?: string | null
          short_statement?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_statement?: string | null
          biography?: string | null
          collection_description?: string | null
          elevator_pitch?: string | null
          generated_at?: string | null
          homepage_copy?: string | null
          instagram_bio?: string | null
          is_public?: boolean
          seo_description?: string | null
          short_statement?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          artist_id: string
          created_at: string
          event_type: string
          id: number
          ref_id: string | null
        }
        Insert: {
          artist_id: string
          created_at?: string
          event_type: string
          id?: number
          ref_id?: string | null
        }
        Update: {
          artist_id?: string
          created_at?: string
          event_type?: string
          id?: number
          ref_id?: string | null
        }
        Relationships: []
      }
      artworks: {
        Row: {
          admin_notes: string | null
          admin_status: string
          collection_name: string | null
          created_at: string
          description: string | null
          dimensions: string | null
          featured: boolean
          height_cm: number | null
          id: string
          image_path: string | null
          medium: string | null
          mockup_error: string | null
          mockup_generated_at: string | null
          mockup_path: string | null
          mockup_source_hash: string | null
          mockups: Json
          price: number | null
          sort_order: number
          status: Database["public"]["Enums"]["artwork_status"]
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          width_cm: number | null
          year: number | null
        }
        Insert: {
          admin_notes?: string | null
          admin_status?: string
          collection_name?: string | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          featured?: boolean
          height_cm?: number | null
          id?: string
          image_path?: string | null
          medium?: string | null
          mockup_error?: string | null
          mockup_generated_at?: string | null
          mockup_path?: string | null
          mockup_source_hash?: string | null
          mockups?: Json
          price?: number | null
          sort_order?: number
          status?: Database["public"]["Enums"]["artwork_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          width_cm?: number | null
          year?: number | null
        }
        Update: {
          admin_notes?: string | null
          admin_status?: string
          collection_name?: string | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          featured?: boolean
          height_cm?: number | null
          id?: string
          image_path?: string | null
          medium?: string | null
          mockup_error?: string | null
          mockup_generated_at?: string | null
          mockup_path?: string | null
          mockup_source_hash?: string | null
          mockups?: Json
          price?: number | null
          sort_order?: number
          status?: Database["public"]["Enums"]["artwork_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          width_cm?: number | null
          year?: number | null
        }
        Relationships: []
      }
      galleries: {
        Row: {
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          instagram: string | null
          logo_path: string | null
          name: string | null
          published: boolean
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id: string
          instagram?: string | null
          logo_path?: string | null
          name?: string | null
          published?: boolean
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          logo_path?: string | null
          name?: string | null
          published?: boolean
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          artist_id: string
          budget: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["inquiry_status"]
        }
        Insert: {
          artist_id: string
          budget?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
        }
        Update: {
          artist_id?: string
          budget?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          source?: string | null
        }
        Relationships: []
      }
      makeover_sessions: {
        Row: {
          artist_name: string | null
          bio: string | null
          claim_token: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          description: string | null
          device_fp: string | null
          dimensions: string | null
          fallback_email: string | null
          height_cm: number | null
          id: string
          image_path: string
          insights: Json | null
          ip_hash: string | null
          medium: string | null
          mockups: Json
          score: number | null
          status: string
          sub_scores: Json | null
          title: string | null
          updated_at: string
          width_cm: number | null
        }
        Insert: {
          artist_name?: string | null
          bio?: string | null
          claim_token?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          description?: string | null
          device_fp?: string | null
          dimensions?: string | null
          fallback_email?: string | null
          height_cm?: number | null
          id?: string
          image_path: string
          insights?: Json | null
          ip_hash?: string | null
          medium?: string | null
          mockups?: Json
          score?: number | null
          status?: string
          sub_scores?: Json | null
          title?: string | null
          updated_at?: string
          width_cm?: number | null
        }
        Update: {
          artist_name?: string | null
          bio?: string | null
          claim_token?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          description?: string | null
          device_fp?: string | null
          dimensions?: string | null
          fallback_email?: string | null
          height_cm?: number | null
          id?: string
          image_path?: string
          insights?: Json | null
          ip_hash?: string | null
          medium?: string | null
          mockups?: Json
          score?: number | null
          status?: string
          sub_scores?: Json | null
          title?: string | null
          updated_at?: string
          width_cm?: number | null
        }
        Relationships: []
      }
      portfolio_credits: {
        Row: {
          purchased: number
          resume_bundle_purchased: number
          resume_bundle_used: number
          updated_at: string | null
          used: number
          user_id: string
        }
        Insert: {
          purchased?: number
          resume_bundle_purchased?: number
          resume_bundle_used?: number
          updated_at?: string | null
          used?: number
          user_id: string
        }
        Update: {
          purchased?: number
          resume_bundle_purchased?: number
          resume_bundle_used?: number
          updated_at?: string | null
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      processed_checkout_sessions: {
        Row: {
          price_id: string | null
          processed_at: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          price_id?: string | null
          processed_at?: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          price_id?: string | null
          processed_at?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profile_section_reviews: {
        Row: {
          admin_notes: string | null
          artist_feedback: string | null
          artist_id: string
          created_at: string
          reviewer_id: string | null
          section: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          artist_feedback?: string | null
          artist_id: string
          created_at?: string
          reviewer_id?: string | null
          section: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          artist_feedback?: string | null
          artist_id?: string
          created_at?: string
          reviewer_id?: string | null
          section?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_pricing_override: Json | null
          application_review_notes: string | null
          application_reviewed_at: string | null
          application_reviewed_by: string | null
          application_status: Database["public"]["Enums"]["application_status"]
          application_submitted_at: string | null
          artist_name: string | null
          avatar_path: string | null
          buyer_network_applied_at: string | null
          buyer_network_note: string | null
          buyer_network_reviewed_at: string | null
          buyer_network_reviewed_by: string | null
          buyer_network_status: Database["public"]["Enums"]["buyer_network_status"]
          city: string | null
          commission_available: boolean
          completion_percent: number
          country: string | null
          created_at: string
          cv: Json
          email: string | null
          exhibitions: string | null
          featured: boolean
          free_teaser_used: boolean
          id: string
          instagram: string | null
          languages: string[] | null
          last_login_at: string | null
          last_reminder_sent_at: string | null
          medium: string | null
          phone: string | null
          price_range: string | null
          public_listed: boolean
          published: boolean
          readiness_level: string | null
          readiness_recommendations: Json
          readiness_score: number | null
          readiness_updated_at: string | null
          reminder_count: number
          slug: string
          style: string | null
          updated_at: string
          website: string | null
          years_creating: number | null
        }
        Insert: {
          admin_pricing_override?: Json | null
          application_review_notes?: string | null
          application_reviewed_at?: string | null
          application_reviewed_by?: string | null
          application_status?: Database["public"]["Enums"]["application_status"]
          application_submitted_at?: string | null
          artist_name?: string | null
          avatar_path?: string | null
          buyer_network_applied_at?: string | null
          buyer_network_note?: string | null
          buyer_network_reviewed_at?: string | null
          buyer_network_reviewed_by?: string | null
          buyer_network_status?: Database["public"]["Enums"]["buyer_network_status"]
          city?: string | null
          commission_available?: boolean
          completion_percent?: number
          country?: string | null
          created_at?: string
          cv?: Json
          email?: string | null
          exhibitions?: string | null
          featured?: boolean
          free_teaser_used?: boolean
          id: string
          instagram?: string | null
          languages?: string[] | null
          last_login_at?: string | null
          last_reminder_sent_at?: string | null
          medium?: string | null
          phone?: string | null
          price_range?: string | null
          public_listed?: boolean
          published?: boolean
          readiness_level?: string | null
          readiness_recommendations?: Json
          readiness_score?: number | null
          readiness_updated_at?: string | null
          reminder_count?: number
          slug: string
          style?: string | null
          updated_at?: string
          website?: string | null
          years_creating?: number | null
        }
        Update: {
          admin_pricing_override?: Json | null
          application_review_notes?: string | null
          application_reviewed_at?: string | null
          application_reviewed_by?: string | null
          application_status?: Database["public"]["Enums"]["application_status"]
          application_submitted_at?: string | null
          artist_name?: string | null
          avatar_path?: string | null
          buyer_network_applied_at?: string | null
          buyer_network_note?: string | null
          buyer_network_reviewed_at?: string | null
          buyer_network_reviewed_by?: string | null
          buyer_network_status?: Database["public"]["Enums"]["buyer_network_status"]
          city?: string | null
          commission_available?: boolean
          completion_percent?: number
          country?: string | null
          created_at?: string
          cv?: Json
          email?: string | null
          exhibitions?: string | null
          featured?: boolean
          free_teaser_used?: boolean
          id?: string
          instagram?: string | null
          languages?: string[] | null
          last_login_at?: string | null
          last_reminder_sent_at?: string | null
          medium?: string | null
          phone?: string | null
          price_range?: string | null
          public_listed?: boolean
          published?: boolean
          readiness_level?: string | null
          readiness_recommendations?: Json
          readiness_score?: number | null
          readiness_updated_at?: string | null
          reminder_count?: number
          slug?: string
          style?: string | null
          updated_at?: string
          website?: string | null
          years_creating?: number | null
        }
        Relationships: []
      }
      questionnaires: {
        Row: {
          q1: string | null
          q10: string | null
          q2: string | null
          q3: string | null
          q4: string | null
          q5: string | null
          q6: string | null
          q7: string | null
          q8: string | null
          q9: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          q1?: string | null
          q10?: string | null
          q2?: string | null
          q3?: string | null
          q4?: string | null
          q5?: string | null
          q6?: string | null
          q7?: string | null
          q8?: string | null
          q9?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          q1?: string | null
          q10?: string | null
          q2?: string | null
          q3?: string | null
          q4?: string | null
          q5?: string | null
          q6?: string | null
          q7?: string | null
          q8?: string | null
          q9?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          admin_id: string | null
          amount_cents: number
          created_at: string
          currency: string
          environment: string
          id: string
          reason: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount_cents?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          reason?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount_cents?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          reason?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      super_admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
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
    }
    Views: {
      public_galleries: {
        Row: {
          bio: string | null
          city: string | null
          country: string | null
          created_at: string | null
          instagram: string | null
          logo_path: string | null
          name: string | null
          slug: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          instagram?: string | null
          logo_path?: string | null
          name?: string | null
          slug?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          instagram?: string | null
          logo_path?: string | null
          name?: string | null
          slug?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          artist_name: string | null
          avatar_path: string | null
          buyer_network_status:
            | Database["public"]["Enums"]["buyer_network_status"]
            | null
          city: string | null
          commission_available: boolean | null
          country: string | null
          created_at: string | null
          cv: Json | null
          exhibitions: string | null
          featured: boolean | null
          id: string | null
          instagram: string | null
          languages: string[] | null
          medium: string | null
          price_range: string | null
          published: boolean | null
          slug: string | null
          style: string | null
          updated_at: string | null
          website: string | null
          years_creating: number | null
        }
        Insert: {
          artist_name?: string | null
          avatar_path?: string | null
          buyer_network_status?:
            | Database["public"]["Enums"]["buyer_network_status"]
            | null
          city?: string | null
          commission_available?: boolean | null
          country?: string | null
          created_at?: string | null
          cv?: Json | null
          exhibitions?: string | null
          featured?: boolean | null
          id?: string | null
          instagram?: string | null
          languages?: string[] | null
          medium?: string | null
          price_range?: string | null
          published?: boolean | null
          slug?: string | null
          style?: string | null
          updated_at?: string | null
          website?: string | null
          years_creating?: number | null
        }
        Update: {
          artist_name?: string | null
          avatar_path?: string | null
          buyer_network_status?:
            | Database["public"]["Enums"]["buyer_network_status"]
            | null
          city?: string | null
          commission_available?: boolean | null
          country?: string | null
          created_at?: string | null
          cv?: Json | null
          exhibitions?: string | null
          featured?: boolean | null
          id?: string | null
          instagram?: string | null
          languages?: string[] | null
          medium?: string | null
          price_range?: string | null
          published?: boolean | null
          slug?: string | null
          style?: string | null
          updated_at?: string | null
          website?: string | null
          years_creating?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_active_buyer_network: {
        Args: { _env?: string; _user_id: string }
        Returns: boolean
      }
      has_approved_application: { Args: { _user_id: string }; Returns: boolean }
      has_publish_entitlement: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "artist" | "gallery" | "super_admin"
      application_status: "draft" | "submitted" | "approved" | "rejected"
      artwork_status: "available" | "sold" | "private"
      buyer_network_status:
        | "not_applied"
        | "pending_review"
        | "approved"
        | "rejected"
      inquiry_status: "new" | "read" | "replied" | "archived"
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
      app_role: ["admin", "artist", "gallery", "super_admin"],
      application_status: ["draft", "submitted", "approved", "rejected"],
      artwork_status: ["available", "sold", "private"],
      buyer_network_status: [
        "not_applied",
        "pending_review",
        "approved",
        "rejected",
      ],
      inquiry_status: ["new", "read", "replied", "archived"],
    },
  },
} as const
