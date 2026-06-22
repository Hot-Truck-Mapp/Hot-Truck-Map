export type Truck = {
  id: string;
  name: string;
  cuisine: string | null;
  description?: string | null;
  phone?: string | null;
  instagram?: string | null;
  profile_photo: string | null;
  owner_id?: string;
  is_live: boolean;
  avg_rating: number | null;
  review_count: number | null;
  dietary_tags?: string[] | null;
  created_at?: string;
};

export type MenuItem = {
  id: string;
  truck_id: string;
  name: string;
  description: string | null;
  price: number;
  photo: string | null;
  allergens: string[];
  is_sold_out: boolean;
};

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "picked_up"
  | "no_show"
  | "cancelled";

export type Order = {
  id: string;
  truck_id: string;
  customer_id?: string | null;
  pickup_name?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  status_updated_at?: string;
  updated_at?: string;
  created_at: string;
};

export type OrderItem = {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
};

export type Location = {
  id: string;
  truck_id?: string;
  lat: number;
  lng: number;
  address: string;
  broadcasted_at: string;
};

export type Follow = {
  user_id: string;
  truck_id: string;
  created_at: string;
};

export type Review = {
  id: string;
  truck_id: string;
  user_id?: string;
  rating: number;
  comment: string | null;
  created_at: string;
};