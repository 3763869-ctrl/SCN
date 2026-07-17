export type AppRole = "admin" | "worker";
export type PayrollSchedule = "weekly" | "semi_monthly";
export type ProductionUnitStatus = "pending" | "approved" | "rejected";
export type TimesheetWeekStatus = "open" | "completed" | "reopened";
export type ProductionUnitPeriodStatus = "completed" | "reopened";
export type WorkerPayrollStatus = "due" | "partial" | "paid" | "reopened";
export type PartnerPayrollStatus = "due" | "partial" | "paid" | "cancelled";
export type PartnerPayType = "none" | "flat" | "percentage";
export type PartnerStatus = "active" | "inactive";
export type PartnerAssignmentStatus = "active" | "ended";
export type PartnerInvoiceStatus =
  | "draft"
  | "ready"
  | "sent"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled";
export type PartnerSettlementStatus =
  | "pending"
  | "partial"
  | "transferred"
  | "waived"
  | "cancelled";
export type FinancialIncomeSource = "invoice_payment" | "manual";
export type FinancialExpenseCategory =
  | "payroll"
  | "office_expenses"
  | "software"
  | "banking_payment_fees"
  | "professional_services"
  | "taxes_government"
  | "travel";
export type FinancialRecurringFrequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";
export type WorkerPresenceCheckStatus =
  | "scheduled"
  | "sent"
  | "answered"
  | "missed"
  | "auto_clocked_out"
  | "cancelled"
  | "failed";

