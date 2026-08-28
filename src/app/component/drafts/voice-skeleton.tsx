import { Column } from "@/app/component/digest/layout-frame";

const STATS = [1, 2, 3];
const LINES = [1, 2, 3];

/**
 * The same frame the read lands in — summary, three counts, two sections — so
 * the arriving page settles into place rather than replacing something else.
 */
export function VoiceSkeleton() {
  return (
    <Column className="animate-pulse pb-4">
      <div className="pb-5 pt-5">
        <div className="h-3 w-[88%] rounded-full bg-bg-weak-50" />
        <div className="mt-2.5 h-3 w-[74%] rounded-full bg-bg-weak-50" />
        <div className="mt-2.5 h-3 w-[46%] rounded-full bg-bg-weak-50" />
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {STATS.map((stat) => (
          <div
            key={stat}
            className="h-[76px] rounded-2xl bg-bg-weak-50 md:h-[84px]"
          />
        ))}
      </div>

      {LINES.map((section) => (
        <div key={section} className="pt-8">
          <div className="h-2.5 w-24 rounded-full bg-bg-weak-50" />
          <div className="mt-4 flex flex-col gap-3">
            {LINES.map((line) => (
              <div key={line}>
                <div className="h-2.5 w-[34%] rounded-full bg-bg-weak-50" />
                <div className="mt-2 h-2.5 w-[80%] rounded-full bg-bg-soft-200/60" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Column>
  );
}
