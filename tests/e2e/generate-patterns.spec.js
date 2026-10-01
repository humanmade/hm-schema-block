/**
 * Writes the block patterns in patterns/ from the block editor, so their markup is
 * exactly what the editor saves. Each pattern is built from plain blocks and set up
 * with Quick setup, like an editor would.
 *
 * Run with `npm run patterns:generate`.
 *
 * @package
 */

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { test, expect } = require( './fixtures' );

const PATTERNS_DIR = path.join( process.cwd(), 'patterns' );

const paragraph = ( content ) => ( {
	name: 'core/paragraph',
	attributes: { content },
} );

const accordionItem = ( title, content ) => ( {
	name: 'core/accordion-item',
	innerBlocks: [
		{ name: 'core/accordion-heading', attributes: { title } },
		{ name: 'core/accordion-panel', innerBlocks: [ paragraph( content ) ] },
	],
} );

const details = ( summary, content ) => ( {
	name: 'core/details',
	attributes: { summary },
	innerBlocks: [ paragraph( content ) ],
} );

const row = ( innerBlocks, layout = {} ) => ( {
	name: 'core/group',
	attributes: {
		layout: { type: 'flex', flexWrap: 'nowrap', ...layout },
	},
	innerBlocks,
} );

const stack = ( innerBlocks ) => ( {
	name: 'core/group',
	attributes: { layout: { type: 'flex', orientation: 'vertical' } },
	innerBlocks,
} );

// The Post Date block as the inserter adds it, bound to the post's publish date.
const postDate = {
	name: 'core/post-date',
	attributes: {
		metadata: {
			bindings: {
				datetime: { source: 'core/post-data', args: { field: 'date' } },
			},
		},
	},
};

const FAQ_ITEMS = [
	[
		'How long does delivery take?',
		'Most orders arrive within 3 to 5 working days. You can track your parcel on <a href="https://example.com/track">our tracking page</a>.',
	],
	[
		'Can I return an item?',
		'Yes. You can return any unused item within 30 days. See <a href="https://example.com/returns">returns</a> for details.',
	],
	[
		'Do you ship abroad?',
		'We ship to most countries. Delivery costs are shown at checkout.',
	],
];

const HOW_TO_STEPS = [
	[
		'Gather your tools',
		'You need a trowel, a watering can and some compost.',
	],
	[
		'Dig the hole',
		'Make the hole twice as wide as the roots and just as deep.',
	],
	[
		'Plant and water',
		'Place the plant, fill in with soil and compost, then water well. More tips at <a href="https://example.com/garden">example.com</a>.',
	],
];

const postList = {
	name: 'core/query',
	attributes: {
		query: {
			perPage: 6,
			pages: 0,
			offset: 0,
			postType: 'post',
			order: 'desc',
			orderBy: 'date',
			author: '',
			search: '',
			exclude: [],
			sticky: '',
			inherit: false,
		},
	},
	innerBlocks: [
		{
			name: 'core/post-template',
			innerBlocks: [
				stack( [
					{
						name: 'core/post-featured-image',
						attributes: { isLink: true, aspectRatio: '3/2' },
					},
					{
						name: 'core/post-title',
						attributes: { isLink: true, level: 3 },
					},
					postDate,
					{ name: 'core/post-excerpt' },
				] ),
			],
		},
	],
};

// Slug => block to insert, the Quick setup button to press on it, and extra
// schemaOrg settings for the top block.
const PATTERNS = {
	faq: {
		block: {
			name: 'core/accordion',
			innerBlocks: FAQ_ITEMS.map( ( item ) => accordionItem( ...item ) ),
		},
		preset: 'FAQ',
	},
	'how-to': {
		block: {
			name: 'core/accordion',
			innerBlocks: HOW_TO_STEPS.map( ( step ) =>
				accordionItem( ...step )
			),
		},
		preset: 'How-to',
	},
	'faq-details': {
		block: {
			name: 'core/group',
			attributes: { layout: { type: 'constrained' } },
			innerBlocks: FAQ_ITEMS.map( ( item ) => details( ...item ) ),
		},
		preset: 'FAQ',
	},
	'article-header': {
		block: {
			name: 'core/group',
			attributes: { layout: { type: 'constrained' } },
			innerBlocks: [
				{
					name: 'core/columns',
					attributes: { verticalAlignment: 'center' },
					innerBlocks: [
						{
							name: 'core/column',
							attributes: { width: '60%' },
							innerBlocks: [
								{
									name: 'core/post-terms',
									attributes: { term: 'category' },
								},
								{
									name: 'core/post-title',
									attributes: { level: 1 },
								},
								row( [
									{ name: 'core/post-author-name' },
									postDate,
								] ),
							],
						},
						{
							name: 'core/column',
							attributes: { width: '40%' },
							innerBlocks: [
								{
									name: 'core/post-featured-image',
									attributes: { aspectRatio: '4/3' },
								},
							],
						},
					],
				},
			],
		},
		preset: 'Article',
		extra: {
			publisher: { source: 'reference', id: 'organization' },
		},
	},
	'site-header-organization': {
		block: row( [
			{ name: 'core/site-logo', attributes: { width: 48 } },
			stack( [
				{ name: 'core/site-title', attributes: { level: 0 } },
				{ name: 'core/site-tagline' },
			] ),
		] ),
		preset: 'Organization',
	},
	'blog-list': { block: postList, preset: 'Blog' },
	'item-list': { block: postList, preset: 'Item list' },
};

test.describe( 'Generate patterns', () => {
	test.skip(
		! process.env.SCHEMA_GENERATE_PATTERNS,
		'Set SCHEMA_GENERATE_PATTERNS=1 to write the patterns.'
	);

	for ( const [ slug, { block, preset, extra } ] of Object.entries(
		PATTERNS
	) ) {
		test( slug, async ( { newPost, editor, page, schemaPanel } ) => {
			await newPost();
			await editor.insertBlock( block );
			await editor.selectBlocks(
				editor.canvas.locator( `[data-type="${ block.name }"]` ).first()
			);
			await schemaPanel.open();
			await schemaPanel.sidebar
				.getByRole( 'button', { name: preset, exact: true } )
				.click();

			if ( extra ) {
				await page.evaluate( ( mappings ) => {
					const { select, dispatch } = window.wp.data;
					const [ top ] = select( 'core/block-editor' ).getBlocks();
					const { schemaOrg } = top.attributes;
					dispatch( 'core/block-editor' ).updateBlockAttributes(
						top.clientId,
						{
							schemaOrg: {
								...schemaOrg,
								mappings: {
									...schemaOrg.mappings,
									...mappings,
								},
							},
						}
					);
				}, extra );
			}

			const content = await page.evaluate( () =>
				window.wp.data.select( 'core/editor' ).getEditedPostContent()
			);
			expect( content ).toContain( '"schemaOrg"' );

			fs.mkdirSync( PATTERNS_DIR, { recursive: true } );
			fs.writeFileSync(
				path.join( PATTERNS_DIR, `${ slug }.html` ),
				content.trim() + '\n'
			);
		} );
	}
} );
