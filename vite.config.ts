import { svelteTesting } from '@testing-library/svelte/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';
import tailwindcss from '@tailwindcss/vite'
import bundleAudioWorklet from 'vite-plugin-bundle-audioworklet'
import mkcert from 'vite-plugin-mkcert'
import { defineConfig } from 'vitest/config';

const dirname =
	typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/writing-tests/test-addon
export default defineConfig(({ command }) => ({
	// Tell Vitest to use the `browser` entry points in `package.json` files, even though it's running in Node
	resolve: process.env.VITEST
		? {
				conditions: ['browser']
			}
		: {
				// @strudel/web's published bundle has its own private copy of core and webaudio, so sounds
				// registered by other @strudel packages (the gm_* soundfonts) never reach its player. Use its
				// unbundled source instead, so every package shares one sound registry and one AudioContext.
				alias: { '@strudel/web': path.join(dirname, 'node_modules/@strudel/web/web.mjs') }
			},
	plugins: [
		// the e2e run serves plain http so pages can talk to a local ws:// relay without mixed-content issues
		// (and it is only needed by the dev server: CI builds must not try to install a local CA)
		process.env.E2E || command !== 'serve' ? null : mkcert(),
		tailwindcss(),
		// superdough imports its audio worklets as `?audioworklet`; tests never load them
		process.env.VITEST ? null : bundleAudioWorklet(),
		sveltekit()
	],
	esbuild: {
		minifyIdentifiers: false,
		keepNames: true,
	  },
	test: {
		workspace: [
			{
				extends: './vite.config.ts',
				plugins: [svelteTesting()],
				test: {
					name: 'client',
					environment: 'jsdom',
					clearMocks: true,
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				extends: true,
				plugins: [
					// The plugin will run tests for the stories defined in your Storybook config
					// See options at: https://storybook.js.org/docs/writing-tests/test-addon#storybooktest
					storybookTest({
						configDir: path.join(dirname, '.storybook')
					})
				],
				test: {
					name: 'storybook',
					browser: {
						enabled: true,
						headless: true,
						provider: 'playwright',
						instances: [
							{
								browser: 'chromium'
							}
						]
					},
					setupFiles: ['.storybook/vitest.setup.ts']
				}
			}
		]
	}
}));
