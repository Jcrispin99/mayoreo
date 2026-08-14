export type Permission = {
  id: number;
  name: string;
  guard_name: string;
};

export type Role = {
  id: number;
  name: string;
  guard_name: string;
  permissions?: Permission[];
};

export type UserAccount = {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  roles: Role[];
  employee_profile?: {
    id: number;
    store_id: number | null;
    employment_status: 'active' | 'inactive';
    hired_at: string;
    terminated_at: string | null;
    expected_minutes_per_day: number;
    monthly_divisor: number;
    work_days: number[];
  } | null;
};

export type AccessResourceKind = 'users' | 'roles';
export type AccessItem = UserAccount | Role;
