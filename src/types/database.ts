export type AppRole = "admin" | "worker";
export type PayrollSchedule = "weekly" | "semi_monthly";
export type ProductionUnitStatus = "pending" | "approved" | "rejected";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          role: AppRole;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email: string;
          role?: AppRole;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string;
          role?: AppRole;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      time_entries: {
        Row: {
          id: string;
          worker_id: string;
          clock_in_at: string;
          clock_out_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          clock_in_at?: string;
          clock_out_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          clock_in_at?: string;
          clock_out_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_entries_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      time_breaks: {
        Row: {
          id: string;
          time_entry_id: string;
          worker_id: string;
          break_start_at: string;
          break_end_at: string | null;
          break_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          time_entry_id: string;
          worker_id: string;
          break_start_at?: string;
          break_end_at?: string | null;
          break_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          time_entry_id?: string;
          worker_id?: string;
          break_start_at?: string;
          break_end_at?: string | null;
          break_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_breaks_time_entry_id_fkey";
            columns: ["time_entry_id"];
            isOneToOne: false;
            referencedRelation: "time_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_breaks_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      production_units: {
        Row: {
          id: string;
          worker_id: string;
          quantity: number;
          work_date: string;
          notes: string | null;
          status: ProductionUnitStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          quantity: number;
          work_date?: string;
          notes?: string | null;
          status?: ProductionUnitStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          quantity?: number;
          work_date?: string;
          notes?: string | null;
          status?: ProductionUnitStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_units_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_pay_settings: {
        Row: {
          worker_id: string;
          hourly_rate: number;
          payroll_schedule: PayrollSchedule;
          weekly_unit_goal: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          worker_id: string;
          hourly_rate?: number;
          payroll_schedule?: PayrollSchedule;
          weekly_unit_goal?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          worker_id?: string;
          hourly_rate?: number;
          payroll_schedule?: PayrollSchedule;
          weekly_unit_goal?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_pay_settings_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bonus_tiers: {
        Row: {
          id: string;
          worker_id: string | null;
          threshold_units: number;
          bonus_amount: number;
          label: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id?: string | null;
          threshold_units: number;
          bonus_amount: number;
          label?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string | null;
          threshold_units?: number;
          bonus_amount?: number;
          label?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bonus_tiers_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      production_unit_status: ProductionUnitStatus;
      payroll_schedule: PayrollSchedule;
    };
    CompositeTypes: Record<string, never>;
  };
};
