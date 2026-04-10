# TruckMaps 🚚
Find the food truck. Skip the guesswork.
A real-time food truck discovery platform built with Next.js, Supabase, and Mapbox.

## Getting Started
1. Clone the repo
2. Copy `.env.example` to `.env.local` and fill in your keys
3. Run `npm install`
4. Run `npm run dev`
5. Open http://localhost:3000

## Tech Stack
- **Frontend**: Next.js 16, TypeScript, Tailwind CSS
- **Database**: Supabase (Postgres + Realtime + PostGIS)
- **Maps**: Mapbox GL JS
- **Payments**: Stripe Connect
- **Notifications**: OneSignal + Twilio
- **Hosting**: Vercel

## Features
- 🗺️ Real-time map with live truck locations
- 📍 Custom food truck pins with clustering
- 🔍 Filter by cuisine type and open now
- 👤 User roles: customer, operator, admin
- 🚚 Operator onboarding flow
- ✉️ Email verification before going live
- 💳 Stripe payments for operators

## Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
STRIPE_SECRET_KEY=
```