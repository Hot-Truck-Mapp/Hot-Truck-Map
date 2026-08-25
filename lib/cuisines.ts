// Single source of truth for cuisine categories — used by both the operator
// profile editor (writes truck.cuisine) and the map filter bar (reads it).
// Keeping one shared list prevents them drifting apart, which previously let
// trucks be saved under a cuisine that had no matching filter pill.
export const CUISINE_TYPES = [
  "Tacos", "BBQ", "Burgers", "Asian Fusion", "Desserts",
  "Pizza", "Sandwiches", "Healthy", "Breakfast", "Seafood",
  "Mediterranean", "Caribbean", "African", "Vegan", "Halal", "Other",
] as const;
