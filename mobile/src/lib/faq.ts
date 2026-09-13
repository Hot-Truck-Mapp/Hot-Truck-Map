// Copy shared by the Contact and Support screens — kept word-for-word with
// app/contact/page.tsx and app/support/page.tsx on the web.

export const SUPPORT_EMAIL = 'hottruckmap@gmail.com';

export const CONTACT_SUBJECTS = [
  'General Question',
  'List My Truck',
  'Report an Issue',
  'Partnership / Press',
  'Other',
] as const;

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'How do I list my food truck?',
    a: "Sign up as an operator at /signup. Once your account is approved you'll be able to create your truck profile, add your menu, and go live.",
  },
  {
    q: 'How much does Hot Truck Map cost?',
    a: "Hot Truck Map is currently free for both customers and operators while we grow the community. We may introduce optional paid features for operators in the future — if so, we'll communicate any changes well in advance.",
  },
  {
    q: 'How does Go Live work?',
    a: 'Operators tap the Go Live button in their dashboard to share their real-time GPS location. Customers nearby can then see the truck on the map and place pre-orders.',
  },
  {
    q: 'Can I order from any truck?',
    a: 'You can only place orders from trucks that are currently live and accepting orders. If a truck is offline, you can still browse its menu and follow it to get notified when it goes live.',
  },
  {
    q: 'How do I report an issue?',
    a: 'Use the contact form on this page or email us directly at hottruckmap@gmail.com. We aim to respond within 24 hours.',
  },
];
