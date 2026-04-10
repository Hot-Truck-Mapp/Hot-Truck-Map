export type Truck = {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  phone: string;
  instagram: string;
  profile_photo: string;
  owner_id: string;
  is_live: boolean;
  created_at: string;
};

export type MenuItem = {
  id: string;
  truck_id: string;
  name: string;
  description: string;
  price: number;
  photo: string;
  allergens: string[];
  is_sold_out: boolean;
};

export type Order = {
  id: string;
  truck_id: string;
  customer_id: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "preparing" | "ready" | "picked_up";
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
  truck_id: string;
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
  user_id: string;
  rating: number;
  body: string;
  created_at: string;
};