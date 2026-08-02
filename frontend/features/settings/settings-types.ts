export type FiscalCertificate = {
  original_name: string | null;
  source_format: string | null;
  fingerprint_sha256: string | null;
  matches_ruc: boolean | null;
  is_self_signed: boolean | null;
  key_algorithm: string | null;
  key_size: number | null;
  expires_at: string | null;
  uploaded_at: string | null;
  is_expired: boolean;
};

export type FiscalCredentials = {
  environment: 'beta' | 'production';
  has_sol_username: boolean;
  has_sol_password: boolean;
  has_sol_credentials: boolean;
  has_certificate: boolean;
  certificate: FiscalCertificate | null;
  updated_at: string | null;
};

export type FiscalIssuer = {
  id: number;
  ruc: string;
  legal_name: string;
  trade_name: string | null;
  fiscal_address: string | null;
  ubigeo: string | null;
  urbanization: string | null;
  department: string | null;
  province: string | null;
  district: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  configuration_complete: boolean;
  stores_count: number;
  credentials: FiscalCredentials | null;
};
