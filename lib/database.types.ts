export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      accounts: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          initial_balance: number
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          initial_balance?: number
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          initial_balance?: number
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          id: string
          name: string
          type: Database["public"]["Enums"]["category_type"]
          user_id: string
        }
        Insert: {
          color: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["category_type"]
          user_id: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["category_type"]
          user_id?: string
        }
        Relationships: []
      }
      due_items: {
        Row: {
          account_id: string | null
          amount: number
          auto_renew: boolean
          category: string
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          due_date: string
          frequency: Database["public"]["Enums"]["due_frequency"]
          id: string
          paid_at: string | null
          reminder_days_before: number
          status: Database["public"]["Enums"]["due_status"]
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          auto_renew?: boolean
          category: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          due_date: string
          frequency: Database["public"]["Enums"]["due_frequency"]
          id?: string
          paid_at?: string | null
          reminder_days_before?: number
          status?: Database["public"]["Enums"]["due_status"]
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          auto_renew?: boolean
          category?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          due_date?: string
          frequency?: Database["public"]["Enums"]["due_frequency"]
          id?: string
          paid_at?: string | null
          reminder_days_before?: number
          status?: Database["public"]["Enums"]["due_status"]
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          achieved_at: string | null
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          priority: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          amount: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          priority: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          name?: string
          priority?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stock_trades: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          occurred_at: string
          price: number
          shares: number
          side: Database["public"]["Enums"]["trade_side"]
          symbol: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          occurred_at: string
          price: number
          shares: number
          side: Database["public"]["Enums"]["trade_side"]
          symbol: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          occurred_at?: string
          price?: number
          shares?: number
          side?: Database["public"]["Enums"]["trade_side"]
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          exchange_rate: number | null
          id: string
          note: string | null
          occurred_at: string
          receipt_name: string | null
          to_account_id: string | null
          to_amount: number | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          exchange_rate?: number | null
          id?: string
          note?: string | null
          occurred_at: string
          receipt_name?: string | null
          to_account_id?: string | null
          to_amount?: number | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          exchange_rate?: number | null
          id?: string
          note?: string | null
          occurred_at?: string
          receipt_name?: string | null
          to_account_id?: string | null
          to_amount?: number | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          annual_devaluation: number
          annual_inflation: number
          annual_return: number
          annual_return_ars: number
          annual_return_usd: number
          exchange_rate: number
          manual_initial_ars: number | null
          manual_initial_usd: number | null
          monthly_savings_ars: number
          monthly_savings_usd: number
          monthly_savings_source: string
          projection_display_currency: Database["public"]["Enums"]["currency"]
          projection_horizon_months: number
          projection_real_terms: boolean
          projection_use_real_accounts: boolean
          rates: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_devaluation?: number
          annual_inflation?: number
          annual_return?: number
          annual_return_ars?: number
          annual_return_usd?: number
          exchange_rate?: number
          manual_initial_ars?: number | null
          manual_initial_usd?: number | null
          monthly_savings_ars?: number
          monthly_savings_usd?: number
          monthly_savings_source?: string
          projection_display_currency?: Database["public"]["Enums"]["currency"]
          projection_horizon_months?: number
          projection_real_terms?: boolean
          projection_use_real_accounts?: boolean
          rates?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_devaluation?: number
          annual_inflation?: number
          annual_return?: number
          annual_return_ars?: number
          annual_return_usd?: number
          exchange_rate?: number
          manual_initial_ars?: number | null
          manual_initial_usd?: number | null
          monthly_savings_ars?: number
          monthly_savings_usd?: number
          monthly_savings_source?: string
          projection_display_currency?: Database["public"]["Enums"]["currency"]
          projection_horizon_months?: number
          projection_real_terms?: boolean
          projection_use_real_accounts?: boolean
          rates?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicle_logs: {
        Row: {
          account_id: string | null
          amount: number
          gas_station: string | null
          id: string
          is_full_tank: boolean | null
          item_name: string | null
          liters: number | null
          next_service_date: string | null
          next_service_odometer: number | null
          note: string | null
          occurred_at: string
          odometer: number
          price_per_liter: number | null
          provider: string | null
          service_type: string | null
          transaction_id: string | null
          type: Database["public"]["Enums"]["vehicle_log_type"]
          user_id: string
          vehicle_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          gas_station?: string | null
          id?: string
          is_full_tank?: boolean | null
          item_name?: string | null
          liters?: number | null
          next_service_date?: string | null
          next_service_odometer?: number | null
          note?: string | null
          occurred_at: string
          odometer?: number
          price_per_liter?: number | null
          provider?: string | null
          service_type?: string | null
          transaction_id?: string | null
          type: Database["public"]["Enums"]["vehicle_log_type"]
          user_id: string
          vehicle_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          gas_station?: string | null
          id?: string
          is_full_tank?: boolean | null
          item_name?: string | null
          liters?: number | null
          next_service_date?: string | null
          next_service_odometer?: number | null
          note?: string | null
          occurred_at?: string
          odometer?: number
          price_per_liter?: number | null
          provider?: string | null
          service_type?: string | null
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["vehicle_log_type"]
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          created_at: string
          fuel_capacity: number | null
          id: string
          model: string | null
          name: string
          odometer: number
          plate: string | null
          type: Database["public"]["Enums"]["vehicle_type"]
          user_id: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          fuel_capacity?: number | null
          id?: string
          model?: string | null
          name: string
          odometer?: number
          plate?: string | null
          type: Database["public"]["Enums"]["vehicle_type"]
          user_id: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          fuel_capacity?: number | null
          id?: string
          model?: string | null
          name?: string
          odometer?: number
          plate?: string | null
          type?: Database["public"]["Enums"]["vehicle_type"]
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          added_at: string
          name: string
          symbol: string
          user_id: string
        }
        Insert: {
          added_at?: string
          name: string
          symbol: string
          user_id: string
        }
        Update: {
          added_at?: string
          name?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      account_balances: {
        Row: {
          balance: number | null
          currency: Database["public"]["Enums"]["currency"] | null
          id: string | null
          initial_balance: number | null
          kind: Database["public"]["Enums"]["account_kind"] | null
          name: string | null
          user_id: string | null
        }
        Relationships: []
      }
      stock_positions: {
        Row: {
          avg_buy_price: number | null
          shares: number | null
          symbol: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assert_no_overdraft: { Args: { p_ids: string[] }; Returns: undefined }
      create_transaction: {
        Args: {
          p_account_id: string
          p_amount: number
          p_category: string
          p_exchange_rate?: number
          p_note?: string
          p_occurred_at?: string
          p_receipt_name?: string
          p_to_account_id?: string
          p_to_amount?: number
          p_type: Database["public"]["Enums"]["transaction_type"]
          p_vehicle_id?: string
        }
        Returns: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          exchange_rate: number | null
          id: string
          note: string | null
          occurred_at: string
          receipt_name: string | null
          to_account_id: string | null
          to_amount: number | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          vehicle_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_vehicle_log: {
        Args: {
          p_account_id?: string
          p_amount: number
          p_extra?: Json
          p_note?: string
          p_occurred_at: string
          p_odometer: number
          p_type: Database["public"]["Enums"]["vehicle_log_type"]
          p_vehicle_id: string
        }
        Returns: {
          account_id: string | null
          amount: number
          gas_station: string | null
          id: string
          is_full_tank: boolean | null
          item_name: string | null
          liters: number | null
          next_service_date: string | null
          next_service_odometer: number | null
          note: string | null
          occurred_at: string
          odometer: number
          price_per_liter: number | null
          provider: string | null
          service_type: string | null
          transaction_id: string | null
          type: Database["public"]["Enums"]["vehicle_log_type"]
          user_id: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vehicle_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_vehicle: { Args: { p_id: string }; Returns: undefined }
      delete_vehicle_log: { Args: { p_id: string }; Returns: undefined }
      execute_stock_trade: {
        Args: {
          p_account_id: string
          p_occurred_at?: string
          p_price: number
          p_shares: number
          p_side: Database["public"]["Enums"]["trade_side"]
          p_symbol: string
        }
        Returns: {
          account_id: string | null
          created_at: string
          id: string
          occurred_at: string
          price: number
          shares: number
          side: Database["public"]["Enums"]["trade_side"]
          symbol: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "stock_trades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lock_accounts: { Args: { p_ids: string[] }; Returns: undefined }
      next_due_date: {
        Args: {
          p_date: string
          p_frequency: Database["public"]["Enums"]["due_frequency"]
        }
        Returns: string
      }
      pay_due_item: {
        Args: {
          p_account_id?: string
          p_amount?: number
          p_category?: string
          p_id: string
          p_note?: string
        }
        Returns: {
          account_id: string | null
          amount: number
          auto_renew: boolean
          category: string
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          due_date: string
          frequency: Database["public"]["Enums"]["due_frequency"]
          id: string
          paid_at: string | null
          reminder_days_before: number
          status: Database["public"]["Enums"]["due_status"]
          title: string
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "due_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_transaction: {
        Args: {
          p_account_id: string
          p_amount: number
          p_category: string
          p_exchange_rate?: number
          p_id: string
          p_note?: string
          p_occurred_at: string
          p_receipt_name?: string
          p_to_account_id?: string
          p_to_amount?: number
          p_type: Database["public"]["Enums"]["transaction_type"]
          p_vehicle_id?: string
        }
        Returns: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          exchange_rate: number | null
          id: string
          note: string | null
          occurred_at: string
          receipt_name: string | null
          to_account_id: string | null
          to_amount: number | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          vehicle_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_kind: "bank" | "wallet" | "cash" | "crypto" | "savings"
      category_type: "income" | "expense"
      currency: "ARS" | "USD"
      due_frequency: "monthly" | "yearly" | "biweekly" | "one_time"
      due_status: "pending" | "paid"
      goal_kind: "reserve" | "purchase"
      trade_side: "buy" | "sell"
      transaction_type: "income" | "expense" | "transfer"
      vehicle_log_type:
        | "fuel"
        | "service"
        | "part"
        | "gear"
        | "insurance"
        | "other"
      vehicle_type: "motorcycle" | "car" | "truck" | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_kind: ["bank", "wallet", "cash", "crypto", "savings"],
      category_type: ["income", "expense"],
      currency: ["ARS", "USD"],
      due_frequency: ["monthly", "yearly", "biweekly", "one_time"],
      due_status: ["pending", "paid"],
      trade_side: ["buy", "sell"],
      transaction_type: ["income", "expense", "transfer"],
      vehicle_log_type: [
        "fuel",
        "service",
        "part",
        "gear",
        "insurance",
        "other",
      ],
      vehicle_type: ["motorcycle", "car", "truck", "other"],
    },
  },
} as const

