/**
 * Deep links into Gmail. Kept apart from `gmail.ts` on purpose: that module
 * imports `googleapis`, and a client component asking for one URL would
 * otherwise pull the entire SDK — and its Node built-ins — into the browser
 * bundle.
 */

/**
 * A link that opens the real thing. Gmail accepts an address where the `u/0`
 * account index normally goes, which is what makes this land in the right
 * mailbox for someone signed into several — and on a phone the same URL hands
 * off to the Gmail app rather than the mobile web view.
 */
export function gmailThreadUrl(threadId: string, account = "") {
  const who = account ? encodeURIComponent(account) : "0";
  return `https://mail.google.com/mail/u/${who}/#all/${threadId}`;
}
