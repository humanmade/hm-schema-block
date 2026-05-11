/**
 * E2E tests for Schema.org Blocks
 *
 * @package SchemaOrgBlocks
 */

const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'Schema.org Block Mapping', () => {
	test.beforeEach( async ( { admin, editor } ) => {
		await admin.createNewPost();
		await editor.setPreferences( 'core/edit-post', { welcomeGuide: false } );
	} );

	test( 'should show schema mapping panel in inspector', async ( { editor, page } ) => {
		await editor.insertBlock( { name: 'core/group' } );

		const panel = page.getByRole( 'button', { name: 'Schema.org Mapping' } );
		await expect( panel ).toBeVisible();
		await panel.click();

		const typeSelect = page.getByLabel( 'Schema Type' );
		await expect( typeSelect ).toBeVisible();
	} );

	test( 'should allow selecting a schema type', async ( { editor, page } ) => {
		await editor.insertBlock( { name: 'core/group' } );

		await page.getByRole( 'button', { name: 'Schema.org Mapping' } ).click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'Article' );

		const mappingHeader = page.getByText( 'Attribute Mappings' );
		await expect( mappingHeader ).toBeVisible();
	} );

	test( 'should show parent schema context to child blocks', async ( { editor, page } ) => {
		await editor.insertBlock( { name: 'core/group' } );

		await page.getByRole( 'button', { name: 'Schema.org Mapping' } ).click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'Article' );

		await editor.insertBlock( { name: 'core/paragraph' } );

		await page.getByRole( 'button', { name: 'Schema.org Mapping' } ).click();

		const contextNotice = page.getByText( /Parent block has schema type/ );
		await expect( contextNotice ).toBeVisible();
	} );

	test( 'should auto-apply smart defaults for image blocks', async ( { editor, page } ) => {
		await editor.insertBlock( { name: 'core/group' } );
		await page.getByRole( 'button', { name: 'Schema.org Mapping' } ).click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'Article' );

		await editor.insertBlock( { name: 'core/image' } );

		await page.getByRole( 'button', { name: 'Schema.org Mapping' } ).click();

		const propertyToggle = page.getByLabel( 'Map as property of parent' );
		await expect( propertyToggle ).toBeChecked();

		const propertySelect = page.getByLabel( 'Property Name' );
		await expect( propertySelect ).toHaveValue( 'image' );
	} );

	test( 'should allow adding attribute mappings', async ( { editor, page } ) => {
		await editor.insertBlock( { name: 'core/group' } );

		await page.getByRole( 'button', { name: 'Schema.org Mapping' } ).click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'Article' );

		await page.getByRole( 'button', { name: 'Add mapping' } ).click();

		const schemaPropertySelect = page.getByLabel( 'Schema Property' ).first();
		await expect( schemaPropertySelect ).toBeVisible();
	} );

	test( 'should allow mapping block content to schema property', async ( { editor, page } ) => {
		await editor.insertBlock( {
			name: 'core/paragraph',
			attributes: { content: 'Test content' },
		} );

		await page.getByRole( 'button', { name: 'Schema.org Mapping' } ).click();
		await page.getByLabel( 'Schema Type' ).selectOption( 'CreativeWork' );

		await page.getByRole( 'button', { name: 'Add mapping' } ).click();

		await page.getByLabel( 'Schema Property' ).first().selectOption( 'text' );
		await page.getByLabel( 'Source' ).first().selectOption( 'content' );

		await expect( page.getByLabel( 'Source' ).first() ).toHaveValue( 'content' );
	} );
} );

test.describe( 'Schema.org Frontend Output', () => {
	test( 'should output JSON-LD in <head> after publishing', async ( { admin, editor, page } ) => {
		await admin.createNewPost();
		await editor.setPreferences( 'core/edit-post', { welcomeGuide: false } );

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
		const jsonLd = page.locator( 'head script[type="application/ld+json"]' );
		await expect( jsonLd ).toBeAttached();

		const raw = await jsonLd.textContent();
		const data = JSON.parse( raw );

		expect( data[ '@context' ] ).toBe( 'https://schema.org' );
		expect( data[ '@graph' ] ).toBeInstanceOf( Array );

		const article = data[ '@graph' ].find( ( n ) => n[ '@type' ] === 'Article' );
		expect( article ).toBeDefined();
	} );

	test( 'should not produce duplicate graph entries', async ( { admin, editor, page } ) => {
		await admin.createNewPost();
		await editor.setPreferences( 'core/edit-post', { welcomeGuide: false } );

		await editor.insertBlock( {
			name: 'core/group',
			attributes: {
				schemaOrg: { type: 'Article', mappings: {}, isProperty: false, propertyName: null },
			},
		} );

		const postId = await editor.publishPost();
		await page.goto( `/?p=${ postId }` );

		const jsonLd = page.locator( 'head script[type="application/ld+json"]' );
		await expect( jsonLd ).toBeAttached();

		const raw = await jsonLd.textContent();
		const data = JSON.parse( raw );
		const articles = data[ '@graph' ].filter( ( n ) => n[ '@type' ] === 'Article' );

		// Primed flag must prevent double-counting from the_content() re-render.
		expect( articles ).toHaveLength( 1 );
	} );

	/**
	 * Verification test 7: template wrapping post-content.
	 *
	 * With an FSE theme (twentytwentyfive), this probes whether a Group block
	 * wrapping core/post-content in the single template and assigned schemaOrg.type
	 * produces either a valid nested or a valid flat graph (both are acceptable in v1;
	 * the test documents whichever behavior the implementation produces).
	 *
	 * NOTE: This test requires manual template editing in the site editor before it can
	 * be fully automated. Mark as todo until the blueprint can inject template content.
	 */
	test.todo(
		'template group wrapping core/post-content produces a valid schema graph'
	);
} );
