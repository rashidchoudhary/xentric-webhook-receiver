export interface ContactEvent {
  clientId: string;
  eventId: string;
  contactId: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  updatedAt: string;
}

export type WebhookProcessResult = 'processed' | 'duplicate_ignored' | 'out_of_order_ignored';
