import { redirect } from "next/navigation";

// The dashboard is a single page with tabbed sections. This route exists so a
// bookmarked or linked /dashboard/analytics still lands on the right tab instead of
// dropping the operator on whichever tab the dashboard opens by default.
export default function Page() {
  redirect("/dashboard?tab=analytics");
}
