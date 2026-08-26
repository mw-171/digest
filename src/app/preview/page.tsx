// Fixture route: renders the digest chrome with sample data so the design can
// be checked without a Gmail session. Safe to delete.

import { DigestScreen, Shell } from "@/app/component/digest/digest-screen";
import { DigestSkeleton } from "@/app/component/digest/skeletons";
import type { Digest, DigestItem } from "@/lib/digest";
import type { Band } from "@/lib/digest-ai";

function item(
  id: string,
  from: string,
  purpose: string,
  due: string,
  band: Band,
  hour: number,
  invite: DigestItem["invite"] = null,
): DigestItem {
  return {
    id,
    threadId: id,
    from,
    fromEmail: `${from.split(" ")[0].toLowerCase()}@example.com`,
    subject: purpose,
    snippet: "",
    receivedAt: new Date(2026, 7, 20, hour, 14).toISOString(),
    unread: true,
    labels: [],
    category: band === "noise" ? "promotions" : "personal",
    invite,
    purpose,
    due,
    band,
  };
}


const digest: Digest = {
  day: "2026-08-20",
  recap: "Two things need signing off before Friday. Everything else can wait.",
  source: "claude",
  total: 9,
  truncated: false,
  bands: [
    {
      key: "needs",
      title: "NEEDS YOU",
      items: [
        item("1", "Priya Raghavan", "Approve two contract clauses", "2026-08-21", "needs", 8),
        item("2", "Marcus Lin", "Review the onboarding flow", "2026-08-20", "needs", 9),
        item("3", "Devi Sharma", "Reply to an intro with Devi", "", "needs", 10),
        // An unanswered invitation: same tier, its own card.
        item("11", "Priya Raghavan", "Quarterly planning", "", "needs", 10, {
          summary: "Quarterly planning with the platform team",
          start: "2026-08-28T09:00:00.000Z",
          end: "2026-08-28T10:00:00.000Z",
          allDay: false,
          location: "Conf room 4",
          organizer: "Priya Raghavan",
          status: "needs-action",
          cancelled: false,
        }),
      ],
    },
    {
      key: "fyi",
      title: "FYI",
      items: [
        item("4", "Stripe", "$4,182 payout on its way", "", "fyi", 6),
        item("5", "Foster Dental", "Dentist booked, 3 Sept 10:15", "", "fyi", 11),
        item("6", "Ramp", "Spend ran $212 over baseline", "", "fyi", 13),
        // Answered, so it needs nothing — but still an invite card.
        item("12", "Marcus Lin", "Design review", "", "fyi", 12, {
          summary: "Design review",
          start: "2026-08-21T15:30:00.000Z",
          end: "2026-08-21T16:00:00.000Z",
          allDay: false,
          location: "Meet",
          organizer: "Marcus Lin",
          status: "accepted",
          cancelled: false,
        }),
        // Overflow stress case: an unbroken token far wider than the column.
        item(
          "10",
          "notifications-noreply-longsender@build.example-internal-services.com",
          "https://tracking.example.com/click?id=abcdefghijklmnopqrstuvwxyz0123456789",
          "",
          "fyi",
          14,
        ),
      ],
    },
  ],
  noise: [
    item("7", "Linear", "Weekly workspace digest", "", "noise", 7),
    item("8", "The Browser", "Five essays for the weekend", "", "noise", 15),
    item("9", "LinkedIn", "Nine new job matches", "", "noise", 16),
  ],
  week: [
    { day: "2026-08-17", weekday: "M", date: "17", count: 12, height: 26, selected: false, isToday: false },
    { day: "2026-08-18", weekday: "T", date: "18", count: 21, height: 44, selected: false, isToday: false },
    { day: "2026-08-19", weekday: "W", date: "19", count: 16, height: 34, selected: false, isToday: false },
    { day: "2026-08-20", weekday: "T", date: "20", count: 23, height: 48, selected: true, isToday: true },
    { day: "2026-08-21", weekday: "F", date: "21", count: 9, height: 19, selected: false, isToday: false },
    { day: "2026-08-22", weekday: "S", date: "22", count: 2, height: 5, selected: false, isToday: false },
    { day: "2026-08-23", weekday: "S", date: "23", count: 0, height: 5, selected: false, isToday: false },
  ],
};

/** `?state=loading` and `?state=empty` render the other two screens. */
export default async function Preview({ searchParams }: PageProps<"/preview">) {
  const state = (await searchParams).state;

  if (state === "loading") {
    return (
      <Shell>
        <DigestSkeleton />
      </Shell>
    );
  }

  if (state === "empty") {
    return (
      <DigestScreen
        digest={{
          ...digest,
          total: 0,
          bands: [],
          noise: [],
          recap: "Nothing arrived.",
        }}
      />
    );
  }

  return <DigestScreen digest={digest} />;
}
