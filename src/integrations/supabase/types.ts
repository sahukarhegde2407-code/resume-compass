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
      candidates: {
        Row: {
          analyzed_at: string | null
          created_at: string
          current_company: string | null
          current_job_title: string | null
          email: string | null
          error_message: string | null
          file_name: string
          file_path: string
          full_name: string
          id: string
          job_description_id: string
          parsed_education: Json
          parsed_experience: Json
          parsed_skills: string[]
          phone: string | null
          raw_text: string | null
          session_id: string
          status: Database["public"]["Enums"]["skillmatch_candidate_status"]
          total_experience_years: number | null
          updated_at: string
        }
        Insert: {
          analyzed_at?: string | null
          created_at?: string
          current_company?: string | null
          current_job_title?: string | null
          email?: string | null
          error_message?: string | null
          file_name: string
          file_path: string
          full_name?: string
          id?: string
          job_description_id: string
          parsed_education?: Json
          parsed_experience?: Json
          parsed_skills?: string[]
          phone?: string | null
          raw_text?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["skillmatch_candidate_status"]
          total_experience_years?: number | null
          updated_at?: string
        }
        Update: {
          analyzed_at?: string | null
          created_at?: string
          current_company?: string | null
          current_job_title?: string | null
          email?: string | null
          error_message?: string | null
          file_name?: string
          file_path?: string
          full_name?: string
          id?: string
          job_description_id?: string
          parsed_education?: Json
          parsed_experience?: Json
          parsed_skills?: string[]
          phone?: string | null
          raw_text?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["skillmatch_candidate_status"]
          total_experience_years?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_description_id_fkey"
            columns: ["job_description_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "screening_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_descriptions: {
        Row: {
          company: string
          created_at: string
          education_requirement: string | null
          id: string
          job_level: Database["public"]["Enums"]["skillmatch_job_level"]
          max_experience_years: number | null
          min_experience_years: number | null
          preferred_skills: string[]
          raw_text: string
          required_skills: string[]
          role_summary: string | null
          session_id: string
          title: string
          updated_at: string
        }
        Insert: {
          company?: string
          created_at?: string
          education_requirement?: string | null
          id?: string
          job_level?: Database["public"]["Enums"]["skillmatch_job_level"]
          max_experience_years?: number | null
          min_experience_years?: number | null
          preferred_skills?: string[]
          raw_text: string
          required_skills?: string[]
          role_summary?: string | null
          session_id: string
          title: string
          updated_at?: string
        }
        Update: {
          company?: string
          created_at?: string
          education_requirement?: string | null
          id?: string
          job_level?: Database["public"]["Enums"]["skillmatch_job_level"]
          max_experience_years?: number | null
          min_experience_years?: number | null
          preferred_skills?: string[]
          raw_text?: string
          required_skills?: string[]
          role_summary?: string | null
          session_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_descriptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "screening_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          ai_summary: string
          bonus_skills: string[]
          candidate_id: string
          concerns: string[]
          created_at: string
          id: string
          job_description_id: string
          keyword_score: number
          matched_skills: string[]
          missing_skills: string[]
          overall_score: number
          rank: number
          semantic_score: number
          session_id: string
          strengths: string[]
          updated_at: string
        }
        Insert: {
          ai_summary: string
          bonus_skills?: string[]
          candidate_id: string
          concerns?: string[]
          created_at?: string
          id?: string
          job_description_id: string
          keyword_score: number
          matched_skills?: string[]
          missing_skills?: string[]
          overall_score: number
          rank?: number
          semantic_score: number
          session_id: string
          strengths?: string[]
          updated_at?: string
        }
        Update: {
          ai_summary?: string
          bonus_skills?: string[]
          candidate_id?: string
          concerns?: string[]
          created_at?: string
          id?: string
          job_description_id?: string
          keyword_score?: number
          matched_skills?: string[]
          missing_skills?: string[]
          overall_score?: number
          rank?: number
          semantic_score?: number
          session_id?: string
          strengths?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_results_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_job_description_id_fkey"
            columns: ["job_description_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "screening_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_sessions: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          session_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          session_token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          session_token?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      skillmatch_candidate_status:
        | "pending"
        | "processing"
        | "analyzed"
        | "shortlisted"
        | "rejected"
        | "failed"
      skillmatch_job_level: "Junior" | "Mid" | "Senior" | "Lead"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      skillmatch_candidate_status: [
        "pending",
        "processing",
        "analyzed",
        "shortlisted",
        "rejected",
        "failed",
      ],
      skillmatch_job_level: ["Junior", "Mid", "Senior", "Lead"],
    },
  },
} as const
