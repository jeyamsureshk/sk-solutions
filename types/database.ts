export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TeamType = 'THT Panel' | 'SMT' | 'IQC' | 'Stores' | 'Kitting' | 'Cleaning' |
  'FQC Panel' | 'Logistics' | 'Accounts' | 'Administration' | 'Customer Support' |
  'D&D' | 'Engineering' | 'Fabrication' | 'Human Resources' | 'IT' |
  'Maintenance' | 'Manager' | 'Products' | 'Sales & Marketing' | 'SAP' | 'SCM';

export interface Database {
  public: {
    Tables: {
      operators: {
        Row: {
          id: number;
          name: string;
          team: string;
          email: string;
          role: string;
          created_at: string;
          updated_at: string;
          net_salary: string | null;
        };
        Insert: {
          id: number;
          name: string;
          team: string;
          email: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
          net_salary?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          team?: string;
          email?: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
          net_salary?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          operator_id: number | null;
          profile: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          operator_id?: number | null;
          profile?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          operator_id?: number | null;
          profile?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          content: string;
          read: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          content: string;
          read?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          content?: string;
          read?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      production_records: {
        Row: {
          id: string;
          date: string;
          hour: number;
          units_produced: number;
          target_units: number;
          operator_id: number | null;
          operator_name: string;
          team: string;
          remarks: string;
          efficiency: number;
          item: Json;
          manpower: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          hour: number;
          units_produced: number;
          target_units: number;
          operator_id?: number | null;
          operator_name: string;
          team: string;
          remarks?: string;
          efficiency?: number;
          item?: Json;
          manpower?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          hour?: number;
          units_produced?: number;
          target_units?: number;
          operator_id?: number | null;
          operator_name?: string;
          team?: string;
          remarks?: string;
          efficiency?: number;
          item?: Json;
          manpower?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      cycle_time_records: {
        Row: {
          id: string;
          date: string;
          team: TeamType;
          model_name: string;
          stages: Json;
          overall_average: number;
          cycles_per_hour: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          team: TeamType;
          model_name: string;
          stages: Json;
          overall_average: number;
          cycles_per_hour: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          team?: TeamType;
          model_name?: string;
          stages?: Json;
          overall_average?: number;
          cycles_per_hour?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      yield: {
        Row: {
          id: string;
          date: string;
          model_name: string;
          operator_id: number | null;
          operator_name: string;
          team: string;
          input_quantity: number;
          output_quantity: number;
          yield_percentage: number;
          remarks: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          model_name: string;
          operator_id?: number | null;
          operator_name: string;
          team: string;
          input_quantity: number;
          output_quantity: number;
          yield_percentage?: number;
          remarks?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          model_name?: string;
          operator_id?: number | null;
          operator_name?: string;
          team?: string;
          input_quantity?: number;
          output_quantity?: number;
          yield_percentage?: number;
          remarks?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      items: {
        Row: {
          id: string;
          part_id: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          part_id: string;
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          part_id?: string;
          description?: string;
          created_at?: string;
        };
      };
      study_materials: {
        Row: {
          id: string;
          category: string;
          title: string;
          content: string;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          title: string;
          content: string;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          title?: string;
          content?: string;
          image_url?: string | null;
          created_at?: string;
        };
      };
      component_scans: {
        Row: {
          id: string;
          created_at: string;
          operator_id: number | null;
          date: string;
          total_count: number;
          breakdown: Json;
          image_url: string | null;
          remarks: string | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          operator_id?: number | null;
          date: string;
          total_count: number;
          breakdown: Json;
          image_url?: string | null;
          remarks?: string | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          operator_id?: number | null;
          date?: string;
          total_count?: number;
          breakdown?: Json;
          image_url?: string | null;
          remarks?: string | null;
          metadata?: Json | null;
        };
      };
      
      /* --- NEWLY ADDED TABLES --- */
      events: {
        Row: {
          id: string;
          date: string;
          title: string;
          event_type: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          title: string;
          event_type?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          title?: string;
          event_type?: string | null;
          description?: string | null;
          created_at?: string;
        };
      };
      attendance_records: {
        Row: {
          id: string;
          operator_id: number | null;
          date: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          operator_id?: number | null;
          date: string;
          status: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          operator_id?: number | null;
          date?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      overtime_records: {
        Row: {
          id: string;
          operator_id: number | null;
          date: string;
          hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          operator_id?: number | null;
          date: string;
          hours: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          operator_id?: number | null;
          date?: string;
          hours?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type ProductionRecord = Database['public']['Tables']['production_records']['Row'];
export type ProductionRecordInsert = Database['public']['Tables']['production_records']['Insert'];
export type ProductionRecordUpdate = Database['public']['Tables']['production_records']['Update'];

export type Operator = Database['public']['Tables']['operators']['Row'];
export type OperatorInsert = Database['public']['Tables']['operators']['Insert'];
export type OperatorUpdate = Database['public']['Tables']['operators']['Update'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];

export type CycleTimeRecord = Database['public']['Tables']['cycle_time_records']['Row'];
export type CycleTimeRecordInsert = Database['public']['Tables']['cycle_time_records']['Insert'];
export type CycleTimeRecordUpdate = Database['public']['Tables']['cycle_time_records']['Update'];

export type Yield = Database['public']['Tables']['yield']['Row'];
export type YieldInsert = Database['public']['Tables']['yield']['Insert'];
export type YieldUpdate = Database['public']['Tables']['yield']['Update'];

export type Item = Database['public']['Tables']['items']['Row'];
export type ItemInsert = Database['public']['Tables']['items']['Insert'];
export type ItemUpdate = Database['public']['Tables']['items']['Update'];

export type StudyMaterial = Database['public']['Tables']['study_materials']['Row'];
export type StudyMaterialInsert = Database['public']['Tables']['study_materials']['Insert'];
export type StudyMaterialUpdate = Database['public']['Tables']['study_materials']['Update'];

export type ComponentScan = Database['public']['Tables']['component_scans']['Row'];
export type ComponentScanInsert = Database['public']['Tables']['component_scans']['Insert'];
export type ComponentScanUpdate = Database['public']['Tables']['component_scans']['Update'];

/* Events Types */
export type EventRecord = Database['public']['Tables']['events']['Row'];
export type EventRecordInsert = Database['public']['Tables']['events']['Insert'];
export type EventRecordUpdate = Database['public']['Tables']['events']['Update'];

/* Attendance & Overtime Types */
export type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row'];
export type AttendanceRecordInsert = Database['public']['Tables']['attendance_records']['Insert'];
export type AttendanceRecordUpdate = Database['public']['Tables']['attendance_records']['Update'];

export type OvertimeRecord = Database['public']['Tables']['overtime_records']['Row'];
export type OvertimeRecordInsert = Database['public']['Tables']['overtime_records']['Insert'];
export type OvertimeRecordUpdate = Database['public']['Tables']['overtime_records']['Update'];
