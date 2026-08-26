// Fixture route: renders the digest chrome with sample data so the design can
// be checked without a Gmail session. Safe to delete.

import { DigestScreen, Shell } from "@/app/component/digest/digest-screen";
import { DigestSkeleton, MessageSkeleton } from "@/app/component/digest/skeletons";
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
  dueKind: DigestItem["dueKind"] = due ? "deadline" : "none",
  thread = id,
  email?: string,
): DigestItem {
  return {
    id,
    threadId: thread,
    from,
    fromEmail: email ?? `${from.split(" ")[0].toLowerCase()}@example.com`,
    subject: purpose,
    snippet: "",
    receivedAt: new Date(2026, 7, 20, hour, 14).toISOString(),
    unread: true,
    labels: [],
    category: band === "noise" ? "promotions" : "personal",
    invite,
    purpose,
    due,
    dueKind: invite ? "event" : dueKind,
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
        // Same conversation, three messages: one card, not three.
        item("2a", "Marcus Lin", "Re: Review the onboarding flow", "", "needs", 9, null, "none", "t-onboarding"),
        item("2b", "Priya Raghavan", "Re: Review the onboarding flow", "", "needs", 9, null, "none", "t-onboarding"),
        item("2c", "Devi Sharma", "Review the onboarding flow", "", "needs", 8, null, "none", "t-onboarding"),
        item("3", "Devi Sharma", "Reply to an intro with Devi", "", "needs", 10),
        // A deadline further out: the one case that still says "by".
        item("13", "Ravi Menon", "Sign the renewal", "2026-08-26", "needs", 12),
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
        // An event date, not a deadline: it reads "3 Sept", never "by 3 Sept".
        item("5", "Foster Dental", "Dentist appointment", "2026-09-03", "fyi", 11, null, "event"),
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
    // One busy bot thread plus six quiet ones, all under the same repo prefix:
    // the case the source grouping, the prefix stripping and the "+ N more"
    // row all exist for.
    ...["a", "b", "c", "d", "e", "f", "g", "h"].map((suffix, index) =>
      item(
        `gh-${suffix}`,
        ["Max Jiang", "Vidu Kanugula", "GitHub"][index % 3],
        "[hackathon/my.hackthenorth.com] [ENG-3089] feat: add sponsor tiers",
        "",
        "noise",
        7 + index,
        null,
        "none",
        "t-gh-3089",
        "notifications@github.com",
      ),
    ),
    ...[
      "[ENG-3102] fix: schedule timezone drift",
      "[ENG-3095] chore: bump next to 16.3",
      "[ENG-3090] feat: judging rubric export",
      "[ENG-3081] fix: mentor queue ordering",
      "[ENG-3077] docs: sponsor onboarding",
      "[ENG-3070] feat: travel reimbursement form",
    ].map((subject, index) =>
      item(
        `gh-pr-${index}`,
        "GitHub",
        `[hackathon/my.hackthenorth.com] ${subject}`,
        "",
        "noise",
        12 + index,
        null,
        "none",
        `t-gh-pr-${index}`,
        "notifications@github.com",
      ),
    ),
    item("li-1", "LinkedIn", "Nine new job matches", "", "noise", 16, null, "none", "li-1", "jobs@linkedin.com"),
    item("li-2", "LinkedIn", "Priya viewed your profile", "", "noise", 17, null, "none", "li-2", "notify@e.linkedin.com"),
    item("nl-1", "The Browser", "Five essays for the weekend", "", "noise", 15, null, "none", "nl-1", "hi@thebrowser.com"),
    item("nl-2", "Linear", "Weekly workspace digest", "", "noise", 7, null, "none", "nl-2", "digest@linear.app"),
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

/** `?state=loading`, `?state=message` and `?state=empty` render the other screens. */
export default async function Preview({ searchParams }: PageProps<"/preview">) {
  const state = (await searchParams).state;

  if (state === "loading") {
    return (
      <Shell>
        <DigestSkeleton />
      </Shell>
    );
  }

  if (state === "message") {
    return <MessageSkeleton />;
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
