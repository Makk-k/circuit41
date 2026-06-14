export type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
  email: string | null
  phone: string | null
  account_status: string | null
  deleted_at: string | null
  scheduled_deletion_at: string | null
  created_at: string
  updated_at: string
}

export type Shipment = {
  id: string
  user_id: string
  status: string
  slot_name: string | null
  slot_tag: string | null
  slot_rate: number | null
  origin_country: string | null
  destination_country: string | null
  delivery_address: string | null
  pickup_point_id?: string | null
  shipping_rate_id?: string | null
  rate_currency?: string | null
  total_weight: number | null
  total_cost: number | null
  payment_method: string | null
  payment_status: string
  carrier: string | null
  carrier_vessel: string | null
  tracking_reference: string | null
  estimated_delivery: string | null
  origin_port_name: string | null
  destination_port_name: string | null
  out_for_delivery_note: string | null
  received_at: string | null
  origin_port_at: string | null
  in_transit_at: string | null
  destination_port_at: string | null
  out_for_delivery_at: string | null
  delivered_at: string | null
  // Ops-only soft archive. When set, the shipment is hidden from customer views
  // (enforced server-side by RLS). Never read/displayed in the customer app.
  archived_at?: string | null
  archived_by?: string | null
  created_at: string
  updated_at: string
}

export type PaymentAccount = {
  id: string
  country_code: 'GB' | 'NG' | string
  country_name: string
  currency: string
  bank_name: string
  account_name: string
  account_number: string
  sort_code: string | null
  iban: string | null
  swift_bic: string | null
  instructions: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PaymentProof = {
  id: string
  shipment_id: string
  user_id: string
  payment_account_id: string | null
  file_url: string
  file_name: string | null
  file_type: string | null
  uploaded_at: string
  status: 'submitted' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string | null
}

export type PickupPoint = {
  id: string
  country_code: string
  country_name: string
  state: string | null
  city: string
  name: string
  address: string
  contact_phone: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Parcel = {
  id: string
  shipment_id: string
  user_id: string
  item_names: string[]
  tracking_id: string | null
  reference_id: string | null
  declared_value: number | null
  category: string
  sensitive_types: string[]
  status: string
  weight: number | null
  photos: string[] | null
  receipt_path: string | null
  has_receipt: boolean
  created_at: string
  updated_at: string
}

export type ShipmentProof = {
  id: string
  shipment_id: string
  proof_type: 'weight' | 'volume'
  file_url: string
  file_name: string | null
  uploaded_by: string | null
  created_at: string
}

export type Slot = {
  id: string
  name: string
  tag: string | null
  origin_country: string
  destination_country: string
  currency?: string
  general_rate: number | null
  battery_rate: number | null
  branded_rate: number | null
  fragile_rate?: number | null
  liquid_rate: number | null
  electronics_rate?: number | null
  documents_rate?: number | null
  clothing_rate?: number | null
  cosmetics_rate?: number | null
  minimum_charge?: number | null
  warehouse_name?: string | null
  warehouse_address: string | null
  warehouse_city?: string | null
  warehouse_state?: string | null
  warehouse_country?: string | null
  warehouse_postcode?: string | null
  warehouse_contact_phone?: string | null
  warehouse_notes?: string | null
  is_active: boolean
  created_at: string
}

export type FxRate = {
  id: string
  base_currency: string
  target_currency: string
  rate: number
  is_active: boolean
  updated_by: string | null
  updated_at: string
  created_at: string
}

export type ShippingRate = {
  id: string
  origin_country: string
  destination_country: string
  origin_country_code: string | null
  destination_country_code: string | null
  service_name: string | null
  service_type: 'economy' | 'standard' | 'express' | string | null
  currency: string
  general_goods_rate: number | null
  battery_items_rate: number | null
  branded_goods_rate: number | null
  fragile_goods_rate: number | null
  liquid_goods_rate: number | null
  electronics_rate: number | null
  documents_rate: number | null
  clothing_rate: number | null
  cosmetics_rate: number | null
  minimum_charge: number | null
  warehouse_name: string | null
  warehouse_address: string | null
  warehouse_city: string | null
  warehouse_state: string | null
  warehouse_country: string | null
  warehouse_postcode: string | null
  warehouse_contact_phone: string | null
  warehouse_notes: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type Action = {
  id: string
  shipment_id: string
  user_id: string
  title: string
  description: string | null
  action_type: string
  due_date: string | null
  status: string
  created_at: string
  updated_at: string
}

export type Activity = {
  id: string
  user_id: string
  shipment_id: string | null
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export type SavedAddress = {
  id: string
  user_id: string
  label: string | null
  address_line: string
  city: string | null
  country: string | null
  postcode: string | null
  is_default: boolean
  created_at: string
}

// ─── Support tickets (customer ↔ staff) ───────────────────────────────────────
export type TicketStatus = 'new' | 'in_progress' | 'closed';

export type ShipmentTicket = {
  id: string
  shipment_id: string
  user_id: string | null
  status: TicketStatus
  subject: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
};

export type ShipmentTicketMessage = {
  id: string
  ticket_id: string
  sender_user_id: string | null
  sender_staff_id: string | null
  sender_type: 'customer' | 'staff' | 'system'
  message: string
  created_at: string
};
