// Content for "On the Menu" — the biweekly Hot Truck Map newsletter,
// published at /newsletter on the web and in the mobile app's Newsletter
// screen (which reads this same list from /api/newsletter, falling back to
// the copy bundled into the app when offline).
//
// Add a new issue by prepending an object to ISSUES (newest first). Each
// issue gets its own static page at /newsletter/[slug] via
// generateStaticParams in app/newsletter/[slug]/page.tsx — no other wiring
// needed beyond that. Keep `summary` short: it's used for the index card,
// the OG description, and (later) the email subject line if this feed is
// ever piped into an actual email send. `tldr` should be 3 short skimmable
// bullets — the newsletter equivalent of a subject-line preview.
//
// Weekend-guide issues add an `eventGuide`. Its events are an editorial
// snapshot of rows in the Supabase `festivals` table at publish time — copy
// dates, times and venues from the listing rather than writing them fresh,
// and set `festivalId` so the app can open the live listing.

export interface NewsletterItem {
  emoji: string;
  tag: "NEW" | "IMPROVED" | "FIX" | "TIP";
  title: string;
  body: string;
}

export interface NewsletterEvent {
  festivalId: string; // festivals.id
  name: string;
  city: string;
  county: string;
  when: string; // "Sat · 11 AM–7 PM"
  venue?: string;
  blurb: string;
  pick?: boolean; // editor's pick — highlighted in the guide
}

export interface NewsletterEventGroup {
  label: string;
  events: NewsletterEvent[];
}

export interface NewsletterStateGuide {
  stateCode: string; // "NJ" — also the /events/[state] slug, lowercased
  stateName: string;
  intro: string;
  groups: NewsletterEventGroup[];
}

export interface NewsletterEventGuide {
  heading: string;
  dateRange: string; // "Fri, Sept 11 – Sun, Sept 13"
  states: NewsletterStateGuide[];
  note: string;
}

export interface NewsletterIssue {
  slug: string;
  issue: number;
  title: string;
  dateISO: string; // YYYY-MM-DD
  dateLabel: string; // "August 25, 2026"
  summary: string;
  tldr: string[];
  headline: {
    emoji: string;
    tag: string;
    title: string;
    body: string[];
    cta?: { label: string; href: string };
  };
  eventGuide?: NewsletterEventGuide;
  itemsHeading?: string; // defaults to "Also in This Issue"
  items: NewsletterItem[];
  signOffPrompt?: string; // leads into the "Tell us" contact link
}

export const NEWSLETTER_NAME = "On the Menu";
export const NEWSLETTER_TAGLINE =
  "Food truck festivals, weekend picks, and what's new at Hot Truck Map.";
export const CADENCE_DAYS = 14;

