import { redirect } from "next/navigation";

// "Go Live" is the `live` tab on the dashboard.
export default function Page() {
  redirect("/dashboard?tab=live");
}
