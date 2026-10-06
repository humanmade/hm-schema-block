/**
 * Records the demo video and takes the README screenshots. Opt-in: set SCHEMA_DEMO=1
 * (npm run demo:record). Writes docs/media/demo.mp4, docs/media/demo.gif and
 * docs/media/screenshots/*.png; needs ffmpeg for the video and the GIF.
 *
 * @package
 */

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { spawnSync } = require( 'node:child_process' );
const {
	Admin,
	Editor,
	PageUtils,
} = require( '@wordpress/e2e-test-utils-playwright' );

const { test, expect } = require( './fixtures' );
const { overlayScript, Demo, encode } = require( './demo-helpers' );
const { getStorageStatePath } = require( '../../global-setup' );

const MEDIA_DIR = path.join( process.cwd(), 'docs/media' );
const SHOT_DIR = path.join( MEDIA_DIR, 'screenshots' );
const RAW_DIR = path.join( process.cwd(), 'artifacts/demo' );
const TEMPLATE = '/wp/v2/templates/twentytwentyfive//single';
const SIZE = { width: 1280, height: 800 };
const TALL = { width: 1280, height: 1400 };

// The single template before the demo types it: header, an untyped main group, an
// untyped group around the post title and content, and the footer.
const PLAIN_TEMPLATE = [
	'<!-- wp:template-part {"slug":"header","tagName":"header"} /-->',
	'<!-- wp:group {"tagName":"main","style":{"spacing":{"margin":{"top":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->',
	'<main class="wp-block-group" style="margin-top:var(--wp--preset--spacing--60)">',
	'<!-- wp:group {"layout":{"type":"constrained"}} -->',
	'<div class="wp-block-group">',
	'<!-- wp:post-title {"level":1} /-->',
	'<!-- wp:post-content {"layout":{"type":"constrained"}} /-->',
	'</div>',
	'<!-- /wp:group -->',
	'</main>',
	'<!-- /wp:group -->',
	'<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->',
].join( '\n' );

const QUESTIONS = [
	[
		'How long does dough need to rise?',
		'Usually one to two hours, until it doubles in size.',
	],
	[
		'Can I freeze bread?',
		'Yes. Wrap it well and freeze it for up to three months.',
	],
];

// The FAQ pattern with the first answer left empty, for the pre-publish check.
const FIRST_ANSWER =
	'<p>Most orders arrive within 3 to 5 working days. You can track your parcel on <a href="https://example.com/track">our tracking page</a>.</p>';
const INCOMPLETE_FAQ = fs
	.readFileSync( path.join( process.cwd(), 'patterns/faq.html' ), 'utf8' )
	.replace( FIRST_ANSWER, '<p></p>' );

// The parts of the video in the README GIF: [ from mark, to mark, speed ].
const GIF_PARTS = [
	[ 'gifFrom', 'typeFrom', 1.6 ],
	[ 'typeFrom', 'typeTo', 3 ],
	[ 'typeTo', 'faqTo', 1.9 ],
	[ 'siteFrom', 'siteTo', 1.7 ],
	[ 'graphFrom', 'graphTo', 1.7 ],
	[ 'endFrom', 'end', 2 ],
];

const shotPath = ( file ) => path.join( SHOT_DIR, file );

// The Schema.org panel in the editor sidebar.
const mappingPanel = ( page ) =>
	page
		.getByRole( 'region', { name: 'Editor settings' } )
		.locator( '.components-panel__body', {
			has: page.getByRole( 'button', {
				name: 'Schema.org',
				exact: true,
			} ),
		} );

// The block's Advanced panel, which holds the graph controls.
const advancedPanel = ( page ) =>
	page
		.getByRole( 'region', { name: 'Editor settings' } )
		.locator( '.components-panel__body', {
			has: page.getByRole( 'button', { name: 'Advanced', exact: true } ),
		} );

