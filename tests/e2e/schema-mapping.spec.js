/**
 * E2E tests for Schema.org Blocks
 *
 * @package
 */

const { test, expect } = require( './fixtures' );

const schemaOrg = ( overrides = {} ) => ( {
	type: null,
	mappings: {},
	isProperty: false,
	propertyName: null,
	...overrides,
} );

// An Article group whose heading child supplies the headline.
const articleWithHeading = ( headline ) => ( {
	name: 'core/group',
	attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
	innerBlocks: [
		{
			name: 'core/heading',
			attributes: {
				content: headline,
				schemaOrg: schemaOrg( {
					isProperty: true,
					propertyName: 'headline',
				} ),
			},
		},
	],
} );

test.describe( 'Schema.org Block Mapping', () => {
	test.beforeEach( async ( { newPost } ) => {
		await newPost();
	} );

	test( 'should show schema mapping panel in inspector', async ( {
		insertBlock,
		schemaPanel,
	} ) => {
		await insertBlock( { name: 'core/group' } );
		await schemaPanel.open();

		await expect(
			schemaPanel.sidebar.getByLabel( 'Schema Type' )
		).toBeVisible();
	} );

	test( 'should allow selecting a schema type', async ( {
		insertBlock,
		schemaPanel,
	} ) => {
		await insertBlock( { name: 'core/group' } );
		await schemaPanel.setType( 'Article' );

		await expect(
			schemaPanel.sidebar.getByText( 'Schema Property Mapping' )
		).toBeVisible();
	} );

	test( 'should show parent schema context to child blocks', async ( {
		insertBlock,
		schemaPanel,
	} ) => {
		const groupId = await insertBlock( { name: 'core/group' } );
		await schemaPanel.setType( 'Article' );

		await insertBlock( { name: 'core/paragraph' }, groupId );
		await schemaPanel.open();

		await expect(
			schemaPanel.sidebar.getByText( /Parent block has schema type/ )
		).toBeVisible();
	} );

	test( 'should auto-apply smart defaults for image blocks', async ( {
		insertBlock,
		schemaPanel,
		getSchemaTree,
	} ) => {
		const groupId = await insertBlock( { name: 'core/group' } );
		await schemaPanel.setType( 'Article' );

		const imageId = await insertBlock( { name: 'core/image' }, groupId );
		await schemaPanel.open();

		await expect(
			schemaPanel.sidebar.getByLabel( 'Map as property of parent' )
		).toBeChecked();
		await expect(
			schemaPanel.sidebar.getByLabel( 'Property Name' )
		).toHaveValue( 'image' );

		const image = await getSchemaTree( imageId );
		expect( image.schemaOrg ).toMatchObject( {
			type: 'ImageObject',
			isProperty: true,
			propertyName: 'image',
		} );
	} );

	test( 'should allow adding attribute mappings on a typed block', async ( {
		insertBlock,
		schemaPanel,
	} ) => {
		await insertBlock( { name: 'core/group' } );
		await schemaPanel.setType( 'Article' );

		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'Add mapping' } )
			.click();

		await expect(
			schemaPanel.sidebar.getByLabel( 'Schema Property' ).first()
		).toBeVisible();
	} );

	test( 'should allow mapping a schema property on a typed block', async ( {
		insertBlock,
		schemaPanel,
	} ) => {
		await insertBlock( {
			name: 'core/paragraph',
			attributes: { content: 'Test content' },
		} );
		await schemaPanel.setType( 'CreativeWork' );

		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'Add mapping' } )
			.click();

		const schemaPropertySelect = schemaPanel.sidebar
			.getByLabel( 'Schema Property' )
			.first();
		await expect( schemaPropertySelect ).toBeVisible();
		await schemaPropertySelect.selectOption( 'text' );
		await expect( schemaPropertySelect ).toHaveValue( 'text' );
	} );

	test( 'child isProperty blocks should not show Schema Property Mapping panel', async ( {
		insertBlock,
		schemaPanel,
	} ) => {
		const groupId = await insertBlock( { name: 'core/group' } );
		await schemaPanel.setType( 'CreativeWork' );

		await insertBlock( { name: 'core/paragraph' }, groupId );
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByLabel( 'Map as property of parent' )
			.check();

		await expect(
			schemaPanel.sidebar.getByText( 'Schema Property Mapping' )
		).toBeHidden();
	} );
} );

