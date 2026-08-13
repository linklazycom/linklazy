import { redirect } from "next/navigation";

// /contact is now /support — this permanent redirect keeps any existing
// bookmarks, backlinks, or indexed search results working.
export default function ContactRedirectPage() {
  redirect("/support");
}
