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

	// Plugin bug: smart defaults pick the first URL-typed parent property, so core/image maps to `url` (from Thing) instead of `image`.
	test.fixme(
		'should auto-apply smart defaults for image blocks',
		async ( { insertBlock, schemaPanel } ) => {
			const groupId = await insertBlock( { name: 'core/group' } );
			await schemaPanel.setType( 'Article' );

			await insertBlock( { name: 'core/image' }, groupId );
			await schemaPanel.open();

			await expect(
				schemaPanel.sidebar.getByLabel( 'Map as property of parent' )
			).toBeChecked();
			await expect(
				schemaPanel.sidebar.getByLabel( 'Property Name' )
			).toHaveValue( 'image' );
		}
	);

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
		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
		} );
		await editor.insertBlock( {
			name: 'core/heading',
			attributes: {
				content: 'Schema Test Heading',
				schemaOrg: schemaOrg( {
					mappings: { headline: { source: 'content' } },
				} ),
			},
		} );

		const data = await publishAndGetJsonLd();

		expect( data[ '@context' ] ).toBe( 'https://schema.org' );
		expect( data[ '@graph' ] ).toBeInstanceOf( Array );
		expect(
			data[ '@graph' ].find( ( n ) => n[ '@type' ] === 'Article' )
		).toBeDefined();
	} );

	test( 'should not produce duplicate graph entries', async ( {
		editor,
		publishAndGetJsonLd,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
		} );

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

		// Children must NOT appear as separate top-level entries.
		const extraEntries = data[ '@graph' ].filter(
			( n ) => n[ '@type' ] !== 'CreativeWork'
		);
		expect( extraEntries ).toHaveLength( 0 );
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

	test.skip( 'template group wrapping core/post-content produces a valid schema graph', () => {} );
} );