export const ISSUES: NewsletterIssue[] = [
  {
    slug: "weekend-guide-sept-12-13",
    issue: 2,
    title: "Your NJ & NY food truck weekend: Sept 12–13",
    dateISO: "2026-09-11",
    dateLabel: "September 11, 2026",
    summary:
      "40 food truck festivals, food fests and fairs across New Jersey and New York this weekend — our picks in each state, plus the full rundown.",
    tldr: [
      "🥓 Pork Roll vs. Taylor Ham goes head to head in Hillsborough on Saturday",
      "🧄 The Long Island Garlic Festival takes over Riverhead all weekend",
      "🗺️ 24 New Jersey and 16 New York events, grouped so you can plan fast",
    ],
    headline: {
      emoji: "🎪",
      tag: "WEEKEND GUIDE",
      title: "The weekend at a glance",
      body: [
        "Early fall is prime festival season, and this weekend shows it. Between Friday and Sunday we're tracking 40 food truck festivals, food and drink fests, and fairs with trucks on site across New Jersey and New York. New Jersey carries the bigger slate with 24 events, from West Milford down to Wildwood. New York adds 16, from Staten Island and Long Island up through the Hudson Valley, the Capital Region and Western New York.",
        "Saturday is the big day. Most events run from late morning into the evening, followed by a smaller but strong Sunday lineup. Below you'll find our picks in each state, then the full rundown grouped by type so you can match the drive to the appetite.",
      ],
      cta: { label: "Browse All Events", href: "/events" },
    },
    eventGuide: {
      heading: "This Weekend's Events",
      dateRange: "Fri, Sept 11 – Sun, Sept 13",
      note: "Dates, times and venues are as published by each organizer. Outdoor events can shift with the weather, so check the organizer's page before you head out.",
      states: [
        {
          stateCode: "NJ",
          stateName: "New Jersey",
          intro:
            "Ten food-truck-focused events run statewide, most of them on Saturday, with feasts, food fests and fairs filling in the rest of the map. Sunday belongs to Vineland, Fanwood and Budd Lake.",
          groups: [
            {
              label: "Food Truck Festivals",
              events: [
                {
                  festivalId: "79affea5-71f5-44d2-85f9-9e2efb010748",
                  name: "Pork Roll vs. Taylor Ham Food & Music Festival",
                  city: "Hillsborough",
                  county: "Somerset",
                  when: "Sat · Noon–7 PM",
                  venue: "Iron Peak Sports Complex",
                  blurb:
                    "New Jersey's favorite argument, served on a roll. Expect food battles, live music, a beer garden, wrestling and a Kids Adventure Zone.",
                  pick: true,
                },
                {
                  festivalId: "f5273a92-fe37-40dd-b5f3-af80dd2e496b",
                  name: "Food Trucktemberfest",
                  city: "Oceanport",
                  county: "Monmouth",
                  when: "Sat · 11 AM–5 PM",
                  venue: "Monmouth Park",
                  blurb:
                    "Food trucks and entertainment take over Monmouth Park for the Shore's big Saturday truck gathering.",
                  pick: true,
                },
                {
                  festivalId: "100cec58-e245-4608-8f9a-fd6b18305c6f",
                  name: "Grape Stomping Food Truck Festival at Laurita Winery",
                  city: "New Egypt",
                  county: "Ocean",
                  when: "Sat · Noon–9 PM  ·  Sun · Noon–7 PM",
                  venue: "Laurita Winery, 85 Archertown Rd",
                  blurb:
                    "Two full days of food trucks, grape stomping and live music at the winery, with Saturday running until 9 PM.",
                  pick: true,
                },
                {
                  festivalId: "0380b08b-bed0-4d77-8816-66cab895a013",
                  name: "Ridgefield PBA 330 Food Truck Festival",
                  city: "Ridgefield",
                  county: "Bergen",
                  when: "Sat · 11 AM–7 PM",
                  venue: "Veterans Memorial Field, 554 Shaler Blvd",
                  blurb:
                    "A food-truck-first festival hosted by Ridgefield PBA Local 330, running all day at Veterans Memorial Field.",
                },
                {
                  festivalId: "fcd16803-4618-4a1c-a08c-1d5a424f9996",
                  name: "West Milford Food Truck & Family Fun Festival",
                  city: "West Milford",
                  county: "Passaic",
                  when: "Sat · 11 AM–7 PM",
                  venue: "Wallisch Homestead",
                  blurb: "Food trucks and family activities on the grounds of Wallisch Homestead.",
                },
                {
                  festivalId: "35fac7f7-2f1c-4434-8fb2-cf3a535eeafe",
                  name: "Voorhees Township Food Truck & Music Festival",
                  city: "Voorhees",
                  county: "Camden",
                  when: "Sat · 11 AM–7 PM",
                  venue: "Connolly Park",
                  blurb: "South Jersey's all-day pairing of food trucks and live music.",
                },
                {
                  festivalId: "f3fe6558-499b-41c3-8e36-1d1f2aa11385",
                  name: "Apple & Food Truck Festival",
                  city: "Sewell",
                  county: "Gloucester",
                  when: "Sat · 11 AM–5 PM",
                  venue: "Duffield's Farm Market",
                  blurb:
                    "A Food Truck Alley plus apple picking, live music and family activities. Come hungry and leave with a bag of apples.",
                },
                {
                  festivalId: "b83d9853-1716-4740-acaf-ec8d837ad179",
                  name: "Vineland Food Truck Festival",
                  city: "Vineland",
                  county: "Cumberland",
                  when: "Sun · 11 AM–7 PM",
                  venue: "Landis Avenue",
                  blurb: "Food trucks line Landis Avenue from late morning into the evening on Sunday.",
                },
                {
                  festivalId: "90d2024c-cec5-4022-abf5-728a76592933",
                  name: "Fanwood PBA Local 123 Food Truck Festival",
                  city: "Fanwood",
                  county: "Union",
                  when: "Sun",
                  venue: "La Grande Ave",
                  blurb: "Food trucks, local vendors, a live DJ, a kids' zone and a beer garden.",
                },
                {
                  festivalId: "6f228e8f-33dd-4f27-a44d-ac557bd20f06",
                  name: "Vets Summer Fest",
                  city: "Budd Lake",
                  county: "Morris",
                  when: "Sun",
                  venue: "Vasa Park",
                  blurb: "Food trucks, live bands, a beer garden and a motorcycle event.",
                },
              ],
            },
            {
              label: "Food & Drink Festivals",
              events: [
                {
                  festivalId: "5dff8a61-d153-4b85-9885-fbf7324ab330",
                  name: "Bacon, Bourbon & Brews Festival",
                  city: "Medford",
                  county: "Burlington",
                  when: "Sat · 11 AM–8 PM",
                  venue: "Flying W Airport",
                  blurb: "Food, brews and music at the airfield. The name says the rest.",
                },
                {
                  festivalId: "cf0ed9e4-4328-4328-a713-95a0d1d9736d",
                  name: "Wildwoods Food & Music Festival",
                  city: "Wildwood",
                  county: "Cape May",
                  when: "Sat · 11 AM–7 PM",
                  venue: "Byrne Plaza",
                  blurb:
                    "Food, live music and vendors. Pair it with the Wildwoods Airshow on the beachfront for a full Shore day.",
                },
                {
                  festivalId: "50bf542e-1b65-44f4-9b26-9f73e3b5c699",
                  name: "Trenton RiverFest",
                  city: "Trenton",
                  county: "Mercer",
                  when: "Sat",
                  venue: "Trenton Thunder Ballpark",
                  blurb:
                    "Live music, craft beer, Delaware River activities, food vendors and the Pork Roll Eating Championship.",
                },
                {
                  festivalId: "6a2f1d10-a764-4da2-bb33-b4a352ee739c",
                  name: "St. Anthony's Italian Festival",
                  city: "Glassboro",
                  county: "Gloucester",
                  when: "Sat · 2–10 PM",
                  venue: "Downtown Glassboro",
                  blurb: "Italian food, music and vendors downtown, running well into the evening.",
                },
                {
                  festivalId: "7da86e2f-996a-4235-99fa-7eba882df27a",
                  name: "Sweet Corn & Garlic Festival",
                  city: "Hackettstown",
                  county: "Warren",
                  when: "Sat · Noon–7 PM",
                  venue: "Donaldson Farms",
                  blurb: "Farm-fresh food, agriculture and family activities at the height of harvest.",
                },
                {
                  festivalId: "f26872d9-6970-417e-a92c-395f29fe0a0b",
                  name: "NJ Feast of San Gennaro",
                  city: "Mine Hill",
                  county: "Morris",
                  when: "Sun",
                  blurb: "Italian food, music and the traditional procession.",
                },
              ],
            },
            {
              label: "Fairs, Markets & More",
              events: [
                {
                  festivalId: "c1348d4d-2f61-4b4b-92d8-2479b4ec0f59",
                  name: "Wildwoods Airshow",
                  city: "Wildwood",
                  county: "Cape May",
                  when: "Sat–Sun",
                  venue: "Wildwood beachfront",
                  blurb: "Beachfront airshow with food vendors, entertainment and family activities.",
                },
                {
                  festivalId: "534ac886-6c1f-4215-903e-dbd144ae6962",
                  name: "Fall Chester Craft Show",
                  city: "Chester",
                  county: "Morris",
                  when: "Sat–Sun",
                  blurb: "175+ makers alongside food and arts & crafts.",
                },
                {
                  festivalId: "c7f27f75-0fd1-4cdb-98db-8feeaafed5cb",
                  name: "Wood Street Fair",
                  city: "Burlington",
                  county: "Burlington",
                  when: "Sat",
                  venue: "Wood Street",
                  blurb: "A large arts and crafts fair with food vendors and shopping.",
                },
                {
                  festivalId: "43afefc2-a0a2-4a2c-907b-704e46730eb7",
                  name: "Pennsville Septemberfest",
                  city: "Pennsville",
                  county: "Salem",
                  when: "Sat",
                  blurb: "Food vendors, crafts, live music and rides, capped with fireworks.",
                },
                {
                  festivalId: "8d839e7e-66e2-4eae-b715-7f49459d1b99",
                  name: "Gone to the Dogs Craft Fair Family Festival",
                  city: "Columbus",
                  county: "Burlington",
                  when: "Sat",
                  blurb: "Food, vendors and family activities.",
                },
                {
                  festivalId: "8657ca24-1ae7-4876-bca3-138cff1ea92d",
                  name: "Dunellen Fall Street Fair & Craft Show",
                  city: "Dunellen",
                  county: "Middlesex",
                  when: "Sun",
                  blurb: "Food vendors, arts & crafts, music and family activities.",
                },
                {
                  festivalId: "6b705804-84b1-4443-a903-419d9e9abaa7",
                  name: "Everything Flea & Collectibles Market",
                  city: "Kearny",
                  county: "Hudson",
                  when: "Sun",
                  venue: "Frank A. Vincent Marina",
                  blurb: "Flea and collectibles market with food vendors on site.",
                },
                {
                  festivalId: "713d5e15-a03e-4194-9415-52080fc72344",
                  name: "Holland Ridge Fall Flower Festival",
                  city: "Cream Ridge",
                  county: "Burlington",
                  when: "Now through Oct 12",
                  venue: "Holland Ridge Farms",
                  blurb: "Food vendors and weekend activities at a large farm attraction.",
                },
              ],
            },
          ],
        },
        {
          stateCode: "NY",
          stateName: "New York",
          intro:
            "Two dedicated truck festivals anchor Saturday in Westchester and Schenectady, while the Garlic Festival and the Hudson Valley Wine & Food Fest run both days. Fairs and fall festivals from Staten Island to the Adirondacks round out the weekend.",
          groups: [
            {
              label: "Food Truck Festivals",
              events: [
                {
                  festivalId: "461c69bd-4ea9-468f-bc6b-a18e86e2189c",
                  name: "Dobbs Ferry Food Truck Festival",
                  city: "Dobbs Ferry",
                  county: "Westchester",
                  when: "Sat · 1–7 PM",
                  venue: "11 Station Plaza",
                  blurb:
                    "A dedicated truck festival steps from the Dobbs Ferry train station, which makes it an easy Saturday trip up the Hudson Line.",
                  pick: true,
                },
                {
                  festivalId: "10d05e01-52f8-469c-8f37-e4580eecdff9",
                  name: "Electric City Trucks, Taps, Corks & Forks Food Truck Festival",
                  city: "Schenectady",
                  county: "Schenectady",
                  when: "Sat · Noon–5 PM",
                  venue: "Liberty ARC, 2999 Hamburg St",
                  blurb:
                    "Up to twelve food trucks plus taps and corks, all benefiting Liberty ARC. Eat well for a good cause.",
                  pick: true,
                },
              ],
            },
            {
              label: "Food & Drink Festivals",
              events: [
                {
                  festivalId: "f2e56bd5-392e-40d8-b9cb-ea1f3a717517",
                  name: "Long Island Garlic Festival",
                  city: "Riverhead",
                  county: "Suffolk",
                  when: "Sat–Sun · 10 AM–6 PM",
                  venue: "Waterdrinker North Fork, 4560 Sound Ave",
                  blurb:
                    "Two days of garlic-themed food, vendors and food trucks on the North Fork. Pack the breath mints.",
                  pick: true,
                },
                {
                  festivalId: "39d68ade-ddec-43ee-8379-40266a36c8ae",
                  name: "Hudson Valley Wine & Food Fest",
                  city: "Rhinebeck",
                  county: "Dutchess",
                  when: "Sat–Sun · 10 AM–5 PM",
                  venue: "Dutchess County Fairgrounds, 6636 Route 9",
                  blurb: "The Hudson Valley's weekend of wine and food at the Rhinebeck fairgrounds.",
                },
                {
                  festivalId: "6e272afe-6d29-4047-b104-8e8c25118fcb",
                  name: "Harvest Festival at Bethel Woods",
                  city: "Bethel",
                  county: "Sullivan",
                  when: "Now through Oct 4",
                  venue: "Bethel Woods Center for the Arts",
                  blurb: "A fall harvest festival with local food and vendors at the historic Woodstock site.",
                },
              ],
            },
            {
              label: "Fairs, Markets & More",
              events: [
                {
                  festivalId: "fbd29b78-c9ea-4b68-90c8-7a5b99fad6f5",
                  name: "East Northport Festival",
                  city: "East Northport",
                  county: "Suffolk",
                  when: "Fri–Sun",
                  venue: "John J. Walsh Memorial Park",
                  blurb: "A three-day community festival with food trucks, kicking off Friday.",
                },
                {
                  festivalId: "2677ba7b-3709-4c68-a249-7623e700f25b",
                  name: "Fence Show",
                  city: "Staten Island",
                  county: "Richmond",
                  when: "Sat",
                  venue: "Staten Island Museum at Snug Harbor, 1000 Richmond Ter",
                  blurb: "An outdoor art show with food trucks on the grounds of Snug Harbor.",
                },
                {
                  festivalId: "91c501c0-b2c8-4944-b34f-0881d5f0d67f",
                  name: "Nyack Fall Festival Street Fair",
                  city: "Nyack",
                  county: "Rockland",
                  when: "Sun · 10 AM–5 PM",
                  venue: "Main Street & Broadway",
                  blurb: "Downtown Nyack's fall street fair with food vendors.",
                },
                {
                  festivalId: "2a74ab28-ab25-4703-9a5a-c2083e1e319a",
                  name: "Shaker Fall Harvest Craft Fair",
                  city: "Albany",
                  county: "Albany",
                  when: "Sat–Sun",
                  venue: "Shaker Site",
                  blurb: "A fall harvest craft fair with food trucks.",
                },
                {
                  festivalId: "43d01115-ab0e-4b6d-8764-fd4f7f7f8e84",
                  name: "Colorscape Chenango Arts Festival",
                  city: "Norwich",
                  county: "Chenango",
                  when: "Sat–Sun",
                  venue: "East & West Parks, Downtown Norwich",
                  blurb: "An arts festival with food trucks in downtown Norwich.",
                },
                {
                  festivalId: "dfd95e5d-bbb6-45b3-80a2-c5ecaa91bd20",
                  name: "Madison County Craft Festival",
                  city: "Oneida",
                  county: "Madison",
                  when: "Sat–Sun",
                  venue: "Madison County Historical Society, 435 Main St",
                  blurb: "A craft festival with food vendors.",
                },
                {
                  festivalId: "e918451e-628c-407a-8a46-52286cd6b125",
                  name: "Colden Festival",
                  city: "Colden",
                  county: "Erie",
                  when: "Sat–Sun",
                  venue: "Downtown Colden",
                  blurb: "A community festival with food trucks in Western New York.",
                },
                {
                  festivalId: "c70e2c1c-dc1c-41c9-ab24-7b9a4a8db17e",
                  name: "Festival of the Colors",
                  city: "Wilmington",
                  county: "Essex",
                  when: "Sat",
                  venue: "Festival Field",
                  blurb: "An Adirondack festival with food trucks.",
                },
                {
                  festivalId: "288dcbbf-643f-431f-a6cc-45a2501e38ad",
                  name: "Grand Prix Festival",
                  city: "Watkins Glen",
                  county: "Schuyler",
                  when: "Fri",
                  venue: "Franklin Street",
                  blurb: "A racing-themed street festival with food trucks. Friday only.",
                },
                {
                  festivalId: "4fd8ddfc-9ba9-4498-b636-a2e9234d3293",
                  name: "Roc Artists Open Market at Innovation Square",
                  city: "Rochester",
                  county: "Monroe",
                  when: "Recurring through Sept 27",
                  venue: "Innovation Square",
                  blurb: "A recurring artists' market with food trucks.",
                },
                {
                  festivalId: "4a21743a-2c7c-4aa7-9c95-ca17f7764b9e",
                  name: "Town of Greenfield Town-Wide Yard Sale",
                  city: "Greenfield Center",
                  county: "Saratoga",
                  when: "Sat–Sun",
                  venue: "14 Wilton Rd (next to the Post Office)",
                  blurb: "A town-wide yard sale with food vendors.",
                },
              ],
            },
          ],
        },
      ],
    },
    itemsHeading: "Before You Go",
    items: [
      {
        emoji: "📍",
        tag: "TIP",
        title: "Let the map find events for you",
        body: "Turn on location in the Hot Truck Map app and an \"Events near you\" banner appears on the map whenever something is on in your state. Tap it to see every listing, organized by county and town.",
      },
      {
        emoji: "🌦️",
        tag: "TIP",
        title: "Check the organizer's page the morning of",
        body: "Our listings come straight from what organizers publish, but outdoor events can move or cancel with the weather. A quick look before you leave can save you a wasted drive.",
      },
      {
        emoji: "🚚",
        tag: "TIP",
        title: "Working one of these festivals? Go live.",
        body: "Operators: flip to live on Hot Truck Map when you set up, so fans at the event and nearby can find your truck in real time.",
      },
    ],
    signOffPrompt: "Know a festival we missed, or running one yourself?",
  },
  {
    slug: "festivals-and-events",
    issue: 1,
    title: "Festivals & events land on the map",
    dateISO: "2026-08-25",
    dateLabel: "August 25, 2026",
    summary:
      "A new Events section for browsing food truck festivals by state, plus fresh cuisine filters and a smoother signup.",
    tldr: [
      "🎪 Browse food truck festivals & events by state — new /events section",
      "🌍 African and Caribbean cuisines added to search filters",
      "🔧 Operator signup and account deletion bugs fixed",
    ],
    headline: {
      emoji: "🎪",
      tag: "NEW FEATURE",
      title: "Browse food truck festivals by state",
      body: [
        "Food trucks don't just park on street corners — a huge amount of the scene happens at festivals, markets, and multi-truck events. Now Hot Truck Map has a home for that: pick a state, see what's coming up in each city, and get the details (dates, venue, website) without leaving the map.",
        "If you've granted the app your location, you'll also see an \"Events near you\" banner right on the map when something's happening close by. We're maintaining listings by hand for now, refreshed monthly, so what you see is curated rather than scraped.",
      ],
      cta: { label: "Browse Events", href: "/events" },
    },
    items: [
      {
        emoji: "🌍",
        tag: "NEW",
        title: "African and Caribbean cuisines added",
        body: "Two more cuisine categories are now searchable across the map and truck filters, making it easier to find — and for operators to be found under — the right label.",
      },
      {
        emoji: "🔧",
        tag: "FIX",
        title: "Operator signups no longer get miscategorized",
        body: "A bug was letting some operator accounts get classified as customers right after signup, which could hide a brand-new truck from its own dashboard. That's fixed — operator accounts now stay operator accounts from the moment you sign up.",
      },
      {
        emoji: "🔧",
        tag: "FIX",
        title: "Account deletion works reliably",
        body: "Some accounts were getting stuck mid-deletion due to a database constraint issue. Deleting your account now works cleanly every time, no matter when it was created.",
      },
    ],
  },
];

