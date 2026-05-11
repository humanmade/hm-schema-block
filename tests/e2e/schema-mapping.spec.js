/**
 * E2E tests for Schema.org Blocks
 *
 * @package
 */

const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'Schema.org Block Mapping', () => {
	test.beforeEach( async ( { admin, editor, page } ) => {
		await admin.createNewPost();
		await editor.setPreferences( 'core/edit-post', {
			welcomeGuide: false,
		} );
		await editor.openDocumentSettingsSidebar();
		// Switch to the Block inspector tab so block-specific panels are visible.
		await page.getByRole( 'tab', { name: 'Block' } ).click();
	} );

	test( 'should show schema mapping panel in inspector', async ( {
		editor,
		page,
	} ) => {
		await editor.insertBlock( { name: 'core/group' } );

		const panel = page.getByRole( 'button', {
			name: 'Schema.org Mapping',
		} );
		await expect( panel ).toBeVisible();
		await panel.click();

		const typeSelect = page.getByLabel( 'Schema Type' );
		await expect( typeSelect ).toBeVisible();
	} );

	test( 'should allow selecting a schema type', async ( {
		editor,
		page,
	} ) => {
		await editor.insertBlock( { name: 'core/group' } );

		await page
			.getByRole( 'button', { name: 'Schema.org Mapping' } )
			.click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'Article' );

		const mappingHeader = page.getByText( 'Schema Property Mapping' );
		await expect( mappingHeader ).toBeVisible();
	} );

	test( 'should show parent schema context to child blocks', async ( {
		editor,
		page,
	} ) => {
		await editor.insertBlock( { name: 'core/group' } );

		await page
			.getByRole( 'button', { name: 'Schema.org Mapping' } )
			.click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'Article' );

		await editor.insertBlock( { name: 'core/paragraph' } );

		await page
			.getByRole( 'button', { name: 'Schema.org Mapping' } )
			.click();

		const contextNotice = page.getByText( /Parent block has schema type/ );
		await expect( contextNotice ).toBeVisible();
	} );

	test( 'should auto-apply smart defaults for image blocks', async ( {
		editor,
		page,
	} ) => {
		await editor.insertBlock( { name: 'core/group' } );
		await page
			.getByRole( 'button', { name: 'Schema.org Mapping' } )
			.click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'Article' );

		await editor.insertBlock( { name: 'core/image' } );

		await page
			.getByRole( 'button', { name: 'Schema.org Mapping' } )
			.click();

		const propertyToggle = page.getByLabel( 'Map as property of parent' );
		await expect( propertyToggle ).toBeChecked();

		const propertySelect = page.getByLabel( 'Property Name' );
		await expect( propertySelect ).toHaveValue( 'image' );
	} );

	test( 'should allow adding attribute mappings on a typed block', async ( {
		editor,
		page,
	} ) => {
		await editor.insertBlock( { name: 'core/group' } );

		await page
			.getByRole( 'button', { name: 'Schema.org Mapping' } )
			.click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'Article' );

		await page.getByRole( 'button', { name: 'Add mapping' } ).click();

		const schemaPropertySelect = page
			.getByLabel( 'Schema Property' )
			.first();
		await expect( schemaPropertySelect ).toBeVisible();
	} );

	test( 'should allow mapping a schema property on a typed block', async ( {
		editor,
		page,
	} ) => {
		await editor.insertBlock( {
			name: 'core/paragraph',
			attributes: { content: 'Test content' },
		} );

		await page
			.getByRole( 'button', { name: 'Schema.org Mapping' } )
			.click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'CreativeWork' );

		await page.getByRole( 'button', { name: 'Add mapping' } ).click();

		const schemaPropertySelect = page
			.getByLabel( 'Schema Property' )
			.first();
		await expect( schemaPropertySelect ).toBeVisible();
		await schemaPropertySelect.selectOption( 'text' );
		await expect( schemaPropertySelect ).toHaveValue( 'text' );
	} );

	test( 'child isProperty blocks should not show Schema Property Mapping panel', async ( {
		editor,
		page,
	} ) => {
		// Insert a typed group.
		await editor.insertBlock( { name: 'core/group' } );
		await page
			.getByRole( 'button', { name: 'Schema.org Mapping' } )
			.click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'CreativeWork' );

		// Insert a paragraph child and toggle isProperty on.
		await editor.insertBlock( { name: 'core/paragraph' } );
		await page
			.getByRole( 'button', { name: 'Schema.org Mapping' } )
			.click();
		await page.getByLabel( 'Map as property of parent' ).check();

		// Schema Property Mapping panel must NOT appear for this child.
		await expect(
			page.getByText( 'Schema Property Mapping' )
		).not.toBeVisible();
	} );
} );

