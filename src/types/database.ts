export type AppRole = "admin" | "worker";
export type PayrollSchedule = "weekly" | "semi_monthly";
export type ProductionUnitStatus = "pending" | "approved" | "rejected";
export type TimesheetWeekStatus = "open" | "completed" | "reopened";
export type WorkerPayrollStatus = "due" | "partial" | "paid" | "reopened";

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
      worker_details: {
        Row: {
          worker_id: string;
          phone_number: string | null;
          date_of_birth: string | null;
          birthday_last_shown_year: number | null;
          address_line1: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          zip_code: string | null;
          secondary_contact_name: string | null;
          secondary_contact_phone: string | null;
          start_date: string | null;
          hiring_source: string | null;
          referral_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          worker_id: string;
          phone_number?: string | null;
          date_of_birth?: string | null;
          birthday_last_shown_year?: number | null;
          address_line1?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          zip_code?: string | null;
          secondary_contact_name?: string | null;
          secondary_contact_phone?: string | null;
          start_date?: string | null;
          hiring_source?: string | null;
          referral_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          worker_id?: string;
          phone_number?: string | null;
          date_of_birth?: string | null;
          birthday_last_shown_year?: number | null;
          address_line1?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          zip_code?: string | null;
          secondary_contact_name?: string | null;
          secondary_contact_phone?: string | null;
          start_date?: string | null;
          hiring_source?: string | null;
          referral_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_details_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_onboarding_links: {
        Row: {
          id: string;
          worker_id: string;
          token: string;
          expires_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          token: string;
          expires_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          token?: string;
          expires_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_onboarding_links_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
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
      timesheet_weeks: {
        Row: {
          id: string;
          worker_id: string;
          week_start: string;
          week_end: string;
          status: TimesheetWeekStatus;
          completed_at: string | null;
          completed_by: string | null;
          reopened_at: string | null;
          reopened_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          week_start: string;
          week_end: string;
          status?: TimesheetWeekStatus;
          completed_at?: string | null;
          completed_by?: string | null;
          reopened_at?: string | null;
          reopened_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          week_start?: string;
          week_end?: string;
          status?: TimesheetWeekStatus;
          completed_at?: string | null;
          completed_by?: string | null;
          reopened_at?: string | null;
          reopened_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timesheet_weeks_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_payrolls: {
        Row: {
          id: string;
          worker_id: string;
          timesheet_week_id: string;
          week_start: string;
          week_end: string;
          due_date: string;
          total_hours: number;
          total_units: number;
          hourly_rate: number;
          hourly_pay: number;
          bonus_pay: number;
          total_owed: number;
          total_paid: number;
          balance_remaining: number;
          status: WorkerPayrollStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          timesheet_week_id: string;
          week_start: string;
          week_end: string;
          due_date: string;
          total_hours?: number;
          total_units?: number;
          hourly_rate?: number;
          hourly_pay?: number;
          bonus_pay?: number;
          total_owed?: number;
          total_paid?: number;
          balance_remaining?: number;
          status?: WorkerPayrollStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          timesheet_week_id?: string;
          week_start?: string;
          week_end?: string;
          due_date?: string;
          total_hours?: number;
          total_units?: number;
          hourly_rate?: number;
          hourly_pay?: number;
          bonus_pay?: number;
          total_owed?: number;
          total_paid?: number;
          balance_remaining?: number;
          status?: WorkerPayrollStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_payrolls_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_payrolls_timesheet_week_id_fkey";
            columns: ["timesheet_week_id"];
            isOneToOne: false;
            referencedRelation: "timesheet_weeks";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_payments: {
        Row: {
          id: string;
          payroll_id: string;
          worker_id: string;
          amount: number;
          paid_at: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payroll_id: string;
          worker_id: string;
          amount: number;
          paid_at?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payroll_id?: string;
          worker_id?: string;
          amount?: number;
          paid_at?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_payments_payroll_id_fkey";
            columns: ["payroll_id"];
            isOneToOne: false;
            referencedRelation: "worker_payrolls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_payments_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_files: {
        Row: {
          id: string;
          worker_id: string;
          file_name: string;
          storage_path: string;
          document_type: string | null;
          signed: boolean;
          notes: string | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          file_name: string;
          storage_path: string;
          document_type?: string | null;
          signed?: boolean;
          notes?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          file_name?: string;
          storage_path?: string;
          document_type?: string | null;
          signed?: boolean;
          notes?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_files_worker_id_fkey";
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
      timesheet_week_status: TimesheetWeekStatus;
      worker_payroll_status: WorkerPayrollStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
