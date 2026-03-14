import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Standalone output produces a self-contained server.js + only the files
	// needed at runtime — no full node_modules in the production image.
	output: "standalone",
};

export default nextConfig;
