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
      course_holes: {
        Row: {
          course_id: string
          distance_m: number | null
          hole_number: number
          id: string
          par: number
          stroke_index: number | null
          stroke_index_back: number | null
        }
        Insert: {
          course_id: string
          distance_m?: number | null
          hole_number: number
          id?: string
          par?: number
          stroke_index?: number | null
          stroke_index_back?: number | null
        }
        Update: {
          course_id?: string
          distance_m?: number | null
          hole_number?: number
          id?: string
          par?: number
          stroke_index?: number | null
          stroke_index_back?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_holes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          city: string | null
          country: string | null
          course_rating: number | null
          created_at: string
          created_by: string | null
          external_id: string | null
          external_source: string | null
          hole_count: number
          id: string
          name: string
          par_total: number | null
          slope_rating: number | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          course_rating?: number | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          external_source?: string | null
          hole_count?: number
          id?: string
          name: string
          par_total?: number | null
          slope_rating?: number | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          course_rating?: number | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          external_source?: string | null
          hole_count?: number
          id?: string
          name?: string
          par_total?: number | null
          slope_rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      flights: {
        Row: {
          created_at: string
          created_by: string | null
          flight_number: number
          id: string
          round_id: string
          status: Database["public"]["Enums"]["round_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          flight_number: number
          id?: string
          round_id: string
          status?: Database["public"]["Enums"]["round_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          flight_number?: number
          id?: string
          round_id?: string
          status?: Database["public"]["Enums"]["round_status"]
        }
        Relationships: [
          {
            foreignKeyName: "flights_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_penalty_rules: {
        Row: {
          amount: number
          code: string
          created_at: string
          group_id: string
          id: string
          is_automatic: boolean
          label: string
        }
        Insert: {
          amount?: number
          code: string
          created_at?: string
          group_id: string
          id?: string
          is_automatic?: boolean
          label: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          group_id?: string
          id?: string
          is_automatic?: boolean
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_penalty_rules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          has_penalty_fund: boolean
          id: string
          membership_fee: number
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          has_penalty_fund?: boolean
          id?: string
          membership_fee?: number
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          has_penalty_fund?: boolean
          id?: string
          membership_fee?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hole_scores: {
        Row: {
          created_at: string
          hole_number: number
          id: string
          par: number
          putts: number | null
          round_id: string
          round_player_id: string
          strokes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hole_number: number
          id?: string
          par?: number
          putts?: number | null
          round_id: string
          round_player_id: string
          strokes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hole_number?: number
          id?: string
          par?: number
          putts?: number | null
          round_id?: string
          round_player_id?: string
          strokes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hole_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hole_scores_round_player_id_fkey"
            columns: ["round_player_id"]
            isOneToOne: false
            referencedRelation: "round_players"
            referencedColumns: ["id"]
          },
        ]
      }
      penalties: {
        Row: {
          amount: number
          code: string
          created_at: string
          created_by: string | null
          group_id: string | null
          hole_number: number | null
          id: string
          is_automatic: boolean
          penalty_date: string | null
          points: number
          round_id: string
          round_player_id: string
        }
        Insert: {
          amount?: number
          code: string
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          hole_number?: number | null
          id?: string
          is_automatic?: boolean
          penalty_date?: string | null
          points?: number
          round_id: string
          round_player_id: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          hole_number?: number | null
          id?: string
          is_automatic?: boolean
          penalty_date?: string | null
          points?: number
          round_id?: string
          round_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "penalties_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "penalty_rules"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "penalties_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalties_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalties_round_player_id_fkey"
            columns: ["round_player_id"]
            isOneToOne: false
            referencedRelation: "round_players"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_rules: {
        Row: {
          amount: number
          code: string
          created_at: string
          description: string | null
          is_automatic: boolean
          label: string
          points: number
        }
        Insert: {
          amount?: number
          code: string
          created_at?: string
          description?: string | null
          is_automatic?: boolean
          label: string
          points?: number
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          description?: string | null
          is_automatic?: boolean
          label?: string
          points?: number
        }
        Relationships: []
      }
      player_locations: {
        Row: {
          accuracy_m: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          round_id: string
          round_player_id: string
        }
        Insert: {
          accuracy_m?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          round_id: string
          round_player_id: string
        }
        Update: {
          accuracy_m?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          round_id?: string
          round_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_locations_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_locations_round_player_id_fkey"
            columns: ["round_player_id"]
            isOneToOne: false
            referencedRelation: "round_players"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          default_tee: string
          display_name: string
          handicap: number | null
          handicap_index: number
          handle: string
          id: string
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          default_tee?: string
          display_name: string
          handicap?: number | null
          handicap_index?: number
          handle: string
          id: string
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          default_tee?: string
          display_name?: string
          handicap?: number | null
          handicap_index?: number
          handle?: string
          id?: string
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      round_players: {
        Row: {
          course_handicap: number | null
          created_at: string
          flight_id: string | null
          guest_name: string | null
          handicap_index: number | null
          id: string
          position: number
          profile_id: string | null
          round_id: string
          tee: string | null
          tee_box_id: string | null
        }
        Insert: {
          course_handicap?: number | null
          created_at?: string
          flight_id?: string | null
          guest_name?: string | null
          handicap_index?: number | null
          id?: string
          position?: number
          profile_id?: string | null
          round_id: string
          tee?: string | null
          tee_box_id?: string | null
        }
        Update: {
          course_handicap?: number | null
          created_at?: string
          flight_id?: string | null
          guest_name?: string | null
          handicap_index?: number | null
          id?: string
          position?: number
          profile_id?: string | null
          round_id?: string
          tee?: string | null
          tee_box_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_players_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_players_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_players_tee_box_id_fkey"
            columns: ["tee_box_id"]
            isOneToOne: false
            referencedRelation: "tee_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          course_id: string | null
          course_name: string
          created_at: string
          created_by: string
          group_id: string | null
          hole_count: number
          id: string
          name: string | null
          played_on: string
          status: Database["public"]["Enums"]["round_status"]
          updated_at: string
          with_penalties: boolean
        }
        Insert: {
          course_id?: string | null
          course_name: string
          created_at?: string
          created_by: string
          group_id?: string | null
          hole_count?: number
          id?: string
          name?: string | null
          played_on?: string
          status?: Database["public"]["Enums"]["round_status"]
          updated_at?: string
          with_penalties?: boolean
        }
        Update: {
          course_id?: string | null
          course_name?: string
          created_at?: string
          created_by?: string
          group_id?: string | null
          hole_count?: number
          id?: string
          name?: string | null
          played_on?: string
          status?: Database["public"]["Enums"]["round_status"]
          updated_at?: string
          with_penalties?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rounds_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tee_boxes: {
        Row: {
          course_id: string
          course_rating: number
          created_at: string
          id: string
          name: string
          slope: number
        }
        Insert: {
          course_id: string
          course_rating?: number
          created_at?: string
          id?: string
          name: string
          slope?: number
        }
        Update: {
          course_id?: string
          course_rating?: number
          created_at?: string
          id?: string
          name?: string
          slope?: number
        }
        Relationships: [
          {
            foreignKeyName: "tee_boxes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_round_via_group: {
        Args: { _round_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_round_participant: {
        Args: { _round_id: string; _user_id: string }
        Returns: boolean
      }
      penalty_hall_of_shame: {
        Args: never
        Returns: {
          display_name: string
          handle: string
          profile_id: string
          total_amount: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      round_status: "open" | "finished"
      user_type: "active" | "passive" | "guest"
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
      app_role: ["admin", "user"],
      round_status: ["open", "finished"],
      user_type: ["active", "passive", "guest"],
    },
  },
} as const
