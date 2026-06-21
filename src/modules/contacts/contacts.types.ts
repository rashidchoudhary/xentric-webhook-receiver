export interface ContactRecord {
  client_id: string;
  contact_id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  updated_at: Date;
  created_at: Date;
  modified_at: Date;
}

export interface PaginatedContacts {
  data: ContactRecord[];
  page: number;
  limit: number;
}
