export type Customer = {
  id: number;
  name: string;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
