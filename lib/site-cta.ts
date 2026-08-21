/**
 * A site can accept paid orders, exchanges, or both — the call-to-action
 * text should say what's actually about to happen, not the generic
 * "Request this link" that was previously hardcoded everywhere:
 *
 *  - Paid only (typical guest post): "Order this link" — money changes
 *    hands, it's an order, not a request.
 *  - Exchange only: "Request link exchange" — no payment, it's a
 *    proposal the seller can accept/decline.
 *  - Both: "Order or request exchange" — the buyer picks on the next
 *    step (see RequestLinkForm's toggle).
 */
export function siteCtaLabel(acceptsPaid: boolean, acceptsExchange: boolean): string {
  if (acceptsPaid && !acceptsExchange) return "Order this link";
  if (acceptsExchange && !acceptsPaid) return "Request link exchange";
  return "Order or request exchange";
}
