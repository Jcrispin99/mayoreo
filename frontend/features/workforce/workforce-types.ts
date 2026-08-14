import type { Role, UserAccount } from '../access/access-types';

export type StoreSummary = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
};

export type Compensation = {
  id: number;
  pay_type: 'monthly' | 'daily';
  amount: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
};

export type EmployeeProfile = {
  id: number;
  user_id: number;
  user: UserAccount & { roles: Role[] };
  store_id: number | null;
  store: StoreSummary | null;
  employment_status: 'active' | 'inactive';
  hired_at: string;
  terminated_at: string | null;
  expected_minutes_per_day: number;
  monthly_divisor: number;
  work_days: number[];
  compensations?: Compensation[];
  current_shift?: AttendanceShift | null;
};

export type AttendanceShift = {
  id: number;
  employee_profile_id: number;
  employee?: EmployeeProfile;
  store_id: number;
  store?: StoreSummary;
  clocked_in_at: string;
  clocked_out_at: string | null;
  worked_minutes: number | null;
  status: 'open' | 'completed' | 'incident';
  source: 'qr' | 'manual';
};

export type PayrollLine = {
  id: number;
  payroll_period_id: number;
  employee_profile_id: number;
  employee?: EmployeeProfile;
  pay_type: 'monthly' | 'daily';
  rate_amount: string;
  monthly_divisor: number | null;
  scheduled_days: number;
  valid_days: number;
  absence_days: number;
  incident_days: number;
  worked_minutes: number;
  base_amount: string;
  attendance_deduction: string;
  special_day_bonus: string;
  worked_day_equivalents: string;
  special_day_minutes: number;
  special_day_details: Array<{
    date: string;
    name: string;
    bonus_percentage: 50 | 100;
    worked_minutes: number;
    expected_minutes: number;
    amount: string;
  }>;
  calculated_amount: string;
  adjustments_amount: string;
  payable_amount: string;
  notes: string | null;
};

export type SpecialDay = {
  id: number;
  date: string;
  name: string;
  bonus_percentage: 50 | 100;
  is_active: boolean;
};

export type PayrollPeriod = {
  id: number;
  starts_on: string;
  ends_on: string;
  status: 'open' | 'closed';
  closed_at: string | null;
  lines?: PayrollLine[];
};
