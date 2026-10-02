const { defineConfig, devices } = require( '@playwright/test' );
const { getStorageStatePath } = require( './global-setup' );

/**
 * Playground is booted by global-setup.js, which writes the server URL to
 * process.env.WP_BASE_URL. Set WP_BASE_URL directly to skip the boot and use
 * an existing server (e.g. `npm run playground:start`).
 *
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig( {
	testDir: './tests/e2e',
	globalSetup: require.resolve( './global-setup' ),
	globalTeardown: require.resolve( './global-teardown' ),
	timeout: 120000,
	fullyParallel: false,
	forbidOnly: !! process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: [
		[ 'list' ],
		[ 'html', { open: process.env.CI ? 'never' : 'on-failure' } ],
		[ 'json', { outputFile: 'test-results/results.json' } ],
	],
	use: {
		baseURL: process.env.WP_BASE_URL,
		storageState: getStorageStatePath(),
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		actionTimeout: 15000,
		navigationTimeout: 30000,
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices[ 'Desktop Chrome' ] },
		},
	],
} );
