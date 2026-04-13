import { redirect } from "next/navigation";

// The map is now the home page — redirect /map → /
export default function MapPage() {
  redirect("/");
}
