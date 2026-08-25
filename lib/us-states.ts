// Shared US states list (50 states + DC) — powers the Events feature's
// state grid, admin dropdown, sitemap generation, and reverse-geocode
// validation on both web (imported as "@/lib/us-states") and mobile
// (imported as "@shared/us-states" via mobile/metro.config.js's
// watchFolders + the @shared alias in mobile/tsconfig.json /
// mobile/babel.config.js).

export type USState = {
  code: string;
  name: string;
};

export const US_STATES: USState[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "Washington, D.C." },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const CODE_TO_STATE: Record<string, USState> = Object.fromEntries(
  US_STATES.map((s) => [s.code, s])
);

const NAME_TO_STATE: Record<string, USState> = Object.fromEntries(
  US_STATES.map((s) => [s.name.toLowerCase(), s])
);

export function isValidStateCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return code.toUpperCase() in CODE_TO_STATE;
}

export function stateNameForCode(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return CODE_TO_STATE[code.toUpperCase()]?.name;
}

/** Looks up a state by its full display name (case-insensitive) — used to
 * match reverse-geocoding results (e.g. Expo Location's `.region` field,
 * which returns a full state name rather than a code). */
export function stateForName(name: string | null | undefined): USState | undefined {
  if (!name) return undefined;
  return NAME_TO_STATE[name.toLowerCase()];
}