test.describe( 'Schema.org Frontend Output', () => {
	test( 'should output JSON-LD in <head> after publishing', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost();
		await editor.setPreferences( 'core/edit-post', {
			welcomeGuide: false,
		} );

		await editor.insertBlock( {
			name: 'core/group',
			attributes: {
				schemaOrg: {
					type: 'Article',
					mappings: {},
					isProperty: false,
					propertyName: null,
				},
			},
		} );

		await editor.insertBlock( {
			name: 'core/heading',
			attributes: {
				content: 'Schema Test Heading',
				schemaOrg: {
					type: null,
					mappings: {
						headline: { source: 'content' },
					},
					isProperty: false,
					propertyName: null,
				},
			},
		} );

		const postId = await editor.publishPost();
		await page.goto( `/?p=${ postId }` );

		// Must be in <head>, not body/footer.
		const jsonLd = page.locator(
			'head script[type="application/ld+json"]'
		);
		await expect( jsonLd ).toBeAttached();

		const raw = await jsonLd.textContent();
		const data = JSON.parse( raw );

		expect( data[ '@context' ] ).toBe( 'https://schema.org' );
		expect( data[ '@graph' ] ).toBeInstanceOf( Array );

		const article = data[ '@graph' ].find(
			( n ) => n[ '@type' ] === 'Article'
		);
		expect( article ).toBeDefined();
	} );

	test( 'should not produce duplicate graph entries', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost();
		await editor.setPreferences( 'core/edit-post', {
			welcomeGuide: false,
		} );

		await editor.insertBlock( {
			name: 'core/group',
			attributes: {
				schemaOrg: {
					type: 'Article',
					mappings: {},
					isProperty: false,
					propertyName: null,
				},
			},
		} );

		const postId = await editor.publishPost();
		await page.goto( `/?p=${ postId }` );

		const jsonLd = page.locator(
			'head script[type="application/ld+json"]'
		);
		await expect( jsonLd ).toBeAttached();

		const raw = await jsonLd.textContent();
		const data = JSON.parse( raw );
		const articles = data[ '@graph' ].filter(
			( n ) => n[ '@type' ] === 'Article'
		);

		// Primed flag must prevent double-counting from the_content() re-render.
		expect( articles ).toHaveLength( 1 );
	} );

	test( 'child isProperty blocks should populate parent schema properties', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost();
		await editor.setPreferences( 'core/edit-post', {
			welcomeGuide: false,
		} );

		// Parent: Group typed as CreativeWork.
		await editor.insertBlock( {
			name: 'core/group',
			attributes: {
				schemaOrg: {
					type: 'CreativeWork',
					mappings: {},
					isProperty: false,
					propertyName: null,
				},
			},
			innerBlocks: [
				{
					name: 'core/paragraph',
					attributes: {
						content: 'My Creative Work Name',
						schemaOrg: {
							type: null,
							mappings: {},
							isProperty: true,
							propertyName: 'name',
						},
					},
				},
				{
					name: 'core/paragraph',
					attributes: {
						content: 'A description of the creative work.',
						schemaOrg: {
							type: null,
							mappings: {},
							isProperty: true,
							propertyName: 'description',
						},
					},
				},
			],
		} );

		const postId = await editor.publishPost();
		await page.goto( `/?p=${ postId }` );

		const jsonLd = page.locator(
			'head script[type="application/ld+json"]'
		);
		await expect( jsonLd ).toBeAttached();

		const raw = await jsonLd.textContent();
		const data = JSON.parse( raw );

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
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost();
		await editor.setPreferences( 'core/edit-post', {
			welcomeGuide: false,
		} );

		// Parent Article with a nested Person (author) as a property.
		await editor.insertBlock( {
			name: 'core/group',
			attributes: {
				schemaOrg: {
					type: 'Article',
					mappings: {},
					isProperty: false,
					propertyName: null,
				},
			},
			innerBlocks: [
				{
					name: 'core/group',
					attributes: {
						schemaOrg: {
							type: 'Person',
							mappings: {},
							isProperty: true,
							propertyName: 'author',
						},
					},
					innerBlocks: [
						{
							name: 'core/paragraph',
							attributes: {
								content: 'Jane Doe',
								schemaOrg: {
									type: null,
									mappings: {},
									isProperty: true,
									propertyName: 'name',
								},
							},
						},
					],
				},
			],
		} );

		const postId = await editor.publishPost();
		await page.goto( `/?p=${ postId }` );

		const jsonLd = page.locator(
			'head script[type="application/ld+json"]'
		);
		await expect( jsonLd ).toBeAttached();

		const raw = await jsonLd.textContent();
		const data = JSON.parse( raw );

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
