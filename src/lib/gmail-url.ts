/**
 * Deep links into Gmail. Kept apart from `gmail.ts` on purpose: that module
 * imports `googleapis`, and a client component asking for one URL would
 * otherwise pull the entire SDK — and its Node built-ins — into the browser
 * bundle.
 */

const MAIL = "https://mail.google.com/mail";

/**
 * A link that opens the real thing, in the right mailbox for someone signed
 * into several. The account goes in `authuser`, not in the `u/` path segment:
 * that segment takes an account *index*, so an address there — encoded to
 * `%40` no less — is a URL Gmail cannot resolve.
 */
export function gmailThreadUrl(threadId: string, account = "") {
  if (!threadId) return `${MAIL}/u/0/`;

  const base = account
    ? `${MAIL}/?authuser=${encodeURIComponent(account)}`
    : `${MAIL}/u/0/`;

  // `all` rather than `inbox`, so the link still resolves once it is archived.
  return `${base}#all/${threadId}`;
}
