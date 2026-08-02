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
};

export type AccessResourceKind = 'users' | 'roles';
export type AccessItem = UserAccount | Role;
