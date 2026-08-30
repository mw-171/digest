/**
 * What a request actually paid for. Prompt caching is a prefix match, so one
 * changed byte ahead of the breakpoint turns every read into a write with no
 * error raised and nothing to notice but the bill. Set DIGEST_CACHE_DEBUG=1 to
 * watch the three numbers: reads should climb and writes should stop after the
 * first call of a run.
 */
type CacheUsage = {
  input_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export function logCacheUsage(label: string, usage: CacheUsage) {
  if (process.env.DIGEST_CACHE_DEBUG !== "1") return;

  const wrote = usage.cache_creation_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  console.log(
    `[cache] ${label}: read ${read}, wrote ${wrote}, uncached ${usage.input_tokens}`,
  );
}
