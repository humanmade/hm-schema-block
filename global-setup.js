const fs = require( 'node:fs' );
const path = require( 'node:path' );
const crypto = require( 'node:crypto' );
const net = require( 'node:net' );

/**
 * Where the logged-in admin state is saved. Each run started by global setup sets its own
 * file, named after its port, so runs in the same checkout don't share cookies.
 *
 * @return {string} Path.
 */
function getStorageStatePath() {
	return (
		process.env.STORAGE_STATE_PATH ||
		path.join( process.cwd(), 'artifacts/storage-states/admin.json' )
	);
}

/**
 * Ask the OS for a free port so any number of runs, in any checkout, can boot Playground at
 * once. WP_PLAYGROUND_PORT picks a fixed port instead (e.g. in CI).
 *
 * @return {Promise<number>} Port.
 */
function resolvePort() {
	if ( process.env.WP_PLAYGROUND_PORT ) {
		return Promise.resolve( Number( process.env.WP_PLAYGROUND_PORT ) );
	}

	return new Promise( ( resolve, reject ) => {
		const server = net.createServer();
		server.unref();
		server.on( 'error', reject );
		server.listen( 0, '127.0.0.1', () => {
			const { port } = server.address();
			server.close( () => resolve( port ) );
		} );
	} );
}

/**
 * Random values for the wp-config.php auth keys and salts.
 *
 * @return {Object} Constant name => value.
 */
function generateSalts() {
	const names = [ 'AUTH', 'SECURE_AUTH', 'LOGGED_IN', 'NONCE' ];
	return Object.fromEntries(
		names.flatMap( ( name ) => [
			[ `${ name }_KEY`, crypto.randomBytes( 32 ).toString( 'hex' ) ],
			[ `${ name }_SALT`, crypto.randomBytes( 32 ).toString( 'hex' ) ],
		] )
	);
}

/**
 * Boots one Playground instance for the whole run, unless WP_BASE_URL is
 * already set. Reads ./blueprint.json (or WP_BLUEPRINT_PATH) and auto-mounts
 * the project directory, which also activates the plugin.
 *
 * WP_PLAYGROUND_PHP / WP_PLAYGROUND_WP override the blueprint's
 * preferredVersions, because the CLI lets the blueprint win over its own
 * `php` / `wp` arguments.
 *
 * Drops the blueprint's `login` step, since setUpAdmin() logs in, and writes
 * random salts to wp-config.php.
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
	blueprint.steps = [
		{ step: 'defineWpConfigConsts', consts: generateSalts() },
		...( blueprint.steps || [] ).filter(
			( step ) => step.step !== 'login'
		),
	];

	const port = await resolvePort();

	if ( ! process.env.STORAGE_STATE_PATH ) {
		process.env.STORAGE_STATE_PATH = path.join(
			process.cwd(),
			'artifacts/storage-states',
			`admin-${ port }.json`
		);
	}

	const options = {
		command: 'server',
		port,
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
		storageStatePath: getStorageStatePath(),
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

module.exports.getStorageStatePath = getStorageStatePath;
