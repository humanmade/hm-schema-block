/**
 * E2E tests for the FAQ and how-to presets: accordion variations, Quick setup,
 * smart defaults for accordion items and details blocks, and the JSON-LD they produce.
 *
 * @package
 */

const path = require( 'node:path' );
const { test, expect } = require( './fixtures' );

const SCREENSHOT_DIR =
	process.env.SCHEMA_SCREENSHOT_DIR ||
	path.join( process.cwd(), 'artifacts/screenshots' );

const itemSchema = ( propertyName = 'mainEntity' ) => ( {
	type: propertyName === 'step' ? 'HowToStep' : 'Question',
	isProperty: true,
	propertyName,
	mappings: {},
} );

const accordionHeading = {
	type: null,
	isProperty: true,
	propertyName: 'name',
	mappings: { name: { source: 'attribute', attributeName: 'title' } },
};

const accordionPanel = ( propertyName ) => ( {
	type: null,
	isProperty: true,
	propertyName,
	mappings: {},
} );

// Block markup for an untyped accordion item with a title and one paragraph.
const accordionItem = ( title, content ) => ( {
	name: 'core/accordion-item',
	innerBlocks: [
		{ name: 'core/accordion-heading', attributes: { title } },
		{
			name: 'core/accordion-panel',
			innerBlocks: [
				{ name: 'core/paragraph', attributes: { content } },
			],
		},
	],
} );

const details = ( summary, content ) => ( {
	name: 'core/details',
	attributes: { summary },
	innerBlocks: [ { name: 'core/paragraph', attributes: { content } } ],
} );

// Opens the inserter, searches, and returns the result option with the given title.
async function insertFromInserter( page, search, title ) {
	await page
		.getByRole( 'region', { name: 'Editor top bar' } )
		.getByRole( 'button', { name: /block inserter/i } )
		.click();
	const inserter = page.getByRole( 'region', { name: 'Block Library' } );
	await inserter.getByRole( 'searchbox' ).fill( search );
	const option = inserter.getByRole( 'option', { name: title, exact: true } );
	await expect( option ).toBeVisible();
	return { inserter, option };
}

// Types a title and answer into the accordion item at `index`.
async function fillAccordionItem( editor, page, index, title, content ) {
	const item = editor.canvas
		.locator( '[data-type="core/accordion-item"]' )
		.nth( index );
	await item.getByRole( 'textbox', { name: 'Accordion title' } ).click();
	await page.keyboard.type( title );
	await item.locator( '[data-type="core/paragraph"]' ).first().click();
	await page.keyboard.type( content );
}

// The schemaOrg attribute of every block in the tree, as [ name, schemaOrg, children ].
function schemaTree( blocks ) {
	return blocks.map( ( block ) => [
		block.name,
		block.attributes.schemaOrg,
		schemaTree( block.innerBlocks ),
	] );
}

// The schemaOrg tree a plain two-item accordion gets from Quick setup "How-to".
const HOW_TO_ITEM = [
	'core/accordion-item',
	itemSchema( 'step' ),
	[
		[ 'core/accordion-heading', accordionHeading, [] ],
		[
			'core/accordion-panel',
			accordionPanel( 'text' ),
			[ [ 'core/paragraph', expect.anything(), [] ] ],
		],
	],
];
const HOW_TO_ACCORDION_TREE = [
	[
		'core/accordion',
		{
			type: 'HowTo',
			mappings: { name: { source: 'post', field: 'title' } },
			isProperty: false,
			propertyName: null,
		},
		[ HOW_TO_ITEM, HOW_TO_ITEM ],
	],
];

// Adds a titled post with an untyped two-item accordion, selects it and opens the
// Schema.org Mapping panel. Returns the Quick setup buttons.
async function setUpPlainAccordion( editor, schemaPanel ) {
	await editor.canvas
		.getByRole( 'textbox', { name: 'Add title' } )
		.fill( 'Plant a tree' );
	await editor.insertBlock( {
		name: 'core/accordion',
		innerBlocks: [
			accordionItem( 'Dig a hole', 'Twice as wide as the roots.' ),
			accordionItem( 'Water it', 'Soak the soil well.' ),
		],
	} );
	await editor.selectBlocks(
		editor.canvas.locator( '[data-type="core/accordion"]' )
	);
	await schemaPanel.open();

	return {
		howToButton: schemaPanel.sidebar.getByRole( 'button', {
			name: 'How-to',
			exact: true,
		} ),
		faqButton: schemaPanel.sidebar.getByRole( 'button', {
			name: 'FAQ',
			exact: true,
		} ),
	};
}

