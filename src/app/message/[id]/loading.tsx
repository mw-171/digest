import { MessageSkeleton } from "@/app/component/digest/skeletons";

/**
 * Without this file the digest's own `app/loading.tsx` would stand in for the
 * detail route too — tapping a message would flash a whole fake inbox before
 * the message appeared. A route gets the nearest loading boundary above it, so
 * the detail view needs its own.
 */
export default function Loading() {
  return <MessageSkeleton />;
}
