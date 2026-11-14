import { defineConfig } from 'vitest/config';

// Real-browser tests: two Chromium pages talk through Trystero + a local relay (see e2e/global-setup.ts).
// Run with `yarn test:e2e`. Kept out of the default `yarn test` because it spawns a dev server and browsers.
export default defineConfig({
	test: {
		name: 'e2e',
		environment: 'node',
		include: ['e2e/**/*.e2e.ts'],
		globalSetup: ['e2e/global-setup.ts'],
		testTimeout: 60_000,
		hookTimeout: 120_000,
		fileParallelism: false
	}
});
