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
      game_sessions: {
        Row: {
          code: string
          created_at: string
          current_question_index: number
          current_question_started_at: string | null
          ended_at: string | null
          id: string
          quiz_id: string
          settings: Json
          started_at: string | null
          status: string
          teacher_id: string
        }
        Insert: {
          code: string
          created_at?: string
          current_question_index?: number
          current_question_started_at?: string | null
          ended_at?: string | null
          id?: string
          quiz_id: string
          settings?: Json
          started_at?: string | null
          status?: string
          teacher_id: string
        }
        Update: {
          code?: string
          created_at?: string
          current_question_index?: number
          current_question_started_at?: string | null
          ended_at?: string | null
          id?: string
          quiz_id?: string
          settings?: Json
          started_at?: string | null
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      game_students: {
        Row: {
          approved: boolean
          correct_answers: number
          crypto: number
          hacks_made: number
          hacks_received: number
          id: string
          is_breached: boolean
          joined_at: string
          name: string
          password: string | null
          session_id: string
          total_answers: number
        }
        Insert: {
          approved?: boolean
          correct_answers?: number
          crypto?: number
          hacks_made?: number
          hacks_received?: number
          id?: string
          is_breached?: boolean
          joined_at?: string
          name: string
          password?: string | null
          session_id: string
          total_answers?: number
        }
        Update: {
          approved?: boolean
          correct_answers?: number
          crypto?: number
          hacks_made?: number
          hacks_received?: number
          id?: string
          is_breached?: boolean
          joined_at?: string
          name?: string
          password?: string | null
          session_id?: string
          total_answers?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hack_events: {
        Row: {
          created_at: string
          crypto_transferred: number
          hacker_id: string
          id: string
          password_attempted: string | null
          session_id: string
          success: boolean
          target_id: string
        }
        Insert: {
          created_at?: string
          crypto_transferred?: number
          hacker_id: string
          id?: string
          password_attempted?: string | null
          session_id: string
          success: boolean
          target_id: string
        }
        Update: {
          created_at?: string
          crypto_transferred?: number
          hacker_id?: string
          id?: string
          password_attempted?: string | null
          session_id?: string
          success?: boolean
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hack_events_hacker_id_fkey"
            columns: ["hacker_id"]
            isOneToOne: false
            referencedRelation: "game_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hack_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hack_events_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "game_students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_responses: {
        Row: {
          answer_index: number
          answered_at: string
          id: string
          is_correct: boolean
          question_id: string
          question_index: number
          session_id: string
          student_id: string
        }
        Insert: {
          answer_index: number
          answered_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          question_index: number
          session_id: string
          student_id: string
        }
        Update: {
          answer_index?: number
          answered_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          question_index?: number
          session_id?: string
          student_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_index: number
          created_at: string
          difficulty: string
          id: string
          image_url: string | null
          options: Json
          position: number
          quiz_id: string
          text: string
        }
        Insert: {
          correct_index: number
          created_at?: string
          difficulty?: string
          id?: string
          image_url?: string | null
          options: Json
          position?: number
          quiz_id: string
          text: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          difficulty?: string
          id?: string
          image_url?: string | null
          options?: Json
          position?: number
          quiz_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          grade_level: string | null
          id: string
          source: string
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          grade_level?: string | null
          id?: string
          source?: string
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          grade_level?: string | null
          id?: string
          source?: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dodgeball_add_life: {
        Args: { p_student_id: string }
        Returns: { lives: number; eliminated: boolean }[]
      }
      dodgeball_apply_answer: {
        Args: { p_student_id: string; p_correct: boolean }
        Returns: { lives: number; eliminated: boolean }[]
      }
      hvz_apply_answer: {
        Args: {
          p_student_id: string
          p_correct: boolean
          p_streak_protected: boolean
          p_drop_by: number | null
          p_cash_delta: number
          p_loss_pct: number
        }
        Returns: { crypto: number; streak: number; correct_answers: number; total_answers: number }[]
      }
      hvz_spend_cash: {
        Args: {
          p_student_id: string
          p_cost: number
          p_income_tier?: number | null
          p_streak_drain_tier?: number | null
          p_cash_insurance_tier?: number | null
        }
        Returns: { crypto: number; income_tier: number; streak_drain_tier: number; cash_insurance_tier: number }[]
      }
      hvz_credit_cash: {
        Args: { p_student_id: string; p_amount: number }
        Returns: { crypto: number }[]
      }
      lava_floor_apply_answer: {
        Args: { p_student_id: string; p_correct: boolean; p_payout: number }
        Returns: { crypto: number; streak: number; correct_answers: number; total_answers: number; hacks_received: number }[]
      }
      lava_floor_spend: {
        Args: { p_student_id: string; p_cost: number; p_income_tier?: number | null; p_streak_tier?: number | null }
        Returns: { crypto: number; income_tier: number; streak_tier: number }[]
      }
      dld_apply_answer: {
        Args: {
          p_student_id: string
          p_correct: boolean
          p_drop_by: number | null
          p_cash_delta: number
          p_loss_pct: number
        }
        Returns: { crypto: number; streak: number; correct_answers: number; total_answers: number }[]
      }
      dld_void_fall: {
        Args: { p_student_id: string; p_loss_pct: number }
        Returns: { crypto: number }[]
      }
      dld_spend: {
        Args: {
          p_student_id: string
          p_cost: number
          p_income_tier?: number | null
          p_streak_drain_tier?: number | null
          p_cash_insurance_tier?: number | null
          p_energy_tier?: number | null
          p_battery_tier?: number | null
          p_double_jump?: boolean | null
        }
        Returns: {
          crypto: number
          income_tier: number
          streak_drain_tier: number
          cash_insurance_tier: number
          energy_tier: number
          battery_tier: number
          double_jump: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
