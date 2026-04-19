// Summary of production data across teams and time periods
export interface SummaryData {
  totalUnitsProduced: number;
  totalTargetUnits: number;
  averageEfficiency: number;
  recordCount: number;
  teamSummaries: TeamSummary[];
}

// Breakdown of production metrics for a single team
export interface TeamSummary {
  team: string;
  unitsProduced: number;
  targetUnits: number;
  efficiency: number;
  recordCount: number;
  chartData?: ChartDataPoint[]; // Optional: used for mini chart rendering
  modelSummaries?: ModelSummary[]; // Model-wise breakdown
}

// Model production summary
export interface ModelSummary {
  model: string;
  totalQuantity: number;
  recordCount: number;
}

// Chart data point for visualizing trends
export interface ChartDataPoint {
  x: string;       // Label (e.g. hour, day, month)
  y: number;       // Efficiency or metric value
  team: string;    // Team name for filtering
}

// X/Y series without a team dimension (e.g. overall efficiency trend)
export interface TrendPoint {
  x: string;
  y: number;
}

// Time period selection for summary views
export type PeriodType = 'day' | 'month' | 'year';

// Selected date for filtering summary data
export type SelectedDate = Date;

// Filters used for querying production records
export interface Filters {
  fromDate?: string;
  toDate?: string;
  team?: string;
  model?: string;
  efficiencyMin?: number;
  efficiencyMax?: number;
  hourMin?: number;
  hourMax?: number;
  period?: PeriodType; // Optional: useful for filtering by time granularity
}

/* Attendance & Overtime Summaries */
export interface AttendanceSummary {
  presentDays: number;
  totalDays: number;
  attendanceRate: number; // percentage
}

export interface OvertimeSummary {
  totalHours: number;
  approvedHours: number;
  pendingHours: number;
}

export interface MonthlySummary {
  monthName: string;
  attendance: AttendanceSummary;
  overtime: OvertimeSummary;
}