const findNode = ( data, type ) =>
	data[ '@graph' ].find( ( node ) => node[ '@type' ] === type );

test.describe( 'FAQ and how-to presets', () => {
	test.beforeEach( async ( { newPost } ) => {
		await newPost();
	} );

	test( 'FAQ variation from the inserter outputs FAQPage with every question', async ( {
		editor,
		page,
		publishAndGetJsonLd,
	} ) => {
		const { option } = await insertFromInserter( page, 'FAQ', 'FAQ' );
		await option.click();

		await editor.openDocumentSettingsSidebar();
		await expect(
			page
				.getByRole( 'region', { name: 'Editor settings' } )
				.locator( '.block-editor-block-card' )
		).toContainText( 'FAQ' );

		await fillAccordionItem(
			editor,
			page,
			0,
			'What is schema?',
			'Structured data.'
		);
		await fillAccordionItem(
			editor,
			page,
			1,
			'Is it free?',
			'Yes, it is free.'
		);

		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/accordion"]' )
		);
		await editor.clickBlockToolbarButton( 'Add item' );
		await expect(
			editor.canvas.locator( '[data-type="core/accordion-item"]' )
		).toHaveCount( 3 );
		await fillAccordionItem(
			editor,
			page,
			2,
			'Can I add more?',
			'Add as many as you like.'
		);

		// The added item was set up by smart defaults, not by the variation template.
		const [ accordion ] = await editor.getBlocks();
		const [ , thirdItemSchema, [ heading, panel ] ] = schemaTree(
			accordion.innerBlocks
		)[ 2 ];
		expect( thirdItemSchema ).toEqual( itemSchema() );
		expect( heading[ 1 ] ).toEqual( accordionHeading );
		expect( panel[ 1 ] ).toEqual( accordionPanel( 'acceptedAnswer' ) );

		const data = await publishAndGetJsonLd();
		const faq = findNode( data, 'FAQPage' );

		expect( faq.mainEntity ).toEqual( [
			{
				'@type': 'Question',
				name: 'What is schema?',
				acceptedAnswer: { '@type': 'Answer', text: 'Structured data.' },
			},
			{
				'@type': 'Question',
				name: 'Is it free?',
				acceptedAnswer: { '@type': 'Answer', text: 'Yes, it is free.' },
			},
			{
				'@type': 'Question',
				name: 'Can I add more?',
				acceptedAnswer: {
					'@type': 'Answer',
					text: 'Add as many as you like.',
				},
			},
		] );
		for ( const entity of faq.mainEntity ) {
			expect( entity.name ).not.toContain( '+' );
		}
	} );

	test( 'How-to variation outputs HowTo named after the post', async ( {
		editor,
		page,
		publishAndGetJsonLd,
	} ) => {
		await editor.canvas
			.getByRole( 'textbox', { name: 'Add title' } )
			.fill( 'Bake bread' );

		const { option } = await insertFromInserter( page, 'How-to', 'How-to' );
		await option.click();

		await fillAccordionItem(
			editor,
			page,
			0,
			'Mix the dough',
			'Combine flour, water, yeast and salt.'
		);
		await fillAccordionItem(
			editor,
			page,
			1,
			'Bake',
			'Bake for 40 minutes at 220°C.'
		);

		const data = await publishAndGetJsonLd();
		const howTo = findNode( data, 'HowTo' );

		expect( howTo.name ).toBe( 'Bake bread' );
		expect( howTo.step ).toEqual( [
			{
				'@type': 'HowToStep',
				name: 'Mix the dough',
				text: 'Combine flour, water, yeast and salt.',
			},
			{
				'@type': 'HowToStep',
				name: 'Bake',
				text: 'Bake for 40 minutes at 220°C.',
			},
		] );
	} );

	test( 'Quick setup FAQ on a group maps its details blocks to questions', async ( {
		editor,
		schemaPanel,
		publishAndGetJsonLd,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			innerBlocks: [ details( 'Q1?', 'A1' ), details( 'Q2?', 'A2' ) ],
		} );
		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/group"]' )
		);
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'FAQ', exact: true } )
			.click();

		const expectedDetails = {
			type: 'Question',
			isProperty: true,
			propertyName: 'mainEntity',
			mappings: {
				name: { source: 'attribute', attributeName: 'summary' },
				acceptedAnswer: { source: 'innerBlocks' },
			},
		};
		const [ group ] = await editor.getBlocks();
		expect( group.attributes.schemaOrg.type ).toBe( 'FAQPage' );
		expect(
			group.innerBlocks.map( ( block ) => block.attributes.schemaOrg )
		).toEqual( [ expectedDetails, expectedDetails ] );

		const data = await publishAndGetJsonLd();

		expect( findNode( data, 'FAQPage' ).mainEntity ).toEqual( [
			{
				'@type': 'Question',
				name: 'Q1?',
				acceptedAnswer: { '@type': 'Answer', text: 'A1' },
			},
			{
				'@type': 'Question',
				name: 'Q2?',
				acceptedAnswer: { '@type': 'Answer', text: 'A2' },
			},
		] );
	} );

	test( 'Quick setup switches a plain accordion to How-to, then to FAQ', async ( {
		editor,
		schemaPanel,
		publishAndGetJsonLd,
	} ) => {
		const { howToButton, faqButton } = await setUpPlainAccordion(
			editor,
			schemaPanel
		);

		await howToButton.click();
		await expect( howToButton ).toHaveAttribute( 'aria-pressed', 'true' );
		expect( schemaTree( await editor.getBlocks() ) ).toEqual(
			HOW_TO_ACCORDION_TREE
		);

		await faqButton.click();
		await expect( faqButton ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( howToButton ).toHaveAttribute( 'aria-pressed', 'false' );

		const [ faqAccordion ] = await editor.getBlocks();
		expect( faqAccordion.attributes.schemaOrg.type ).toBe( 'FAQPage' );
		for ( const [ , item, [ heading, panel ] ] of schemaTree(
			faqAccordion.innerBlocks
		) ) {
			expect( item ).toEqual( itemSchema() );
			expect( heading[ 1 ] ).toEqual( accordionHeading );
			expect( panel[ 1 ] ).toEqual( accordionPanel( 'acceptedAnswer' ) );
		}

		const data = await publishAndGetJsonLd();
		expect( findNode( data, 'HowTo' ) ).toBeUndefined();
		expect( findNode( data, 'FAQPage' ).mainEntity ).toEqual( [
			{
				'@type': 'Question',
				name: 'Dig a hole',
				acceptedAnswer: {
					'@type': 'Answer',
					text: 'Twice as wide as the roots.',
				},
			},
			{
				'@type': 'Question',
				name: 'Water it',
				acceptedAnswer: {
					'@type': 'Answer',
					text: 'Soak the soil well.',
				},
			},
		] );
	} );

	test( 'one Undo after switching presets restores the How-to setup', async ( {
		editor,
		page,
		schemaPanel,
	} ) => {
		const { howToButton, faqButton } = await setUpPlainAccordion(
			editor,
			schemaPanel
		);
		await howToButton.click();
		await expect( howToButton ).toHaveAttribute( 'aria-pressed', 'true' );
		await faqButton.click();
		await expect( faqButton ).toHaveAttribute( 'aria-pressed', 'true' );

		await page
			.getByRole( 'region', { name: 'Editor top bar' } )
			.getByRole( 'button', { name: 'Undo' } )
			.click();

		await expect( howToButton ).toHaveAttribute( 'aria-pressed', 'true' );
		expect( schemaTree( await editor.getBlocks() ) ).toEqual(
			HOW_TO_ACCORDION_TREE
		);
	} );

	test( 'Quick setup How-to on a plain accordion outputs HowTo', async ( {
		editor,
		schemaPanel,
		publishAndGetJsonLd,
	} ) => {
		const { howToButton } = await setUpPlainAccordion(
			editor,
			schemaPanel
		);
		await howToButton.click();

		const data = await publishAndGetJsonLd();
		const howTo = findNode( data, 'HowTo' );
		expect( howTo.name ).toBe( 'Plant a tree' );
		expect( howTo.step ).toEqual( [
			{
				'@type': 'HowToStep',
				name: 'Dig a hole',
				text: 'Twice as wide as the roots.',
			},
			{
				'@type': 'HowToStep',
				name: 'Water it',
				text: 'Soak the soil well.',
			},
		] );
	} );

	test( 'accordion item shows its Value Type and the FAQPage parent', async ( {
		editor,
		page,
		schemaPanel,
	} ) => {
		const { option } = await insertFromInserter( page, 'FAQ', 'FAQ' );
		await option.click();

		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/accordion-item"]' ).first()
		);
		await schemaPanel.open();

		await expect(
			schemaPanel.sidebar.getByLabel( 'Value Type' )
		).toHaveValue( 'Question' );
		await expect(
			schemaPanel.sidebar.getByLabel( 'Property Name' )
		).toHaveValue( 'mainEntity' );
		await expect(
			schemaPanel.sidebar.locator( '.components-notice', {
				hasText: 'Parent block has schema type',
			} )
		).toContainText( 'FAQPage' );
	} );

	test( 'a mapping with Source "Post title" outputs the post title', async ( {
		editor,
		schemaPanel,
		publishAndGetJsonLd,
	} ) => {
		await editor.canvas
			.getByRole( 'textbox', { name: 'Add title' } )
			.fill( 'Title from the post' );
		await editor.insertBlock( { name: 'core/group' } );
		await schemaPanel.setType( 'Article' );

		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'Add mapping' } )
			.click();
		const property = await schemaPanel.sidebar
			.getByLabel( 'Schema Property' )
			.first()
			.inputValue();
		await schemaPanel.sidebar
			.getByLabel( 'Source' )
			.first()
			.selectOption( { label: 'Post title' } );

		const [ group ] = await editor.getBlocks();
		expect( group.attributes.schemaOrg.mappings[ property ] ).toEqual(
			expect.objectContaining( { source: 'post', field: 'title' } )
		);

		const data = await publishAndGetJsonLd();
		expect( findNode( data, 'Article' )[ property ] ).toBe(
			'Title from the post'
		);
	} );

	test( 'an accordion panel with Value Type Answer outputs its text as the answer', async ( {
		editor,
		page,
		schemaPanel,
		publishAndGetJsonLd,
	} ) => {
		const { option } = await insertFromInserter( page, 'FAQ', 'FAQ' );
		await option.click();
		await fillAccordionItem(
			editor,
			page,
			0,
			'Does it rain?',
			'Mostly in spring.'
		);

		await editor.selectBlocks(
			editor.canvas
				.locator( '[data-type="core/accordion-panel"]' )
				.first()
		);
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByLabel( 'Value Type' )
			.selectOption( 'Answer' );

		const [ accordion ] = await editor.getBlocks();
		const [ , , [ , panel ] ] = schemaTree( accordion.innerBlocks )[ 0 ];
		expect( panel[ 1 ] ).toEqual( {
			...accordionPanel( 'acceptedAnswer' ),
			type: 'Answer',
		} );

		const data = await publishAndGetJsonLd();
		const questions = [].concat( findNode( data, 'FAQPage' ).mainEntity );
		expect(
			questions.find( ( question ) => question.name === 'Does it rain?' )
		).toEqual( {
			'@type': 'Question',
			name: 'Does it rain?',
			acceptedAnswer: { '@type': 'Answer', text: 'Mostly in spring.' },
		} );
	} );

	test( 'changing the property clears a value type it does not accept', async ( {
		editor,
		page,
		schemaPanel,
	} ) => {
		const { option } = await insertFromInserter( page, 'FAQ', 'FAQ' );
		await option.click();
		await fillAccordionItem( editor, page, 0, 'Why?', 'Because.' );

		await editor.selectBlocks(
			editor.canvas
				.locator( '[data-type="core/accordion-panel"]' )
				.first()
		);
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByLabel( 'Value Type' )
			.selectOption( 'Answer' );
		await schemaPanel.sidebar
			.getByLabel( 'Property Name' )
			.selectOption( 'name' );

		const [ accordion ] = await editor.getBlocks();
		const [ , , [ , panel ] ] = schemaTree( accordion.innerBlocks )[ 0 ];
		expect( panel[ 1 ] ).toMatchObject( {
			type: null,
			isProperty: true,
			propertyName: 'name',
		} );
	} );

	test( 'a new type and re-apply clear step links the type does not have', async ( {
		editor,
		schemaPanel,
		publishAndGetJsonLd,
	} ) => {
		await editor.canvas
			.getByRole( 'textbox', { name: 'Add title' } )
			.fill( 'Plant a tree' );
		await editor.insertBlock( {
			name: 'core/accordion',
			innerBlocks: [
				accordionItem( 'Dig a hole', 'Twice as wide as the roots.' ),
			],
		} );
		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/accordion"]' )
		);
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'How-to', exact: true } )
			.click();
		expect( schemaTree( await editor.getBlocks() ) ).toEqual( [
			[ 'core/accordion', expect.anything(), [ HOW_TO_ITEM ] ],
		] );

		await schemaPanel.setType( 'Article' );
		await schemaPanel.sidebar
			.getByRole( 'button', {
				name: 'Apply suggested mappings to inner blocks',
			} )
			.click();

		const [ accordion ] = await editor.getBlocks();
		expect( accordion.attributes.schemaOrg.type ).toBe( 'Article' );
		for ( const item of accordion.innerBlocks ) {
			expect( item.attributes.schemaOrg ).toMatchObject( {
				type: null,
				isProperty: false,
				propertyName: null,
			} );
		}

		const data = await publishAndGetJsonLd();
		const article = findNode( data, 'Article' );
		expect( article ).toBeDefined();
		expect( article ).not.toHaveProperty( 'step' );
		expect( findNode( data, 'HowTo' ) ).toBeUndefined();
	} );

	test( 'turning off "Map as property of parent" on an FAQ item drops its question', async ( {
		editor,
		page,
		schemaPanel,
		publishAndGetJsonLd,
	} ) => {
		const { option } = await insertFromInserter( page, 'FAQ', 'FAQ' );
		await option.click();
		await fillAccordionItem( editor, page, 0, 'Kept?', 'Yes.' );
		await fillAccordionItem( editor, page, 1, 'Dropped?', 'No.' );

		await editor.selectBlocks(
			editor.canvas
				.locator( '[data-type="core/accordion-item"]' )
				.nth( 1 )
		);
		await schemaPanel.open();
		const toggle = schemaPanel.sidebar.getByRole( 'checkbox', {
			name: 'Map as property of parent',
		} );
		await expect( toggle ).toBeChecked();
		await toggle.click();
		await expect( toggle ).not.toBeChecked();

		const [ accordion ] = await editor.getBlocks();
		expect( accordion.innerBlocks[ 1 ].attributes.schemaOrg ).toEqual( {
			type: null,
			mappings: {},
			isProperty: false,
			propertyName: null,
			skipDefaults: true,
		} );

		const data = await publishAndGetJsonLd();
		expect( findNode( data, 'FAQPage' ).mainEntity ).toEqual( {
			'@type': 'Question',
			name: 'Kept?',
			acceptedAnswer: { '@type': 'Answer', text: 'Yes.' },
		} );
		expect( findNode( data, 'Question' ) ).toBeUndefined();
	} );

	test( 'Latest Posts block renders in the editor', async ( { editor } ) => {
		await editor.insertBlock( { name: 'core/latest-posts' } );
		const block = editor.canvas.locator(
			'[data-type="core/latest-posts"]'
		);

		await expect( block ).toBeVisible();
		await expect(
			block.locator( '.wp-block-latest-posts__post-title' ).first()
		).toBeVisible();
		await expect( block ).not.toContainText( 'Error loading block' );
	} );
} );