export function getIssueBySlug(slug: string): NewsletterIssue | undefined {
  return ISSUES.find((u) => u.slug === slug);
}

export function getAdjacentIssues(slug: string): {
  older: NewsletterIssue | undefined;
  newer: NewsletterIssue | undefined;
} {
  const idx = ISSUES.findIndex((u) => u.slug === slug);
  if (idx === -1) return { older: undefined, newer: undefined };
  return { older: ISSUES[idx + 1], newer: ISSUES[idx - 1] };
}

/** Rough reading time from headline, event guide and item word counts. Always ≥1 min. */
export function readMinutes(issue: NewsletterIssue): number {
  const count = (s: string) => s.split(/\s+/).length;
  const guideWords = (issue.eventGuide?.states ?? []).reduce(
    (sum, st) =>
      sum +
      count(st.intro) +
      st.groups.reduce(
        (g, grp) => g + grp.events.reduce((e, ev) => e + count(`${ev.name} ${ev.when} ${ev.blurb}`), 0),
        0
      ),
    0
  );
  const words =
    count(issue.headline.body.join(" ")) +
    guideWords +
    issue.items.reduce((sum, i) => sum + count(i.body), 0);
  return Math.max(1, Math.round(words / 200));
}

/** Label for when the next issue is expected, based on the latest issue's date. */
export function nextIssueLabel(issues: NewsletterIssue[] = ISSUES): string {
  const latest = issues[0];
  const next = new Date(latest.dateISO + "T00:00:00");
  next.setDate(next.getDate() + CADENCE_DAYS);
  return next.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