/**
 * Opens Settings > Block > Schema.org for the selected block, with visible clicks
 * when a demo is given, and scrolls the panel to the top of the sidebar.
 *
 * @param {Object} page   Playwright page.
 * @param {Object} editor Editor utils for the page.
 * @param {Demo}   demo   Optional demo that clicks at a watchable pace.
 * @return {Promise<Object>} The sidebar locator.
 */
async function openSchemaPanel( page, editor, demo ) {
	const click = ( locator ) =>
		demo ? demo.click( locator, 600 ) : locator.click();
	const settings = page
		.getByRole( 'region', { name: 'Editor top bar' } )
		.getByRole( 'button', { name: 'Settings', exact: true } );
	if (
		( await settings.count() ) === 1 &&
		( await settings.getAttribute( 'aria-expanded' ) ) !== 'true'
	) {
		await click( settings );
	}
	await editor.openDocumentSettingsSidebar();

	const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
	const blockTab = sidebar.getByRole( 'tab', { name: 'Block' } );
	if ( ( await blockTab.getAttribute( 'aria-selected' ) ) !== 'true' ) {
		await click( blockTab );
	}
	const settingsTab = sidebar.getByRole( 'tab', {
		name: 'Settings',
		exact: true,
	} );
	if (
		( await settingsTab.count() ) > 0 &&
		( await settingsTab.getAttribute( 'aria-selected' ) ) !== 'true'
	) {
		await click( settingsTab );
	}
	const toggle = sidebar.getByRole( 'button', {
		name: 'Schema.org',
		exact: true,
	} );
	await expect( toggle ).toBeVisible();
	if ( ( await toggle.getAttribute( 'aria-expanded' ) ) !== 'true' ) {
		await click( toggle );
	}
	await expect( toggle ).toHaveAttribute( 'aria-expanded', 'true' );
	await scrollSidebarTo( toggle, 64 );
	await page.waitForTimeout( 700 );
	return sidebar;
}

// Smoothly scrolls the sidebar so the element sits `offset` pixels below its top edge.
const scrollSidebarTo = ( locator, offset ) =>
	locator.evaluate( ( element, gap ) => {
		let parent = element.parentElement;
		while (
			parent &&
			! (
				parent.scrollHeight > parent.clientHeight &&
				/auto|scroll/.test(
					window.getComputedStyle( parent ).overflowY
				)
			)
		) {
			parent = parent.parentElement;
		}
		if ( ! parent ) {
			return;
		}
		const top =
			element.getBoundingClientRect().top -
			parent.getBoundingClientRect().top +
			parent.scrollTop -
			gap;
		parent.scrollTo( { top, behavior: 'smooth' } );
	}, offset );

// The "Schema.org properties" tools panel of the selected block.
const propertiesPanel = ( page ) =>
	page
		.getByRole( 'region', { name: 'Editor settings' } )
		.locator( '.components-tools-panel', {
			has: page.getByRole( 'heading', {
				name: 'Schema.org properties',
			} ),
		} );

// The "Schema.org" panel of the pre-publish sidebar.
const prePublishPanel = ( page ) =>
	page
		.getByRole( 'region', { name: 'Editor publish' } )
		.locator( '.components-panel__body', {
			has: page.getByRole( 'button', {
				name: 'Schema.org',
				exact: true,
			} ),
		} );

// Shoots a locator at a tall viewport, so a long sidebar panel fits.
async function shootTall( page, locator, file ) {
	await page.setViewportSize( TALL );
	await page.waitForTimeout( 400 );
	await locator.scrollIntoViewIfNeeded();
	await locator.screenshot( { path: shotPath( file ) } );
	await page.setViewportSize( SIZE );
	await page.waitForTimeout( 400 );
}

// Answers the inserter's block directory search with no results, so it only shows
// installed blocks and patterns, not plugins to install.
const hideBlockDirectory = ( target ) =>
	target.route(
		( url ) =>
			decodeURIComponent( url.href ).includes(
				'/wp/v2/block-directory/search'
			),
		( route ) =>
			route.fulfill( {
				status: 200,
				contentType: 'application/json',
				body: '[]',
			} )
	);