test.describe( 'Schema.org Frontend Output', () => {
	test.beforeEach( async ( { newPost } ) => {
		await newPost();
	} );

	test( 'should output JSON-LD in <head> after publishing', async ( {
		editor,
		publishAndGetJsonLd,
	} ) => {
		await editor.insertBlock( articleWithHeading( 'Schema Test Heading' ) );

		const data = await publishAndGetJsonLd();

		expect( data[ '@context' ] ).toBe( 'https://schema.org' );
		expect( data[ '@graph' ] ).toBeInstanceOf( Array );
		expect(
			data[ '@graph' ].find( ( n ) => n[ '@type' ] === 'Article' )
		).toMatchObject( {
			headline: 'Schema Test Heading',
		} );
	} );

	test( 'should not produce duplicate graph entries', async ( {
		editor,
		publishAndGetJsonLd,
	} ) => {
		await editor.insertBlock( articleWithHeading( 'Only Once' ) );

		const data = await publishAndGetJsonLd();
		const articles = data[ '@graph' ].filter(
			( n ) => n[ '@type' ] === 'Article'
		);

		// Primed flag must prevent double-counting from the_content() re-render.
		expect( articles ).toHaveLength( 1 );
	} );

	test( 'child isProperty blocks should populate parent schema properties', async ( {
		editor,
		publishAndGetJsonLd,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'CreativeWork' } ) },
			innerBlocks: [
				{
					name: 'core/paragraph',
					attributes: {
						content: 'My Creative Work Name',
						schemaOrg: schemaOrg( {
							isProperty: true,
							propertyName: 'name',
						} ),
					},
				},
				{
					name: 'core/paragraph',
					attributes: {
						content: 'A description of the creative work.',
						schemaOrg: schemaOrg( {
							isProperty: true,
							propertyName: 'description',
						} ),
					},
				},
			],
		} );

		const data = await publishAndGetJsonLd();

		const creativeWork = data[ '@graph' ].find(
			( n ) => n[ '@type' ] === 'CreativeWork'
		);
		expect( creativeWork ).toBeDefined();
		expect( creativeWork.name ).toBe( 'My Creative Work Name' );
		expect( creativeWork.description ).toBe(
			'A description of the creative work.'
		);

		// Children must NOT appear as separate top-level entries: only the page and site nodes join it.
		const extraEntries = data[ '@graph' ].filter(
			( n ) => n[ '@type' ] !== 'CreativeWork'
		);
		expect( extraEntries.map( ( n ) => n[ '@type' ] ).sort() ).toEqual( [
			'Organization',
			'WebPage',
			'WebSite',
		] );
	} );

	test( 'nested typed entity should attach as property of parent', async ( {
		editor,
		publishAndGetJsonLd,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
			innerBlocks: [
				{
					name: 'core/group',
					attributes: {
						schemaOrg: schemaOrg( {
							type: 'Person',
							isProperty: true,
							propertyName: 'author',
						} ),
					},
					innerBlocks: [
						{
							name: 'core/paragraph',
							attributes: {
								content: 'Jane Doe',
								schemaOrg: schemaOrg( {
									isProperty: true,
									propertyName: 'name',
								} ),
							},
						},
					],
				},
			],
		} );

		const data = await publishAndGetJsonLd();

		const article = data[ '@graph' ].find(
			( n ) => n[ '@type' ] === 'Article'
		);
		expect( article ).toBeDefined();
		expect( article.author ).toBeDefined();
		expect( article.author[ '@type' ] ).toBe( 'Person' );
		expect( article.author.name ).toBe( 'Jane Doe' );

		// Person must not appear as a separate top-level @graph entry.
		const persons = data[ '@graph' ].filter(
			( n ) => n[ '@type' ] === 'Person'
		);
		expect( persons ).toHaveLength( 0 );
	} );

	test( 'image in an Article group becomes an ImageObject', async ( {
		editor,
		getSchemaTree,
		publishAndGetJsonLd,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
			innerBlocks: [
				{
					name: 'core/image',
					attributes: {
						url: 'https://example.com/photo.jpg',
						caption: 'A photo caption',
					},
				},
			],
		} );

		// Smart defaults configure the image without any UI interaction.
		await expect
			.poll( async () => ( await getSchemaTree() )[ 0 ].innerBlocks[ 0 ] )
			.toMatchObject( {
				schemaOrg: {
					type: 'ImageObject',
					isProperty: true,
					propertyName: 'image',
					mappings: {
						contentUrl: {
							source: 'attribute',
							attributeName: 'url',
						},
						caption: {
							source: 'attribute',
							attributeName: 'caption',
						},
					},
				},
			} );

		const data = await publishAndGetJsonLd();
		const article = data[ '@graph' ].find(
			( n ) => n[ '@type' ] === 'Article'
		);

		expect( article.image ).toEqual( {
			'@type': 'ImageObject',
			contentUrl: 'https://example.com/photo.jpg',
			caption: 'A photo caption',
		} );
	} );

	test( 'two images in an Article group produce an image array', async ( {
		editor,
		getSchemaTree,
		publishAndGetJsonLd,
	} ) => {
		const urls = [
			'https://example.com/one.jpg',
			'https://example.com/two.jpg',
		];
		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
			innerBlocks: urls.map( ( url ) => ( {
				name: 'core/image',
				attributes: { url },
			} ) ),
		} );

		await expect
			.poll( async () =>
				( await getSchemaTree() )[ 0 ].innerBlocks.map(
					( b ) => b.schemaOrg.propertyName
				)
			)
			.toEqual( [ 'image', 'image' ] );

		const data = await publishAndGetJsonLd();
		const article = data[ '@graph' ].find(
			( n ) => n[ '@type' ] === 'Article'
		);

		expect( article.image ).toEqual(
			urls.map( ( contentUrl ) => ( {
				'@type': 'ImageObject',
				contentUrl,
			} ) )
		);
	} );

	test( 'plain value for an object-only property is wrapped in an object', async ( {
		editor,
		publishAndGetJsonLd,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
			innerBlocks: [
				{
					name: 'core/paragraph',
					attributes: {
						content: 'Jane Doe',
						schemaOrg: schemaOrg( {
							isProperty: true,
							propertyName: 'author',
						} ),
					},
				},
			],
		} );

		const data = await publishAndGetJsonLd();
		const article = data[ '@graph' ].find(
			( n ) => n[ '@type' ] === 'Article'
		);

		expect( article.author ).toEqual( {
			'@type': 'Person',
			name: 'Jane Doe',
		} );
	} );

	test( 'text containing a closing script tag cannot break out of JSON-LD', async ( {
		editor,
		page,
		publishAndView,
		getJsonLd,
	} ) => {
		const payload = '</script><script>window.__schemaXss=1</script>';

		// Entity-encoded, as rich text stores typed text.
		await editor.insertBlock( {
			name: 'core/paragraph',
			attributes: {
				content: payload
					.replace( /</g, '&lt;' )
					.replace( />/g, '&gt;' ),
				schemaOrg: schemaOrg( {
					type: 'Person',
					mappings: { name: { source: 'content' } },
				} ),
			},
		} );

		const html = await publishAndView();
		const data = await getJsonLd();

		expect( data ).not.toBeNull();
		expect(
			data[ '@graph' ].find( ( n ) => n[ '@type' ] === 'Person' )
		).toMatchObject( {
			name: payload,
		} );
		expect( await page.evaluate( () => typeof window.__schemaXss ) ).toBe(
			'undefined'
		);

		const rawJson = html.match(
			/<script type="application\/ld\+json">([\s\S]*?)<\/script>/
		)[ 1 ];
		expect( rawJson ).not.toContain( '</script><script>' );
		expect( rawJson ).not.toContain( '<' );
	} );

	test( 'typed block with no properties emits nothing', async ( {
		editor,
		publishAndView,
		getJsonLd,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
		} );

		await publishAndView();
		const data = await getJsonLd();
		const articles = ( data?.[ '@graph' ] ?? [] ).filter(
			( n ) => n[ '@type' ] === 'Article'
		);

		expect( articles ).toHaveLength( 0 );
	} );

	test( 'property heading without mappings uses its text', async ( {
		editor,
		publishAndGetJsonLd,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
			innerBlocks: [
				{
					name: 'core/heading',
					attributes: {
						content: 'Hello <em>World</em>',
						schemaOrg: schemaOrg( {
							isProperty: true,
							propertyName: 'headline',
						} ),
					},
				},
			],
		} );

		const data = await publishAndGetJsonLd();
		const article = data[ '@graph' ].find(
			( n ) => n[ '@type' ] === 'Article'
		);

		expect( article.headline ).toBe( 'Hello World' );
	} );

	test.skip( 'template group wrapping core/post-content produces a valid schema graph', () => {} );
} );

