import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Keep visited pages in the client router cache for a minute.
     *
     * Both routes here are dynamic (they read cookies), so Next's default of 0
     * throws the rendered page away the moment you navigate off it: opening a
     * message and coming back re-rendered the digest from scratch, loading
     * skeleton and all. A minute is long enough to cover reading one email and
     * returning, and short enough that a deliberate reload is still the way to
     * get fresh mail.
     */
    staleTimes: { dynamic: 60, static: 300 },
  },
};

export default nextConfig;
