const fs = require( 'node:fs' );
const path = require( 'node:path' );
const crypto = require( 'node:crypto' );

const STORAGE_STATE_PATH =
	process.env.STORAGE_STATE_PATH ||
	path.join( process.cwd(), 'artifacts/storage-states/admin.json' );

/**
 * Deterministic port from cwd hash so each git worktree gets its own
 * Playground instance. Override with WP_PLAYGROUND_PORT (e.g. in CI).
 * Range: 9400–9499.
 */
function resolvePort() {
	if ( process.env.WP_PLAYGROUND_PORT ) {
		return Number( process.env.WP_PLAYGROUND_PORT );
	}
	const hash = crypto.createHash( 'sha1' ).update( process.cwd() ).digest();
	return 9400 + ( hash.readUInt16BE( 0 ) % 100 );
}

/**
 * Boots one Playground instance for the whole run, unless WP_BASE_URL is
 * already set. Reads ./blueprint.json (or WP_BLUEPRINT_PATH) and auto-mounts
 * the project directory, which also activates the plugin.
 *
 * WP_PLAYGROUND_PHP / WP_PLAYGROUND_WP override the blueprint's
 * preferredVersions, because the CLI lets the blueprint win over its own
 * `php` / `wp` arguments.
 */
async function startPlayground() {
	const { runCLI } = require( '@wp-playground/cli' );

	const blueprintPath = process.env.WP_BLUEPRINT_PATH
		? path.resolve( process.env.WP_BLUEPRINT_PATH )
		: path.resolve( process.cwd(), 'blueprint.json' );
	const blueprint = JSON.parse( fs.readFileSync( blueprintPath, 'utf8' ) );
	const php =
		process.env.WP_PLAYGROUND_PHP || blueprint.preferredVersions?.php;
	const wp = process.env.WP_PLAYGROUND_WP || blueprint.preferredVersions?.wp;
	blueprint.preferredVersions = { ...blueprint.preferredVersions, php, wp };

	const options = {
		command: 'server',
		port: resolvePort(),
		php,
		wp,
		autoMount: process.cwd(),
		blueprint,
	};

	// Booting downloads WordPress and can hit a transient network error, so try twice.
	let cli;
	try {
		cli = await runCLI( options );
	} catch ( error ) {
		// eslint-disable-next-line no-console
		console.warn(
			`Playground failed to start, retrying: ${ error.message }`
		);
		cli = await runCLI( options );
	}

	process.env.WP_BASE_URL = cli.serverUrl;
	globalThis.__wpPlayground = cli;
}

/**
 * Logs in over REST, saves the admin cookies and nonce where the
 * e2e-test-utils-playwright fixtures and the browser context expect them,
 * and stores editor preferences on the user so the welcome guide stays shut.
 */
async function setUpAdmin() {
	// Loaded late: the package reads WP_BASE_URL when it is first required.
	const { RequestUtils } = require( '@wordpress/e2e-test-utils-playwright' );

	const requestUtils = await RequestUtils.setup( {
		baseURL: process.env.WP_BASE_URL,
		storageStatePath: STORAGE_STATE_PATH,
	} );
	await requestUtils.setupRest();

	const user = await requestUtils.rest( {
		path: '/wp/v2/users/me',
		params: { context: 'edit' },
	} );
	const preferences = user.meta?.persisted_preferences || {};
	await requestUtils.rest( {
		method: 'POST',
		path: '/wp/v2/users/me',
		data: {
			meta: {
				persisted_preferences: {
					...preferences,
					'core/edit-post': {
						...preferences[ 'core/edit-post' ],
						welcomeGuide: false,
						fullscreenMode: false,
					},
					_modified: new Date().toISOString(),
				},
			},
		},
	} );

	await requestUtils.request.dispose();
}

module.exports = async () => {
	if ( ! process.env.WP_BASE_URL ) {
		await startPlayground();
	}
	await setUpAdmin();
};

module.exports.STORAGE_STATE_PATH = STORAGE_STATE_PATH;