export type Database = {
  public: {
    Tables: {
      admin_audit_events: {
        Row: {
          id: string;
          actor_id: string | null;
          event_type: string;
          entity_type: string;
          entity_id: string | null;
          summary: string;
          metadata: Record<string, unknown>;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          event_type: string;
          entity_type: string;
          entity_id?: string | null;
          summary: string;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          event_type?: string;
          entity_type?: string;
          entity_id?: string | null;
          summary?: string;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_push_subscriptions: {
        Row: {
          id: string;
          worker_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          expiration_time: string | null;
          user_agent: string | null;
          active: boolean;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          expiration_time?: string | null;
          user_agent?: string | null;
          active?: boolean;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          expiration_time?: string | null;
          user_agent?: string | null;
          active?: boolean;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_push_subscriptions_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_presence_checks: {
        Row: {
          id: string;
          worker_id: string;
          time_entry_id: string;
          status: WorkerPresenceCheckStatus;
          scheduled_at: string;
          sent_at: string | null;
          expires_at: string;
          responded_at: string | null;
          auto_clock_out_at: string | null;
          failure_reason: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          time_entry_id: string;
          status?: WorkerPresenceCheckStatus;
          scheduled_at?: string;
          sent_at?: string | null;
          expires_at: string;
          responded_at?: string | null;
          auto_clock_out_at?: string | null;
          failure_reason?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          time_entry_id?: string;
          status?: WorkerPresenceCheckStatus;
          scheduled_at?: string;
          sent_at?: string | null;
          expires_at?: string;
          responded_at?: string | null;
          auto_clock_out_at?: string | null;
          failure_reason?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_presence_checks_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_presence_checks_time_entry_id_fkey";
            columns: ["time_entry_id"];
            isOneToOne: false;
            referencedRelation: "time_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          name: string;
          status: PartnerStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          status?: PartnerStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          status?: PartnerStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      partners: {
        Row: {
          id: string;
          client_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          status: PartnerStatus;
          start_date: string | null;
          notes: string | null;
          list_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          status?: PartnerStatus;
          start_date?: string | null;
          notes?: string | null;
          list_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          status?: PartnerStatus;
          start_date?: string | null;
          notes?: string | null;
          list_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partners_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_worker_assignments: {
        Row: {
          id: string;
          partner_id: string;
          worker_id: string;
          status: PartnerAssignmentStatus;
          assigned_at: string;
          ended_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          partner_id: string;
          worker_id: string;
          status?: PartnerAssignmentStatus;
          assigned_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          partner_id?: string;
          worker_id?: string;
          status?: PartnerAssignmentStatus;
          assigned_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_worker_assignments_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_worker_assignments_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_billing_settings: {
        Row: {
          partner_id: string;
          client_id: string;
          rate_per_unit: number;
          billing_frequency: "semi_monthly" | "manual";
          payment_terms_days: number;
          active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          partner_id: string;
          client_id: string;
          rate_per_unit?: number;
          billing_frequency?: "semi_monthly" | "manual";
          payment_terms_days?: number;
          active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          partner_id?: string;
          client_id?: string;
          rate_per_unit?: number;
          billing_frequency?: "semi_monthly" | "manual";
          payment_terms_days?: number;
          active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_billing_settings_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: true;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_billing_settings_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_pay_settings: {
        Row: {
          partner_id: string;
          pay_type: PartnerPayType;
          flat_pay_per_invoice: number;
          invoice_percentage: number;
          active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          partner_id: string;
          pay_type?: PartnerPayType;
          flat_pay_per_invoice?: number;
          invoice_percentage?: number;
          active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          partner_id?: string;
          pay_type?: PartnerPayType;
          flat_pay_per_invoice?: number;
          invoice_percentage?: number;
          active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_pay_settings_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: true;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_payrolls: {
        Row: {
          id: string;
          partner_id: string;
          invoice_id: string | null;
          billing_period_start: string;
          billing_period_end: string;
          pay_type_snapshot: PartnerPayType;
          flat_pay_snapshot: number;
          invoice_percentage_snapshot: number;
          total_owed: number;
          total_paid: number;
          balance_remaining: number;
          status: PartnerPayrollStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          partner_id: string;
          invoice_id?: string | null;
          billing_period_start: string;
          billing_period_end: string;
          pay_type_snapshot?: PartnerPayType;
          flat_pay_snapshot?: number;
          invoice_percentage_snapshot?: number;
          total_owed?: number;
          total_paid?: number;
          balance_remaining?: number;
          status?: PartnerPayrollStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          partner_id?: string;
          invoice_id?: string | null;
          billing_period_start?: string;
          billing_period_end?: string;
          pay_type_snapshot?: PartnerPayType;
          flat_pay_snapshot?: number;
          invoice_percentage_snapshot?: number;
          total_owed?: number;
          total_paid?: number;
          balance_remaining?: number;
          status?: PartnerPayrollStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_payrolls_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_payrolls_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: true;
            referencedRelation: "partner_invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_payroll_payments: {
        Row: {
          id: string;
          partner_payroll_id: string;
          partner_id: string;
          amount: number;
          paid_at: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          partner_payroll_id: string;
          partner_id: string;
          amount: number;
          paid_at?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          partner_payroll_id?: string;
          partner_id?: string;
          amount?: number;
          paid_at?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_payroll_payments_partner_payroll_id_fkey";
            columns: ["partner_payroll_id"];
            isOneToOne: false;
            referencedRelation: "partner_payrolls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_payroll_payments_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_payroll_payments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_runs: {
        Row: {
          id: string;
          client_id: string;
          billing_period_start: string;
          billing_period_end: string;
          status: "ready" | "sent" | "closed" | "cancelled";
          invoice_count: number;
          total_units: number;
          total_amount: number;
          generated_by: string | null;
          generated_at: string;
          sent_at: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          billing_period_start: string;
          billing_period_end: string;
          status?: "ready" | "sent" | "closed" | "cancelled";
          invoice_count?: number;
          total_units?: number;
          total_amount?: number;
          generated_by?: string | null;
          generated_at?: string;
          sent_at?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          billing_period_start?: string;
          billing_period_end?: string;
          status?: "ready" | "sent" | "closed" | "cancelled";
          invoice_count?: number;
          total_units?: number;
          total_amount?: number;
          generated_by?: string | null;
          generated_at?: string;
          sent_at?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_runs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_runs_generated_by_fkey";
            columns: ["generated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_invoices: {
        Row: {
          id: string;
          invoice_run_id: string | null;
          partner_id: string;
          client_id: string;
          invoice_number: string;
          billing_period_start: string;
          billing_period_end: string;
          units: number;
          rate_per_unit: number;
          invoice_total: number;
          created_date: string;
          sent_date: string | null;
          due_date: string | null;
          status: PartnerInvoiceStatus;
          total_paid: number;
          balance_remaining: number;
          generated_at: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          restored_at: string | null;
          restored_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_run_id?: string | null;
          partner_id: string;
          client_id: string;
          invoice_number: string;
          billing_period_start: string;
          billing_period_end: string;
          units?: number;
          rate_per_unit?: number;
          invoice_total?: number;
          created_date?: string;
          sent_date?: string | null;
          due_date?: string | null;
          status?: PartnerInvoiceStatus;
          total_paid?: number;
          balance_remaining?: number;
          generated_at?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          restored_at?: string | null;
          restored_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_run_id?: string | null;
          partner_id?: string;
          client_id?: string;
          invoice_number?: string;
          billing_period_start?: string;
          billing_period_end?: string;
          units?: number;
          rate_per_unit?: number;
          invoice_total?: number;
          created_date?: string;
          sent_date?: string | null;
          due_date?: string | null;
          status?: PartnerInvoiceStatus;
          total_paid?: number;
          balance_remaining?: number;
          generated_at?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          restored_at?: string | null;
          restored_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_invoices_invoice_run_id_fkey";
            columns: ["invoice_run_id"];
            isOneToOne: false;
            referencedRelation: "invoice_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_invoices_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_invoice_lines: {
        Row: {
          id: string;
          invoice_id: string;
          partner_id: string;
          worker_id: string | null;
          work_date: string | null;
          description: string;
          units: number;
          rate_per_unit: number;
          line_total: number;
          source: "generated" | "manual";
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          partner_id: string;
          worker_id?: string | null;
          work_date?: string | null;
          description: string;
          units?: number;
          rate_per_unit?: number;
          line_total?: number;
          source?: "generated" | "manual";
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          partner_id?: string;
          worker_id?: string | null;
          work_date?: string | null;
          description?: string;
          units?: number;
          rate_per_unit?: number;
          line_total?: number;
          source?: "generated" | "manual";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_invoice_lines_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "partner_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_invoice_lines_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_invoice_lines_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      production_unit_periods: {
        Row: {
          id: string;
          worker_id: string;
          period_start: string;
          period_end: string;
          status: ProductionUnitPeriodStatus;
          completed_at: string | null;
          completed_by: string | null;
          reopened_at: string | null;
          reopened_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          period_start: string;
          period_end: string;
          status?: ProductionUnitPeriodStatus;
          completed_at?: string | null;
          completed_by?: string | null;
          reopened_at?: string | null;
          reopened_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          period_start?: string;
          period_end?: string;
          status?: ProductionUnitPeriodStatus;
          completed_at?: string | null;
          completed_by?: string | null;
          reopened_at?: string | null;
          reopened_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_unit_periods_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_unit_periods_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_unit_periods_reopened_by_fkey";
            columns: ["reopened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      production_unit_invoice_links: {
        Row: {
          id: string;
          production_unit_id: string;
          invoice_id: string;
          invoice_line_id: string | null;
          invoice_run_id: string | null;
          partner_id: string;
          worker_id: string;
          work_date: string;
          quantity: number;
          created_by: string | null;
          created_at: string;
          released_at: string | null;
          released_by: string | null;
          release_reason: string | null;
        };
        Insert: {
          id?: string;
          production_unit_id: string;
          invoice_id: string;
          invoice_line_id?: string | null;
          invoice_run_id?: string | null;
          partner_id: string;
          worker_id: string;
          work_date: string;
          quantity: number;
          created_by?: string | null;
          created_at?: string;
          released_at?: string | null;
          released_by?: string | null;
          release_reason?: string | null;
        };
        Update: {
          id?: string;
          production_unit_id?: string;
          invoice_id?: string;
          invoice_line_id?: string | null;
          invoice_run_id?: string | null;
          partner_id?: string;
          worker_id?: string;
          work_date?: string;
          quantity?: number;
          created_by?: string | null;
          created_at?: string;
          released_at?: string | null;
          released_by?: string | null;
          release_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "production_unit_invoice_links_production_unit_id_fkey";
            columns: ["production_unit_id"];
            isOneToOne: false;
            referencedRelation: "production_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_unit_invoice_links_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "partner_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_unit_invoice_links_invoice_line_id_fkey";
            columns: ["invoice_line_id"];
            isOneToOne: false;
            referencedRelation: "partner_invoice_lines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_unit_invoice_links_invoice_run_id_fkey";
            columns: ["invoice_run_id"];
            isOneToOne: false;
            referencedRelation: "invoice_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_unit_invoice_links_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_unit_invoice_links_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_invoice_payments: {
        Row: {
          id: string;
          invoice_id: string;
          partner_id: string;
          amount_received: number;
          date_received: string;
          payment_method: string | null;
          deposit_account: string | null;
          notes: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          partner_id: string;
          amount_received: number;
          date_received?: string;
          payment_method?: string | null;
          deposit_account?: string | null;
          notes?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          partner_id?: string;
          amount_received?: number;
          date_received?: string;
          payment_method?: string | null;
          deposit_account?: string | null;
          notes?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_invoice_payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "partner_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_invoice_payments_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_recovery_events: {
        Row: {
          id: string;
          event_type: "invoice_voided" | "payment_voided" | "unit_links_released";
          invoice_id: string | null;
          invoice_payment_id: string | null;
          invoice_run_id: string | null;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: "invoice_voided" | "payment_voided" | "unit_links_released";
          invoice_id?: string | null;
          invoice_payment_id?: string | null;
          invoice_run_id?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: "invoice_voided" | "payment_voided" | "unit_links_released";
          invoice_id?: string | null;
          invoice_payment_id?: string | null;
          invoice_run_id?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_recovery_events_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "partner_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_recovery_events_invoice_payment_id_fkey";
            columns: ["invoice_payment_id"];
            isOneToOne: false;
            referencedRelation: "partner_invoice_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_recovery_events_invoice_run_id_fkey";
            columns: ["invoice_run_id"];
            isOneToOne: false;
            referencedRelation: "invoice_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_income_records: {
        Row: {
          id: string;
          source: FinancialIncomeSource;
          partner_id: string | null;
          client_id: string | null;
          invoice_id: string | null;
          invoice_payment_id: string | null;
          invoice_number: string | null;
          income_date: string;
          amount: number;
          payment_method: string | null;
          deposit_account: string | null;
          notes: string | null;
          created_by: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source?: FinancialIncomeSource;
          partner_id?: string | null;
          client_id?: string | null;
          invoice_id?: string | null;
          invoice_payment_id?: string | null;
          invoice_number?: string | null;
          income_date?: string;
          amount: number;
          payment_method?: string | null;
          deposit_account?: string | null;
          notes?: string | null;
          created_by?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source?: FinancialIncomeSource;
          partner_id?: string | null;
          client_id?: string | null;
          invoice_id?: string | null;
          invoice_payment_id?: string | null;
          invoice_number?: string | null;
          income_date?: string;
          amount?: number;
          payment_method?: string | null;
          deposit_account?: string | null;
          notes?: string | null;
          created_by?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_income_records_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_income_records_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_income_records_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "partner_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_income_records_invoice_payment_id_fkey";
            columns: ["invoice_payment_id"];
            isOneToOne: true;
            referencedRelation: "partner_invoice_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_expenses: {
        Row: {
          id: string;
          expense_date: string;
          vendor: string;
          category: FinancialExpenseCategory;
          subcategory: string | null;
          description: string;
          amount: number;
          payment_method: string | null;
          paid_from_account: string | null;
          partner_id: string | null;
          worker_id: string | null;
          receipt_file_name: string | null;
          receipt_storage_path: string | null;
          tax_deductible: boolean;
          notes: string | null;
          recurring: boolean;
          recurring_frequency: FinancialRecurringFrequency | null;
          recurring_next_date: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_date?: string;
          vendor: string;
          category: FinancialExpenseCategory;
          subcategory?: string | null;
          description: string;
          amount: number;
          payment_method?: string | null;
          paid_from_account?: string | null;
          partner_id?: string | null;
          worker_id?: string | null;
          receipt_file_name?: string | null;
          receipt_storage_path?: string | null;
          tax_deductible?: boolean;
          notes?: string | null;
          recurring?: boolean;
          recurring_frequency?: FinancialRecurringFrequency | null;
          recurring_next_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_date?: string;
          vendor?: string;
          category?: FinancialExpenseCategory;
          subcategory?: string | null;
          description?: string;
          amount?: number;
          payment_method?: string | null;
          paid_from_account?: string | null;
          partner_id?: string | null;
          worker_id?: string | null;
          receipt_file_name?: string | null;
          receipt_storage_path?: string | null;
          tax_deductible?: boolean;
          notes?: string | null;
          recurring?: boolean;
          recurring_frequency?: FinancialRecurringFrequency | null;
          recurring_next_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_expenses_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_expenses_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_settlements: {
        Row: {
          id: string;
          partner_id: string;
          invoice_id: string | null;
          amount_received_by_partner: number;
          amount_partner_keeps: number;
          amount_transferred_to_scn: number;
          transfer_status: PartnerSettlementStatus;
          transfer_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          partner_id: string;
          invoice_id?: string | null;
          amount_received_by_partner?: number;
          amount_partner_keeps?: number;
          amount_transferred_to_scn?: number;
          transfer_status?: PartnerSettlementStatus;
          transfer_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          partner_id?: string;
          invoice_id?: string | null;
          amount_received_by_partner?: number;
          amount_partner_keeps?: number;
          amount_transferred_to_scn?: number;
          transfer_status?: PartnerSettlementStatus;
          transfer_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_settlements_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_settlements_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "partner_invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_documents: {
        Row: {
          id: string;
          partner_id: string;
          document_type: string | null;
          file_name: string;
          storage_path: string;
          notes: string | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          partner_id: string;
          document_type?: string | null;
          file_name: string;
          storage_path: string;
          notes?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          partner_id?: string;
          document_type?: string | null;
          file_name?: string;
          storage_path?: string;
          notes?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_documents_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          role: AppRole;
          active: boolean;
          delete_reason: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_expires_at: string | null;
          list_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email: string;
          role?: AppRole;
          active?: boolean;
          delete_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_expires_at?: string | null;
          list_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string;
          role?: AppRole;
          active?: boolean;
          delete_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_expires_at?: string | null;
          list_order?: number | null;
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
      partner_status: PartnerStatus;
      partner_assignment_status: PartnerAssignmentStatus;
      partner_invoice_status: PartnerInvoiceStatus;
      partner_settlement_status: PartnerSettlementStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
