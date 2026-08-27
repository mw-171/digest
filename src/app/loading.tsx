import { DigestSkeleton } from "./component/digest/skeletons";
import { Shell } from "./component/digest/layout-frame";

export default function Loading() {
  return (
    <Shell>
      <DigestSkeleton />
    </Shell>
  );
}
