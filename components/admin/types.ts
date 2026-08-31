export type AdminStats = {
  totalTrucks: number;
  liveTrucks: number;
  newTrucksThisWeek: number;
  totalUsers: number;
  newUsersThisWeek: number;
  totalFollows: number;
  totalViews: number;
  viewsThisWeek: number;
  totalOrders: number;
  openOrders: number;
  revenueAllTime: number;
  revenueThisWeek: number;
  totalReviews: number;
  pendingCatering: number;
  newContacts: number;
  newsletterActive: number;
};

export type TabId =
  | "overview"
  | "live"
  | "trucks"
  | "users"
  | "orders"
  | "catering"
  | "contact"
  | "reviews"
  | "moderation"
  | "newsletter"
  | "announce"
  | "totw"
  | "festivals";