// The client ID of the selected block.
const selectedClientId = ( page ) =>
	page.evaluate( () =>
		window.wp.data.select( 'core/block-editor' ).getSelectedBlockClientId()
	);

test.describe( 'Demo media', () => {
	test.skip(
		! process.env.SCHEMA_DEMO,
		'Set SCHEMA_DEMO=1 to record the demo.'
	);
	test.describe.configure( { timeout: 600000 } );
	// The default page is only used for the screenshots outside the recording.
	test.use( {
		viewport: { width: 1280, height: 1100 },
		deviceScaleFactor: 2,
	} );

	test.beforeAll( async ( { requestUtils } ) => {
		fs.mkdirSync( SHOT_DIR, { recursive: true } );
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
							welcomeGuideTemplate: false,
							fullscreenMode: false,
						},
						'core/edit-site': {
							...preferences[ 'core/edit-site' ],
							welcomeGuide: false,
							welcomeGuideStyles: false,
							welcomeGuidePage: false,
							welcomeGuideTemplate: false,
						},
						_modified: new Date().toISOString(),
					},
				},
			},
		} );
	} );

	test( 'screenshots of the inserter and the query presets', async ( {
		newPost,
		editor,
		page,
		insertBlock,
		schemaPanel,
	} ) => {
		await hideBlockDirectory( page );
		await newPost();

		await page
			.getByRole( 'region', { name: 'Editor top bar' } )
			.getByRole( 'button', { name: /block inserter/i } )
			.click();
		const inserter = page.getByRole( 'region', { name: 'Block Library' } );
		await inserter.getByRole( 'searchbox' ).fill( 'schema' );
		const faq = inserter.getByRole( 'option', {
			name: 'FAQ',
			exact: true,
		} );
		const howTo = inserter.getByRole( 'option', {
			name: 'How-to',
			exact: true,
		} );
		await expect( faq ).toBeVisible();
		await expect( howTo ).toBeVisible();
		await page.waitForTimeout( 500 );
		const boxes = await Promise.all(
			[ inserter.getByRole( 'tablist' ), faq, howTo ].map( ( item ) =>
				item.boundingBox()
			)
		);
		const panel = await inserter.boundingBox();
		const bottom = Math.max( ...boxes.map( ( b ) => b.y + b.height ) );
		await page.screenshot( {
			path: shotPath( 'inserter-faq-howto.png' ),
			clip: {
				x: panel.x,
				y: panel.y,
				width: panel.width,
				height: bottom + 16 - panel.y,
			},
		} );
		await page.keyboard.press( 'Escape' );

		await insertBlock( {
			name: 'core/query',
			attributes: {
				query: {
					perPage: 3,
					postType: 'post',
					order: 'desc',
					orderBy: 'date',
					inherit: false,
				},
			},
			innerBlocks: [
				{
					name: 'core/post-template',
					innerBlocks: [
						{ name: 'core/post-title' },
						{ name: 'core/post-date' },
					],
				},
			],
		} );
		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/query"]' )
		);
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'Blog', exact: true } )
			.click();
		await expect(
			schemaPanel.sidebar.getByRole( 'combobox', { name: 'Schema Type' } )
		).toHaveValue( 'Blog' );
		await page.mouse.move( 10, 10 );
		await page.waitForTimeout( 300 );
		await mappingPanel( page ).screenshot( {
			path: shotPath( 'blog-list-preset.png' ),
		} );
	} );

	test( 'screenshots of the properties panel and the pre-publish check', async ( {
		newPost,
		editor,
		page,
		insertBlock,
		schemaPanel,
	} ) => {
		await newPost();
		await insertBlock( {
			name: 'core/group',
			innerBlocks: [
				{
					name: 'core/heading',
					attributes: { content: 'Ten tips for baking bread' },
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'Start with a good flour.' },
				},
			],
		} );
		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/group"]' )
		);
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'Article', exact: true } )
			.click();
		await expect(
			schemaPanel.sidebar.getByRole( 'combobox', { name: 'Schema Type' } )
		).toHaveValue( 'Article' );
		const properties = propertiesPanel( page );
		const published = await schemaPanel.addProperty( 'Date Published' );
		await published.selectOption( { label: 'Post date' } );
		const publisher = await schemaPanel.addProperty( 'Publisher' );
		await publisher.selectOption( { label: 'Link to site Organization' } );
		await expect(
			properties.getByRole( 'combobox', { name: 'URL', exact: true } )
		).toBeVisible();
		await page.mouse.move( 10, 10 );
		await page.waitForTimeout( 300 );
		await shootTall( page, properties, 'properties-panel.png' );

		// A draft whose FAQ has a question without an answer.
		await page.evaluate( ( markup ) => {
			const { select, dispatch } = window.wp.data;
			const ids = select( 'core/block-editor' )
				.getBlocks()
				.map( ( block ) => block.clientId );
			dispatch( 'core/block-editor' ).removeBlocks( ids );
			dispatch( 'core/block-editor' ).insertBlocks(
				window.wp.blocks.parse( markup )
			);
		}, INCOMPLETE_FAQ );
		await page
			.getByRole( 'region', { name: 'Editor top bar' } )
			.getByRole( 'button', { name: 'Publish', exact: true } )
			.click();
		const panel = prePublishPanel( page );
		await expect( panel.getByRole( 'listitem' ) ).toHaveText( [
			'How long does delivery take? (Question): missing Accepted Answer',
		] );
		await page.mouse.move( 10, 10 );
		await page.waitForTimeout( 300 );
		await panel.screenshot( { path: shotPath( 'pre-publish-check.png' ) } );
	} );

	test( 'record the demo', async ( {
		browser,
		browserName,
		requestUtils,
	} ) => {
		const ffmpeg = spawnSync( 'ffmpeg', [ '-version' ] );
		test.skip(
			ffmpeg.status !== 0,
			'ffmpeg is needed to encode the demo.'
		);

		const pagesBefore = await requestUtils.rest( {
			path: '/wp/v2/posts',
			params: { per_page: 100, status: 'publish,draft' },
		} );
		await requestUtils.rest( {
			method: 'POST',
			path: TEMPLATE,
			data: { content: PLAIN_TEMPLATE },
		} );

		fs.rmSync( RAW_DIR, { recursive: true, force: true } );
		const context = await browser.newContext( {
			baseURL: process.env.WP_BASE_URL,
			storageState: getStorageStatePath(),
			viewport: SIZE,
			deviceScaleFactor: 2,
			recordVideo: { dir: RAW_DIR, size: SIZE },
		} );
		await hideBlockDirectory( context );
		await context.addInitScript( overlayScript );
		const page = await context.newPage();
		const demo = new Demo( page );
		const editor = new Editor( { page } );
		const admin = new Admin( {
			page,
			editor,
			pageUtils: new PageUtils( { page, browserName } ),
		} );
		const topBar = page.getByRole( 'region', { name: 'Editor top bar' } );

		try {
			// 1. A fresh post.
			await admin.createNewPost();
			await editor.canvas.locator( 'body' ).waitFor();
			await expect(
				page.getByRole( 'dialog', { name: /^Welcome to/ } )
			).toBeHidden();
			await demo.restore();
			await page.mouse.move( 640, 420, { steps: 5 } );
			await demo.pause( 600 );
			demo.mark( 'start' );
			await demo.caption(
				'Schema.org Blocks: structured data from the blocks you already use',
				2400
			);

			// 2. Insert the FAQ variation and fill in two questions.
			demo.mark( 'gifFrom' );
			await demo.click(
				topBar.getByRole( 'button', { name: /block inserter/i } )
			);
			const inserter = page.getByRole( 'region', {
				name: 'Block Library',
			} );
			await demo.click( inserter.getByRole( 'searchbox' ), 300 );
			await demo.type( 'FAQ' );
			const faq = inserter.getByRole( 'option', {
				name: 'FAQ',
				exact: true,
			} );
			await expect( faq ).toBeVisible();
			await demo.caption(
				'Insert the FAQ block. Every question is set up as schema.',
				1400
			);
			await demo.click( faq, 1200 );
			if ( await inserter.isVisible() ) {
				await demo.click(
					topBar.getByRole( 'button', { name: /block inserter/i } ),
					600
				);
			}

			const items = editor.canvas.locator(
				'[data-type="core/accordion-item"]'
			);
			await expect( items ).toHaveCount( 2 );
			demo.mark( 'typeFrom' );
			for ( const [
				index,
				[ question, answer ],
			] of QUESTIONS.entries() ) {
				const item = items.nth( index );
				await demo.click(
					item.getByRole( 'textbox', { name: 'Accordion title' } ),
					300
				);
				await demo.type( question, 20 );
				if ( index === 0 ) {
					await demo.caption(
						'Type your questions and answers as usual.',
						0
					);
				}
				await demo.click(
					item.locator( '[data-type="core/paragraph"]' ).first(),
					300
				);
				await demo.type( answer, 20 );
			}
			demo.mark( 'typeTo' );
			await demo.pause( 600 );

			// 3. The accordion and an item in the Schema.org panel.
			const accordion = editor.canvas.locator(
				'[data-type="core/accordion"]'
			);
			await demo.moveTo( accordion );
			await editor.selectBlocks( accordion );
			await demo.pause( 600 );
			let sidebar = await openSchemaPanel( page, editor, demo );
			await demo.caption( 'Quick setup shows the FAQ preset.', 600 );
			await demo.moveTo(
				sidebar.getByRole( 'button', { name: 'FAQ', exact: true } )
			);
			await demo.pause( 2000 );
			await demo.shoot( () =>
				shootTall( page, mappingPanel( page ), 'faq-quick-setup.png' )
			);

			const firstItem = items.first();
			await demo.moveTo( firstItem );
			await editor.selectBlocks( firstItem );
			await demo.pause( 600 );
			sidebar = await openSchemaPanel( page, editor, demo );
			const valueType = sidebar
				.getByText( 'Question', { exact: true } )
				.first();
			await expect( valueType ).toBeVisible();
			await demo.caption(
				'Each item is a Question with its answer.',
				600
			);
			await demo.moveTo( valueType );
			await demo.pause( 4200 );
			await demo.shoot( () =>
				shootTall(
					page,
					mappingPanel( page ),
					'accordion-item-question.png'
				)
			);

			// 4. Title, publish and view the post with its JSON-LD.
			await demo.caption( '', 300 );
			await demo.click(
				editor.canvas.getByRole( 'textbox', { name: 'Add title' } ),
				300
			);
			await demo.type( 'Baking bread at home' );
			await demo.click(
				topBar.getByRole( 'button', { name: 'Publish', exact: true } )
			);
			const publishPanel = page.getByRole( 'region', {
				name: 'Editor publish',
			} );
			await expect( prePublishPanel( page ) ).toContainText(
				'All required structured data is set.'
			);
			await demo.caption(
				'Before publishing, a check lists any structured data that is missing.',
				2400
			);
			await demo.click(
				publishPanel.getByRole( 'button', {
					name: 'Publish',
					exact: true,
				} )
			);
			await page
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.filter( { hasText: 'published' } )
				.waitFor();
			const postId = await page.evaluate( () =>
				window.wp.data.select( 'core/editor' ).getCurrentPostId()
			);
			await demo.pause( 800 );

			await demo.offCamera( () => demo.goto( `/?p=${ postId }` ) );
			await demo.pause( 800 );
			const firstToggle = page
				.locator( '.wp-block-accordion-heading__toggle' )
				.first();
			await demo.click( firstToggle, 700 );
			await demo.showJsonLd();
			await demo.caption(
				'The page now has FAQPage structured data.',
				3600
			);
			await demo.shoot( () =>
				page.screenshot( {
					path: shotPath( 'front-end-faq-json-ld.png' ),
					scale: 'css',
				} )
			);
			demo.mark( 'faqTo' );

			// 5. Type the single template in the site editor.
			await demo.caption( '', 400 );
			await demo.offCamera( async () => {
				await admin.visitSiteEditor( {
					postId: 'twentytwentyfive//single',
					postType: 'wp_template',
					canvas: 'edit',
				} );
				await editor.canvas.locator( 'body' ).waitFor();
				await demo.restore();
				await page.mouse.move( 640, 420 );
				await demo.pause( 1500 );
			} );

			const mainId = await page.evaluate( () => {
				const store = window.wp.data.select( 'core/block-editor' );
				return store
					.getBlocksByName( 'core/group' )
					.find(
						( id ) =>
							store.getBlockAttributes( id ).tagName === 'main'
					);
			} );
			expect( mainId ).toBeTruthy();
			const innerId = await page.evaluate(
				( id ) =>
					window.wp.data
						.select( 'core/block-editor' )
						.getBlockOrder( id )[ 0 ],
				mainId
			);
			const main = editor.canvas.locator( `[data-block="${ mainId }"]` );
			const inner = editor.canvas.locator(
				`[data-block="${ innerId }"]`
			);

			demo.mark( 'siteFrom' );
			await demo.caption(
				'In the site editor, set the template up as a Web page.',
				800
			);
			await demo.moveTo( main );
			await editor.selectBlocks( main );
			await demo.pause( 600 );
			sidebar = await openSchemaPanel( page, editor, demo );
			await demo.click(
				sidebar.getByRole( 'button', {
					name: 'Web page',
					exact: true,
				} ),
				1600
			);
			await expect(
				sidebar.getByRole( 'combobox', { name: 'Schema Type' } )
			).toHaveValue( 'Web Page' );
			await demo.shoot( () =>
				page.screenshot( {
					path: shotPath( 'site-editor-web-page.png' ),
					scale: 'css',
				} )
			);

			await demo.moveTo( inner );
			await editor.selectBlocks( inner );
			await demo.pause( 600 );
			sidebar = await openSchemaPanel( page, editor, demo );
			await demo.caption( '…and the content as an Article.', 1200 );
			await demo.click(
				sidebar.getByRole( 'button', { name: 'Article', exact: true } ),
				1600
			);
			demo.mark( 'siteTo' );
			expect( await selectedClientId( page ) ).toBe( innerId );

			// The graph settings of the Web page: its id and how it nests the Article.
			await demo.moveTo( main );
			await editor.selectBlocks( main );
			await demo.pause( 500 );
			sidebar = await openSchemaPanel( page, editor, demo );
			const advanced = sidebar.getByRole( 'button', {
				name: 'Advanced',
				exact: true,
			} );
			if (
				( await advanced.getAttribute( 'aria-expanded' ) ) !== 'true'
			) {
				await demo.click( advanced, 600 );
			}
			const graph = advancedPanel( page );
			await scrollSidebarTo( graph, 220 );
			await demo.pause( 800 );
			await demo.caption( 'Graph settings link entities together.', 600 );
			await demo.moveTo( sidebar.getByLabel( 'Nest inner entities as' ) );
			await demo.pause( 2200 );
			await demo.shoot( async () => {
				const boxes = await Promise.all(
					[ 'Entity ID', 'Nest inner entities as' ].map( ( label ) =>
						graph
							.locator( '.components-base-control', {
								has: page.getByLabel( label ),
							} )
							.last()
							.boundingBox()
					)
				);
				const panelBox = await graph.boundingBox();
				const top = Math.min( ...boxes.map( ( b ) => b.y ) );
				const bottom = Math.max(
					...boxes.map( ( b ) => b.y + b.height )
				);
				await page.screenshot( {
					path: shotPath( 'graph-controls.png' ),
					clip: {
						x: panelBox.x,
						y: top - 16,
						width: panelBox.width,
						height: bottom - top + 32,
					},
				} );
			} );

			const saveButton = topBar.getByRole( 'button', {
				name: 'Save',
				exact: true,
			} );
			await demo.caption( 'Save the template.', 300 );
			await demo.click( saveButton, 0 );
			await page
				.getByRole( 'button', { name: 'Dismiss this notice' } )
				.getByText( /(updated|published)\./ )
				.first()
				.waitFor();
			await demo.caption( '', 1800 );

			// 6. The connected graph on the front end.
			await demo.offCamera( () => demo.goto( `/?p=${ postId }` ) );
			const data = await page.evaluate( () =>
				JSON.parse(
					document.querySelector(
						'script[type="application/ld+json"]'
					).textContent
				)
			);
			const nodes = data[ '@graph' ];
			// One page node: the FAQ is the page, so the hub is the FAQPage.
			const hub = nodes.find( ( node ) => node[ '@type' ] === 'FAQPage' );
			expect( nodes.map( ( node ) => node[ '@type' ] ).sort() ).toEqual( [
				'FAQPage',
				'Organization',
				'WebSite',
			] );
			expect( hub.mainEntity ).toHaveLength( QUESTIONS.length );
			expect( hub.hasPart ).toMatchObject( { '@type': 'Article' } );

			demo.mark( 'graphFrom' );
			await demo.pause( 600 );
			await demo.showJsonLd();
			await demo.caption(
				'One connected graph: the FAQ page with its Article, WebSite and Organization.',
				2000
			);
			// The whole graph in one shot: a smaller font and a viewport as tall as the JSON.
			await demo.shoot( async () => {
				const height = await page.evaluate( () =>
					window.__demo.compact( true )
				);
				await page.setViewportSize( {
					width: SIZE.width,
					height: Math.max( SIZE.height, Math.ceil( height ) ),
				} );
				await page.waitForTimeout( 400 );
				await page.screenshot( {
					path: shotPath( 'front-end-page-graph.png' ),
					scale: 'css',
				} );
				await page.setViewportSize( SIZE );
				await page.evaluate( () => window.__demo.compact( false ) );
				await page.waitForTimeout( 300 );
			} );
			await demo.scrollPanel( 7000 );
			await demo.pause( 1200 );
			demo.mark( 'graphTo' );

			// 7. End card.
			demo.mark( 'endFrom' );
			await demo.endCard(
				'Schema.org Blocks',
				'github.com/humanmade/hm-schema-block',
				3600
			);
			demo.mark( 'end' );
		} finally {
			const video = page.video();
			await context.close();
			await requestUtils
				.rest( {
					method: 'DELETE',
					path: TEMPLATE,
					params: { force: true },
				} )
				.catch( () => {} );
			const known = new Set( pagesBefore.map( ( post ) => post.id ) );
			const pagesAfter = await requestUtils.rest( {
				path: '/wp/v2/posts',
				params: { per_page: 100, status: 'publish,draft' },
			} );
			for ( const post of pagesAfter ) {
				if ( ! known.has( post.id ) ) {
					await requestUtils.rest( {
						method: 'DELETE',
						path: `/wp/v2/posts/${ post.id }`,
						params: { force: true },
					} );
				}
			}
			fs.writeFileSync(
				path.join( RAW_DIR, 'timeline.json' ),
				JSON.stringify(
					{
						marks: demo.marks,
						cuts: demo.cuts,
						segments: demo.marks.end ? demo.segments() : [],
					},
					null,
					2
				)
			);
			if ( demo.marks.end ) {
				encode( demo, await video.path(), MEDIA_DIR, GIF_PARTS );
			}
		}
	} );
} );