// Screenshots a page area covering every locator, with some padding.
async function screenshotArea( page, locators, file, padding = 16 ) {
	const boxes = await Promise.all(
		locators.map( ( locator ) => locator.boundingBox() )
	);
	const x = Math.max( 0, Math.min( ...boxes.map( ( b ) => b.x ) ) - padding );
	const y = Math.max( 0, Math.min( ...boxes.map( ( b ) => b.y ) ) - padding );
	const right = Math.max( ...boxes.map( ( b ) => b.x + b.width ) ) + padding;
	const bottom =
		Math.max( ...boxes.map( ( b ) => b.y + b.height ) ) + padding;
	await page.screenshot( {
		path: path.join( SCREENSHOT_DIR, file ),
		fullPage: true,
		clip: { x, y, width: right - x, height: bottom - y },
	} );
}

test.describe( 'PR screenshots', () => {
	test.skip(
		! process.env.SCHEMA_SCREENSHOTS,
		'Set SCHEMA_SCREENSHOTS=1 to capture PR screenshots.'
	);
	// Tall enough for the whole Schema.org Mapping panel to fit in the sidebar.
	test.use( { viewport: { width: 1280, height: 1400 } } );

	test( 'capture FAQ screenshots', async ( {
		newPost,
		editor,
		page,
		schemaPanel,
	} ) => {
		await newPost();
		await editor.canvas
			.getByRole( 'textbox', { name: 'Add title' } )
			.fill( 'Frequently asked questions' );

		const { inserter, option } = await insertFromInserter(
			page,
			'schema',
			'FAQ'
		);
		const howToOption = inserter.getByRole( 'option', {
			name: 'How-to',
			exact: true,
		} );
		await expect( howToOption ).toBeVisible();
		await expect( inserter.getByRole( 'option' ) ).toHaveCount( 2 );
		await screenshotArea(
			page,
			[
				inserter.getByRole( 'tablist' ),
				inserter.getByRole( 'searchbox' ),
				option,
				howToOption,
			],
			'inserter-variations.png',
			0
		);
		await option.click();

		await fillAccordionItem(
			editor,
			page,
			0,
			'What does this plugin do?',
			'It adds schema.org structured data to your blocks.'
		);
		await fillAccordionItem(
			editor,
			page,
			1,
			'Does it work with Yoast SEO?',
			'Yes, it adds its data to the Yoast graph.'
		);

		const mappingPanel = schemaPanel.sidebar.locator(
			'.components-panel__body',
			{
				has: page.getByRole( 'button', { name: 'Schema.org Mapping' } ),
			}
		);

		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/accordion"]' )
		);
		await schemaPanel.open();
		await mappingPanel.screenshot( {
			path: path.join( SCREENSHOT_DIR, 'faq-quick-setup.png' ),
		} );

		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/accordion-item"]' ).first()
		);
		await schemaPanel.open();
		await expect(
			schemaPanel.sidebar.getByLabel( 'Value Type' )
		).toHaveValue( 'Question' );
		await mappingPanel.screenshot( {
			path: path.join( SCREENSHOT_DIR, 'accordion-item-value-type.png' ),
		} );

		const postId = await editor.publishPost();
		await page.goto( `/?p=${ postId }` );
		await page
			.locator( '.wp-block-accordion-heading__toggle' )
			.first()
			.click();
		const title = page.locator( 'main h1' ).first();
		const accordion = page.locator( '.wp-block-accordion' );
		await screenshotArea(
			page,
			[ title, accordion ],
			'front-end-faq.png',
			32
		);

		// The same page with its FAQPage JSON-LD printed below the accordion.
		await page.evaluate( () => {
			const data = JSON.parse(
				document.querySelector(
					'head script[type="application/ld+json"]'
				).textContent
			);
			const faq = data[ '@graph' ].find(
				( node ) => node[ '@type' ] === 'FAQPage'
			);
			const pre = document.createElement( 'pre' );
			pre.id = 'schema-json-ld';
			pre.style.cssText =
				'font-size:13px;line-height:1.4;background:#f6f7f7;padding:16px;white-space:pre-wrap;';
			pre.textContent = JSON.stringify( faq, null, 2 );
			document.querySelector( '.wp-block-accordion' ).after( pre );
		} );
		await screenshotArea(
			page,
			[ title, accordion, page.locator( '#schema-json-ld' ) ],
			'front-end-faq-json-ld.png',
			32
		);
	} );
} );
