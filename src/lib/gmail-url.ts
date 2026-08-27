// Kept out of `gmail.ts`: that module imports `googleapis`, which a client
// component asking for one URL would drag into the browser bundle.

const MAIL = "https://mail.google.com/mail";

// The account goes in `authuser`, never the `u/` segment — that one takes an
// account *index*, so an address there is a URL Gmail cannot resolve.
export function gmailThreadUrl(threadId: string, account = "") {
  if (!threadId) return `${MAIL}/u/0/`;

  const base = account
    ? `${MAIL}/?authuser=${encodeURIComponent(account)}`
    : `${MAIL}/u/0/`;

  // `all` rather than `inbox`, so the link still resolves once it is archived.
  return `${base}#all/${threadId}`;
}
