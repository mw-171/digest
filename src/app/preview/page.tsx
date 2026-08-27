// Fixture route: renders the digest chrome with sample data so the design can
// be checked without a Gmail session. Safe to delete.

import { DigestScreen, Shell } from "@/app/component/digest/digest-screen";
import {
  DigestSkeleton,
  MessageSkeleton,
} from "@/app/component/digest/skeletons";
import { CATEGORY_TITLES, type Digest, type DigestItem } from "@/lib/digest";
import { CATEGORIES, type Category, type Urgency } from "@/lib/digest-ai";

type Spec = {
  id: string;
  from: string;
  purpose: string;
  blurb: string;
  category: Category;
  urgency: Urgency;
  hour: number;
  needsReply?: boolean;
  due?: string;
  dueKind?: DigestItem["dueKind"];
  thread?: string;
  email?: string;
  invite?: DigestItem["invite"];
};

function item(spec: Spec): DigestItem {
  return {
    id: spec.id,
    threadId: spec.thread ?? spec.id,
    from: spec.from,
    fromEmail:
      spec.email ?? `${spec.from.split(" ")[0].toLowerCase()}@example.com`,
    subject: spec.purpose,
    snippet: spec.blurb,
    receivedAt: new Date(2026, 7, 20, spec.hour, 14).toISOString(),
    // Mixed on purpose, so the fixture shows both weights.
    unread: spec.urgency !== "low",
    labels: [],
    tab:
      spec.category === "social"
        ? "promotions"
        : spec.category === "work"
          ? "personal"
          : "updates",
    invite: spec.invite ?? null,
    category: spec.category,
    purpose: spec.purpose,
    blurb: spec.blurb,
    due: spec.due ?? "",
    dueKind: spec.invite ? "event" : (spec.dueKind ?? (spec.due ? "deadline" : "none")),
    urgency: spec.urgency,
    needsReply: spec.needsReply ?? false,
  };
}

const specs: Spec[] = [
  // ---- Work, high: what the day is actually for.
  {
    id: "1",
    from: "Priya Raghavan",
    purpose: "Approve two contract clauses",
    blurb: "Legal returned the redlines and needs a yes or no on both by Friday",
    category: "work",
    urgency: "high",
    needsReply: true,
    due: "2026-08-21",
    hour: 8,
  },
  {
    id: "2",
    from: "Marcus Lin",
    purpose: "Review the onboarding flow",
    blurb: "He is blocked on your read of the permissions screen before the build cut",
    category: "work",
    urgency: "high",
    needsReply: true,
    due: "2026-08-20",
    hour: 9,
  },
  // Same conversation, three messages: one card, not three.
  ...["2a", "2b", "2c"].map((id, index) => ({
    id,
    from: ["Marcus Lin", "Priya Raghavan", "Devi Sharma"][index],
    purpose: "Re: Review the onboarding flow",
    blurb: "Three people are still arguing about the permissions screen",
    category: "work" as const,
    urgency: "high" as const,
    needsReply: true,
    hour: 9,
    thread: "t-onboarding",
  })),
  {
    id: "3",
    from: "Hana Okafor",
    purpose: "Reply to an intro with Devi",
    blurb: "A double opt-in intro is waiting on your reply-all",
    category: "work",
    urgency: "normal",
    needsReply: true,
    hour: 10,
  },
  {
    id: "13",
    from: "Ravi Menon",
    purpose: "Sign the lease renewal",
    blurb: "Page 3 needs your signature before the 26th or it rolls monthly",
    category: "work",
    urgency: "normal",
    needsReply: true,
    due: "2026-08-26",
    hour: 12,
  },

  // ---- Meetings, including an unanswered invitation.
  {
    id: "11",
    from: "Priya Raghavan",
    purpose: "Quarterly planning",
    blurb: "",
    category: "meetings",
    urgency: "high",
    needsReply: true,
    hour: 10,
    invite: {
      summary: "Quarterly planning with the platform team",
      start: "2026-08-28T09:00:00.000Z",
      end: "2026-08-28T10:00:00.000Z",
      allDay: false,
      location: "Conf room 4",
      organizer: "Priya Raghavan",
      status: "needs-action",
      cancelled: false,
    },
  },
  {
    id: "12",
    from: "Marcus Lin",
    purpose: "Design review",
    blurb: "",
    category: "meetings",
    urgency: "normal",
    hour: 12,
    invite: {
      summary: "Design review",
      start: "2026-08-21T15:30:00.000Z",
      end: "2026-08-21T16:00:00.000Z",
      allDay: false,
      location: "Meet",
      organizer: "Marcus Lin",
      status: "accepted",
      cancelled: false,
    },
  },
  {
    id: "14",
    from: "Devi Sharma",
    purpose: "Notes from Tuesday's sync",
    blurb: "Action items landed on you for the sponsor tiers and the rubric export",
    category: "meetings",
    urgency: "normal",
    hour: 11,
  },

  // ---- Updates: receipts, statements, alerts.
  {
    id: "4",
    from: "Stripe",
    purpose: "$4,182 payout on its way",
    blurb: "A payout of $4,182.00 was initiated and should land on 22 August",
    category: "updates",
    urgency: "low",
    hour: 6,
    email: "no-reply@stripe.com",
  },
  {
    id: "5",
    from: "Foster Dental",
    purpose: "Dentist booked, 3 Sept 10:15",
    blurb: "Your appointment is confirmed and no reply is needed",
    category: "updates",
    urgency: "low",
    due: "2026-09-03",
    dueKind: "event",
    hour: 11,
  },
  {
    id: "6",
    from: "AWS Billing",
    purpose: "Spend ran $212 over baseline",
    blurb: "A cost anomaly in us-east-1 put the day $212 above your usual spend",
    category: "updates",
    urgency: "high",
    hour: 13,
    email: "alerts@aws.amazon.com",
  },
  // Overflow stress case: an unbroken token far wider than the column.
  {
    id: "10",
    from: "notifications-noreply-longsender@build.example-internal-services.com",
    purpose: "Nightly build finished",
    blurb:
      "https://tracking.example.com/click?id=abcdefghijklmnopqrstuvwxyz0123456789",
    category: "updates",
    urgency: "low",
    hour: 14,
  },

  // ---- Social: the pile that collapses into sender rows.
  // One busy bot thread plus six quiet ones, all under the same repo prefix:
  // the case the source grouping, the prefix stripping and the "+ N more" row
  // all exist for.
  ...["a", "b", "c", "d", "e", "f", "g", "h"].map((suffix, index) => ({
    id: `gh-${suffix}`,
    from: ["Max Jiang", "Vidu Kanugula", "GitHub"][index % 3],
    purpose: "[hackathon/my.hackthenorth.com] [ENG-3089] feat: add sponsor tiers",
    blurb: "",
    category: "social" as const,
    urgency: "low" as const,
    hour: 7 + index,
    thread: "t-gh-3089",
    email: "notifications@github.com",
  })),
  ...[
    "[ENG-3102] fix: schedule timezone drift",
    "[ENG-3095] chore: bump next to 16.3",
    "[ENG-3090] feat: judging rubric export",
    "[ENG-3081] fix: mentor queue ordering",
    "[ENG-3077] docs: sponsor onboarding",
    "[ENG-3070] feat: travel reimbursement form",
  ].map((subject, index) => ({
    id: `gh-pr-${index}`,
    from: "GitHub",
    purpose: `[hackathon/my.hackthenorth.com] ${subject}`,
    blurb: "",
    category: "social" as const,
    urgency: "low" as const,
    hour: 12 + index,
    thread: `t-gh-pr-${index}`,
    email: "notifications@github.com",
  })),
  {
    id: "li-1",
    from: "LinkedIn",
    purpose: "Nine new job matches",
    blurb: "",
    category: "social",
    urgency: "low",
    hour: 16,
    email: "jobs@linkedin.com",
  },
  {
    id: "li-2",
    from: "LinkedIn",
    purpose: "Priya viewed your profile",
    blurb: "",
    category: "social",
    urgency: "low",
    hour: 17,
    email: "notify@e.linkedin.com",
  },
  {
    id: "nl-1",
    from: "The Browser",
    purpose: "Five essays for the weekend",
    blurb: "",
    category: "social",
    urgency: "low",
    hour: 15,
    email: "hi@thebrowser.com",
  },
];

