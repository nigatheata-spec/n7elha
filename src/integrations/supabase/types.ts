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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      blog_posts: {
        Row: {
          body_ar: string
          body_en: string
          excerpt_ar: string
          excerpt_en: string
          id: string
          published_at: string
          slug: string
          title_ar: string
          title_en: string
        }
        Insert: {
          body_ar: string
          body_en: string
          excerpt_ar: string
          excerpt_en: string
          id?: string
          published_at?: string
          slug: string
          title_ar: string
          title_en: string
        }
        Update: {
          body_ar?: string
          body_en?: string
          excerpt_ar?: string
          excerpt_en?: string
          id?: string
          published_at?: string
          slug?: string
          title_ar?: string
          title_en?: string
        }
        Relationships: []
      }
      dodgeball_timer_taps: {
        Row: {
          created_at: string | null
          elapsed_ms: number
          id: string
          session_id: string
          student_id: string
          timer_round_id: string
        }
        Insert: {
          created_at?: string | null
          elapsed_ms: number
          id?: string
          session_id: string
          student_id: string
          timer_round_id: string
        }
        Update: {
          created_at?: string | null
          elapsed_ms?: number
          id?: string
          session_id?: string
          student_id?: string
          timer_round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dodgeball_timer_taps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dodgeball_timer_taps_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "game_students"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          code: string
          created_at: string
          current_question_index: number
          current_question_started_at: string | null
          ended_at: string | null
          id: string
          kit_id: string | null
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
          kit_id?: string | null
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
          kit_id?: string | null
          quiz_id?: string
          settings?: Json
          started_at?: string | null
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
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
          avatar_color: number | null
          avatar_face: number | null
          battery_tier: number
          cash_insurance_tier: number
          checkpoint_index: number
          correct_answers: number
          crypto: number
          double_jump: boolean
          eliminated: boolean
          eliminated_at: string | null
          energy_tier: number
          fight_hue: number | null
          hacks_made: number
          hacks_received: number
          height_reached: number
          id: string
          income_tier: number
          is_breached: boolean
          joined_at: string
          lives: number
          name: string
          password: string | null
          session_id: string
          streak: number
          streak_drain_tier: number
          streak_tier: number
          team: string | null
          total_answers: number
        }
        Insert: {
          approved?: boolean
          avatar_color?: number | null
          avatar_face?: number | null
          battery_tier?: number
          cash_insurance_tier?: number
          checkpoint_index?: number
          correct_answers?: number
          crypto?: number
          double_jump?: boolean
          eliminated?: boolean
          eliminated_at?: string | null
          energy_tier?: number
          fight_hue?: number | null
          hacks_made?: number
          hacks_received?: number
          height_reached?: number
          id?: string
          income_tier?: number
          is_breached?: boolean
          joined_at?: string
          lives?: number
          name: string
          password?: string | null
          session_id: string
          streak?: number
          streak_drain_tier?: number
          streak_tier?: number
          team?: string | null
          total_answers?: number
        }
        Update: {
          approved?: boolean
          avatar_color?: number | null
          avatar_face?: number | null
          battery_tier?: number
          cash_insurance_tier?: number
          checkpoint_index?: number
          correct_answers?: number
          crypto?: number
          double_jump?: boolean
          eliminated?: boolean
          eliminated_at?: string | null
          energy_tier?: number
          fight_hue?: number | null
          hacks_made?: number
          hacks_received?: number
          height_reached?: number
          id?: string
          income_tier?: number
          is_breached?: boolean
          joined_at?: string
          lives?: number
          name?: string
          password?: string | null
          session_id?: string
          streak?: number
          streak_drain_tier?: number
          streak_tier?: number
          team?: string | null
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
      hvz_actions: {
        Row: {
          action_key: string
          blur_ms: number | null
          blur_target_team: string | null
          buff_ms: number | null
          buff_team: string | null
          buff_type: string | null
          cost: number
          created_at: string | null
          effect: Json
          freeze_ms: number | null
          freeze_target_team: string | null
          health_delta: number
          id: string
          infection_delta: number
          max_health_delta: number
          session_id: string
          student_id: string
          student_name: string
          team: string
        }
        Insert: {
          action_key: string
          blur_ms?: number | null
          blur_target_team?: string | null
          buff_ms?: number | null
          buff_team?: string | null
          buff_type?: string | null
          cost: number
          created_at?: string | null
          effect?: Json
          freeze_ms?: number | null
          freeze_target_team?: string | null
          health_delta?: number
          id?: string
          infection_delta?: number
          max_health_delta?: number
          session_id: string
          student_id: string
          student_name: string
          team: string
        }
        Update: {
          action_key?: string
          blur_ms?: number | null
          blur_target_team?: string | null
          buff_ms?: number | null
          buff_team?: string | null
          buff_type?: string | null
          cost?: number
          created_at?: string | null
          effect?: Json
          freeze_ms?: number | null
          freeze_target_team?: string | null
          health_delta?: number
          id?: string
          infection_delta?: number
          max_health_delta?: number
          session_id?: string
          student_id?: string
          student_name?: string
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "hvz_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hvz_actions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "game_students"
            referencedColumns: ["id"]
          },
        ]
      }
      kits: {
        Row: {
          created_at: string
          id: string
          label: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id: string
          label?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          status?: string
        }
        Relationships: []
      }
      lava_floor_builds: {
        Row: {
          block_type: string
          cost: number
          created_at: string | null
          height_added: number
          id: string
          session_id: string
          student_id: string
          student_name: string
        }
        Insert: {
          block_type: string
          cost: number
          created_at?: string | null
          height_added: number
          id?: string
          session_id: string
          student_id: string
          student_name: string
        }
        Update: {
          block_type?: string
          cost?: number
          created_at?: string | null
          height_added?: number
          id?: string
          session_id?: string
          student_id?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lava_floor_builds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lava_floor_builds_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "game_students"
            referencedColumns: ["id"]
          },
        ]
      }
      paint_fight_powerups: {
        Row: {
          cell_index: number
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          id: string
          kind: string
          session_id: string
        }
        Insert: {
          cell_index: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          id?: string
          kind: string
          session_id: string
        }
        Update: {
          cell_index?: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          id?: string
          kind?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paint_fight_powerups_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "game_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paint_fight_powerups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      paint_fight_strokes: {
        Row: {
          cell_indices: number[]
          created_at: string | null
          hue: number
          id: string
          session_id: string
          student_id: string
        }
        Insert: {
          cell_indices: number[]
          created_at?: string | null
          hue: number
          id?: string
          session_id: string
          student_id: string
        }
        Update: {
          cell_indices?: number[]
          created_at?: string | null
          hue?: number
          id?: string
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paint_fight_strokes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paint_fight_strokes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "game_students"
            referencedColumns: ["id"]
          },
        ]
      }
      physical_last_scan: {
        Row: {
          dispensed_at: string
          question_id: string | null
          session_id: string
          type_code: number
        }
        Insert: {
          dispensed_at?: string
          question_id?: string | null
          session_id: string
          type_code: number
        }
        Update: {
          dispensed_at?: string
          question_id?: string | null
          session_id?: string
          type_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "physical_last_scan_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physical_last_scan_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      physical_used_questions: {
        Row: {
          question_id: string
          session_id: string
          used_at: string
        }
        Insert: {
          question_id: string
          session_id: string
          used_at?: string
        }
        Update: {
          question_id?: string
          session_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "physical_used_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physical_used_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
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
      auto_end_stale_sessions: { Args: never; Returns: number }
      dld_apply_answer: {
        Args: {
          p_cash_delta: number
          p_correct: boolean
          p_drop_by: number
          p_loss_pct: number
          p_student_id: string
        }
        Returns: {
          correct_answers: number
          crypto: number
          streak: number
          total_answers: number
        }[]
      }
      dld_spend: {
        Args: {
          p_battery_tier?: number
          p_cash_insurance_tier?: number
          p_cost: number
          p_double_jump?: boolean
          p_energy_tier?: number
          p_income_tier?: number
          p_streak_drain_tier?: number
          p_student_id: string
        }
        Returns: {
          battery_tier: number
          cash_insurance_tier: number
          crypto: number
          double_jump: boolean
          energy_tier: number
          income_tier: number
          streak_drain_tier: number
        }[]
      }
      dld_void_fall: {
        Args: { p_loss_pct: number; p_student_id: string }
        Returns: {
          crypto: number
        }[]
      }
      dodgeball_add_life: {
        Args: { p_student_id: string }
        Returns: {
          eliminated: boolean
          lives: number
        }[]
      }
      dodgeball_apply_answer: {
        Args: { p_correct: boolean; p_student_id: string }
        Returns: {
          eliminated: boolean
          lives: number
        }[]
      }
      hvz_apply_answer: {
        Args: {
          p_cash_delta: number
          p_correct: boolean
          p_drop_by: number
          p_loss_pct: number
          p_streak_protected: boolean
          p_student_id: string
        }
        Returns: {
          correct_answers: number
          crypto: number
          streak: number
          total_answers: number
        }[]
      }
      hvz_credit_cash: {
        Args: { p_amount: number; p_student_id: string }
        Returns: {
          crypto: number
        }[]
      }
      hvz_spend_cash: {
        Args: {
          p_cash_insurance_tier?: number
          p_cost: number
          p_income_tier?: number
          p_streak_drain_tier?: number
          p_student_id: string
        }
        Returns: {
          cash_insurance_tier: number
          crypto: number
          income_tier: number
          streak_drain_tier: number
        }[]
      }
      lava_floor_apply_answer: {
        Args: { p_correct: boolean; p_payout: number; p_student_id: string }
        Returns: {
          correct_answers: number
          crypto: number
          hacks_received: number
          streak: number
          total_answers: number
        }[]
      }
      lava_floor_spend: {
        Args: {
          p_cost: number
          p_income_tier?: number
          p_streak_tier?: number
          p_student_id: string
        }
        Returns: {
          crypto: number
          income_tier: number
          streak_tier: number
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
