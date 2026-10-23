export const metadata = { robots: { index: false, follow: false } };

/** A support ticket is private: keep it out of search results. */
export default function SupportTicketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