const URGENCY_ORDER: Record<Urgency, number> = { high: 0, normal: 1, low: 2 };

// The same order the real digest sorts in, so the fixture shows what a person
// would actually see rather than the order this file happens to list things.
const items = specs.map(item).sort((a, b) => {
  const urgency = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
  if (urgency !== 0) return urgency;
  if (a.needsReply !== b.needsReply) return a.needsReply ? -1 : 1;
  if (a.due !== b.due) return a.due && b.due ? a.due.localeCompare(b.due) : a.due ? -1 : 1;
  return b.receivedAt.localeCompare(a.receivedAt);
});

// Seven days ending today, the window the real rail uses. The selected day
// sits mid-rail so the preview shows a selection that is not at either end.
const week = [
  { date: "17", weekday: "M", count: 12 },
  { date: "18", weekday: "T", count: 21 },
  { date: "19", weekday: "W", count: 16 },
  { date: "20", weekday: "T", count: 23 },
  { date: "21", weekday: "F", count: 9 },
  { date: "22", weekday: "S", count: 3 },
  { date: "23", weekday: "S", count: 0 },
];

const digest: Digest = {
  day: "2026-08-20",
  recap: "Two things need signing off before Friday. Everything else can wait.",
  source: "claude",
  total: items.length,
  truncated: false,
  categories: CATEGORIES.map((key) => {
    const group = items.filter((entry) => entry.category === key);
    return {
      key,
      title: CATEGORY_TITLES[key],
      count: group.length,
      replies: group.filter((entry) => entry.needsReply).length,
    };
  }),
  items,
  week: week.map((day) => ({
    day: `2026-08-${day.date}`,
    weekday: day.weekday,
    date: day.date,
    count: day.count,
    weight: day.count / 23,
    selected: day.date === "20",
    isToday: day.date === "23",
  })),
};

export default async function Preview({ searchParams }: PageProps<"/preview">) {
  const view = (await searchParams).view;

  if (view === "loading") {
    return (
      <Shell>
        <DigestSkeleton />
      </Shell>
    );
  }

  if (view === "message") return <MessageSkeleton />;

  // The fixture's week marks the 23rd as today while the digest shows the
  // 20th, so the route demonstrates a past day: Today button in, times out.
  return <DigestScreen digest={digest} today="2026-08-23" />;
}
