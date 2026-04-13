import { redirect } from "next/navigation";

// /truck without an ID redirects to the home map
export default function TruckIndexPage() {
  redirect("/");
}
