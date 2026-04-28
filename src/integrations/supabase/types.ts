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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      administrators: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      api_rate_limit_state: {
        Row: {
          blocked_until: string | null
          cached_locations: Json | null
          cached_token: string | null
          consecutive_failures: number
          daily_call_count: number
          daily_reset_at: string
          id: string
          is_blocked: boolean
          last_success_at: string | null
          locations_expires_at: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          blocked_until?: string | null
          cached_locations?: Json | null
          cached_token?: string | null
          consecutive_failures?: number
          daily_call_count?: number
          daily_reset_at?: string
          id?: string
          is_blocked?: boolean
          last_success_at?: string | null
          locations_expires_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          blocked_until?: string | null
          cached_locations?: Json | null
          cached_token?: string | null
          consecutive_failures?: number
          daily_call_count?: number
          daily_reset_at?: string
          id?: string
          is_blocked?: boolean
          last_success_at?: string | null
          locations_expires_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          assignment_date: string
          created_at: string
          driver_id: string | null
          end_time: string | null
          id: string
          notes: string | null
          route_id: string
          start_time: string | null
          started_by_driver_id: string | null
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          assignment_date?: string
          created_at?: string
          driver_id?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          route_id: string
          start_time?: string | null
          started_by_driver_id?: string | null
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          assignment_date?: string
          created_at?: string
          driver_id?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          route_id?: string
          start_time?: string | null
          started_by_driver_id?: string | null
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_started_by_driver_id_fkey"
            columns: ["started_by_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          access_code: string | null
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          unit_id: string | null
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          unit_id?: string | null
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          unit_id?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_positions: {
        Row: {
          assignment_id: string | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          speed: number | null
          unit_id: string
        }
        Insert: {
          assignment_id?: string | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          speed?: number | null
          unit_id: string
        }
        Update: {
          assignment_id?: string | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_positions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_positions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_boardings: {
        Row: {
          assignment_id: string
          boarded_at: string
          driver_id: string | null
          id: string
          is_valid: boolean | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          passenger_qr_id: string | null
          qr_code_scanned: string
          route_id: string | null
          validation_message: string | null
        }
        Insert: {
          assignment_id: string
          boarded_at?: string
          driver_id?: string | null
          id?: string
          is_valid?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          passenger_qr_id?: string | null
          qr_code_scanned: string
          route_id?: string | null
          validation_message?: string | null
        }
        Update: {
          assignment_id?: string
          boarded_at?: string
          driver_id?: string | null
          id?: string
          is_valid?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          passenger_qr_id?: string | null
          qr_code_scanned?: string
          route_id?: string | null
          validation_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passenger_boardings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_boardings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_boardings_passenger_qr_id_fkey"
            columns: ["passenger_qr_id"]
            isOneToOne: false
            referencedRelation: "passenger_qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_boardings_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_qr_codes: {
        Row: {
          allowed_route_ids: string[] | null
          client_id: string
          created_at: string | null
          employee_id: string | null
          employee_name: string
          id: string
          is_active: boolean | null
          qr_code: string
          updated_at: string | null
        }
        Insert: {
          allowed_route_ids?: string[] | null
          client_id: string
          created_at?: string | null
          employee_id?: string | null
          employee_name: string
          id?: string
          is_active?: boolean | null
          qr_code?: string
          updated_at?: string | null
        }
        Update: {
          allowed_route_ids?: string[] | null
          client_id?: string
          created_at?: string | null
          employee_id?: string | null
          employee_name?: string
          id?: string
          is_active?: boolean | null
          qr_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passenger_qr_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          destination_address: string | null
          distance_km: number | null
          estimated_duration_minutes: number | null
          id: string
          is_active: boolean
          kml_file_path: string | null
          name: string
          origin_address: string | null
          stops: Json | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          destination_address?: string | null
          distance_km?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean
          kml_file_path?: string | null
          name: string
          origin_address?: string | null
          stops?: Json | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          destination_address?: string | null
          distance_km?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean
          kml_file_path?: string | null
          name?: string
          origin_address?: string | null
          stops?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_clients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          supervisor_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          supervisor_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_clients_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisors: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          brand: string | null
          capacity: number
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          imei: string | null
          is_active: boolean
          model: string | null
          notes: string | null
          plate_number: string
          updated_at: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          capacity?: number
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          imei?: string | null
          is_active?: boolean
          model?: string | null
          notes?: string | null
          plate_number: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          capacity?: number
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          imei?: string | null
          is_active?: boolean
          model?: string | null
          notes?: string | null
          plate_number?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_assignment_safely: { Args: { p_id: string }; Returns: boolean }
      driver_can_access_assignment: {
        Args: { assignment_unit_id: string }
        Returns: boolean
      }
      generate_access_code: { Args: never; Returns: string }
      get_driver_id: { Args: never; Returns: string }
      get_driver_route_ids: { Args: never; Returns: string[] }
      get_driver_unit_id: { Args: never; Returns: string }
      get_supervisor_client_ids: { Args: never; Returns: string[] }
      get_user_client_id: { Args: never; Returns: string }
      is_administrator: { Args: never; Returns: boolean }
      is_client_user: { Args: never; Returns: boolean }
      is_driver: { Args: never; Returns: boolean }
      is_supervisor: { Args: never; Returns: boolean }
      is_supervisor_or_admin: { Args: never; Returns: boolean }
      register_first_admin: {
        Args: { p_email: string; p_user_id: string }
        Returns: boolean
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
