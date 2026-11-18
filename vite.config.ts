import { svelteTesting } from '@testing-library/svelte/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import fs from 'node:fs';
import os from 'node:os';
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
	server: {
    host: true, // Listens on all local IP addresses
    port: 5173,
	
	},
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
		// dev only: serve the local mkcert root CA at /rootCA.pem so other devices on the LAN can install it
		// (served from the plugin's own folder, never copied into public/ or the build)
		command === 'serve'
			? {
					name: 'serve-root-ca',
					configureServer(server) {
						server.middlewares.use('/rootCA.pem', (_req, res, next) => {
							const file = path.join(os.homedir(), '.vite-plugin-mkcert', 'rootCA.pem');
							if (!fs.existsSync(file)) return next();
							res.setHeader('Content-Type', 'application/x-x509-ca-cert');
							res.setHeader('Content-Disposition', 'attachment; filename="rootCA.pem"');
							res.end(fs.readFileSync(file));
						});
					}
				}
			: null,
		// the e2e run serves plain http so pages can talk to a local ws:// relay without mixed-content issues
		// (and it is only needed by the dev server: CI builds must not try to install a local CA)
		process.env.E2E || command !== 'serve' ? null : mkcert(),
		tailwindcss(),
		// superdough imports its audio worklets as `?audioworklet`; tests never load them
		process.env.VITEST ? null : bundleAudioWorklet(),
		sveltekit()
	],
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