test.describe( 'Schema.org Smart Defaults', () => {
	test.beforeEach( async ( { newPost } ) => {
		await newPost();
	} );

	test( 'turning off "Map as property of parent" stays off', async ( {
		editor,
		insertBlock,
		schemaPanel,
		getSchemaTree,
	} ) => {
		const groupId = await insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
		} );
		const headingId = await insertBlock(
			{ name: 'core/heading', attributes: { content: 'Title' } },
			groupId
		);

		await expect
			.poll( async () => ( await getSchemaTree( headingId ) ).schemaOrg )
			.toMatchObject( { isProperty: true, propertyName: 'headline' } );

		await schemaPanel.open();
		const toggle = schemaPanel.sidebar.getByLabel(
			'Map as property of parent'
		);
		await toggle.uncheck();
		await expect( toggle ).not.toBeChecked();

		await editor.selectBlocks(
			editor.canvas.locator( `#block-${ groupId }` )
		);
		await editor.selectBlocks(
			editor.canvas.locator( `#block-${ headingId }` )
		);
		await schemaPanel.open();

		await expect( toggle ).not.toBeChecked();
		expect( ( await getSchemaTree( headingId ) ).schemaOrg ).toMatchObject(
			{
				isProperty: false,
				skipDefaults: true,
			}
		);
	} );

	test( 'only the first paragraph gets the description default', async ( {
		editor,
		getSchemaTree,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
			innerBlocks: [
				{ name: 'core/paragraph', attributes: { content: 'First' } },
				{ name: 'core/paragraph', attributes: { content: 'Second' } },
			],
		} );

		await expect
			.poll( async () => ( await getSchemaTree() )[ 0 ].innerBlocks[ 0 ] )
			.toMatchObject( {
				schemaOrg: { isProperty: true, propertyName: 'description' },
			} );

		const [ , second ] = ( await getSchemaTree() )[ 0 ].innerBlocks;
		expect( second.schemaOrg.isProperty ).toBeFalsy();
		expect( second.schemaOrg.propertyName ).toBeFalsy();
	} );

	test( 'server-rendered core blocks load in the editor', async ( {
		editor,
		page,
	} ) => {
		const rendered = page.waitForResponse( ( response ) =>
			response.url().includes( 'block-renderer/core/archives' )
		);
		await editor.insertBlock( { name: 'core/latest-posts' } );
		await editor.insertBlock( { name: 'core/archives' } );

		expect( ( await rendered ).status() ).toBe( 200 );
		await expect(
			editor.canvas.locator( '.wp-block-latest-posts' )
		).toBeVisible();
		const archives = editor.canvas.locator( '[data-type="core/archives"]' );
		await expect( archives.locator( '.components-spinner' ) ).toHaveCount(
			0
		);
		await expect( archives ).not.toBeEmpty();
		await expect(
			editor.canvas.getByText( /Error loading block|Invalid parameter/ )
		).toHaveCount( 0 );
	} );
} );
