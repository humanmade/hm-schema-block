/**
 * E2E tests for the graph controls: entity id, nesting and references to other entities.
 *
 * @package
 */

const { test, expect } = require( './fixtures' );

const TEMPLATE = '/wp/v2/templates/twentytwentyfive//single';

const getSchemaOrg = ( page, clientId ) =>
	page.evaluate(
		( id ) =>
			window.wp.data
				.select( 'core/block-editor' )
				.getBlockAttributes( id ).schemaOrg,
		clientId
	);

const graphOf = ( data ) => data?.[ '@graph' ] ?? [];

test.describe( 'Graph controls', () => {
	let home;

	test.beforeAll( async ( { requestUtils } ) => {
		const settings = await requestUtils.rest( { path: '/wp/v2/settings' } );
		home = settings.url.replace( /\/?$/, '/' );
	} );

	test.describe( 'in the post editor', () => {
		test.beforeEach( async ( { newPost } ) => {
			await newPost();
		} );

		test( 'Entity ID sets and clears the block id', async ( {
			page,
			insertBlock,
			schemaPanel,
		} ) => {
			const groupId = await insertBlock( { name: 'core/group' } );
			await schemaPanel.setType( 'Organization' );

			const entityId = schemaPanel.sidebar.getByLabel( 'Entity ID' );
			await entityId.fill( 'Main Org' );
			await expect( entityId ).toHaveValue( 'main-org' );
			expect( ( await getSchemaOrg( page, groupId ) ).id ).toBe(
				'main-org'
			);

			await entityId.fill( '' );
			await expect( entityId ).toHaveValue( '' );
			expect(
				( await getSchemaOrg( page, groupId ) ).id
			).toBeUndefined();
		} );

		test( 'Nest inner entities as sets contains', async ( {
			page,
			insertBlock,
			schemaPanel,
		} ) => {
			const groupId = await insertBlock( { name: 'core/group' } );
			await schemaPanel.setType( 'Article' );

			const nest = schemaPanel.sidebar.getByLabel(
				'Nest inner entities as'
			);
			// Article has no mainEntity property, so it is not offered.
			await expect(
				nest.locator( 'option[value="mainEntity"]' )
			).toHaveCount( 0 );

			await nest.selectOption( {
				label: 'None (keep them as separate nodes)',
			} );
			expect( ( await getSchemaOrg( page, groupId ) ).contains ).toBe(
				''
			);

			await nest.selectOption( { label: 'Default (Has Part)' } );
			expect(
				( await getSchemaOrg( page, groupId ) ).contains
			).toBeUndefined();

			await schemaPanel.sidebar
				.getByLabel( 'Schema Type' )
				.selectOption( 'WebPage' );
			await nest.selectOption( { label: 'Main Entity' } );
			expect( ( await getSchemaOrg( page, groupId ) ).contains ).toBe(
				'mainEntity'
			);
			await expect( nest ).toHaveValue( 'mainEntity' );
		} );

		test( 'a mapping links to another entity by its Entity ID', async ( {
			page,
			editor,
			insertBlock,
			schemaPanel,
			getSchemaTree,
			publishAndGetJsonLd,
		}, testInfo ) => {
			// Group A: an Organization named by its heading, with the id "maker".
			const makerId = await insertBlock( { name: 'core/group' } );
			await schemaPanel.setType( 'Organization' );
			await schemaPanel.sidebar.getByLabel( 'Entity ID' ).fill( 'maker' );
			await insertBlock(
				{ name: 'core/heading', attributes: { content: 'Acme' } },
				makerId
			);

			// Group B: an Article whose publisher links to "maker".
			await editor.insertBlock( { name: 'core/group' } );
			const articleId = await page.evaluate( () =>
				window.wp.data
					.select( 'core/block-editor' )
					.getSelectedBlockClientId()
			);
			await schemaPanel.setType( 'Article' );
			await insertBlock(
				{ name: 'core/heading', attributes: { content: 'News' } },
				articleId
			);

			const [ maker, article ] = await getSchemaTree();
			expect( maker.innerBlocks[ 0 ].schemaOrg ).toMatchObject( {
				isProperty: true,
				propertyName: 'name',
			} );
			expect( article.innerBlocks[ 0 ].schemaOrg ).toMatchObject( {
				isProperty: true,
				propertyName: 'headline',
			} );

			await editor.selectBlocks(
				editor.canvas.locator( `[data-block="${ articleId }"]` )
			);
			await schemaPanel.open();
			await schemaPanel.sidebar
				.getByRole( 'button', { name: 'Add mapping' } )
				.click();
			const row = schemaPanel.sidebar.locator(
				'.schema-org-blocks-attribute-mapping__row'
			);
			await expect( row ).toHaveCount( 1 );
			await row
				.getByLabel( 'Schema Property' )
				.selectOption( 'publisher' );
			await row
				.getByLabel( 'Source' )
				.selectOption( { label: 'Link to another entity by ID' } );
			await row.getByLabel( 'Linked entity ID' ).fill( 'maker' );

			expect(
				( await getSchemaOrg( page, articleId ) ).mappings.publisher
			).toEqual( { source: 'reference', id: 'maker' } );

			const data = await publishAndGetJsonLd();
			await testInfo.attach( 'json-ld', {
				body: JSON.stringify( data, null, 2 ),
				contentType: 'application/json',
			} );
			const graph = graphOf( data );

			expect(
				graph.find( ( node ) => node[ '@type' ] === 'Organization' )
			).toMatchObject( { '@id': `${ home }#maker`, name: 'Acme' } );
			expect(
				graph.find( ( node ) => node[ '@type' ] === 'Article' )
			).toMatchObject( {
				headline: 'News',
				publisher: { '@id': `${ home }#maker` },
			} );
		} );
	} );

	test( 'the Web page preset on a template main group outputs a WebPage', async ( {
		admin,
		editor,
		page,
		requestUtils,
		schemaPanel,
	}, testInfo ) => {
		const post = await requestUtils.createPost( {
			title: 'A page in the graph',
			content: '<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->',
			status: 'publish',
		} );

		try {
			await admin.visitSiteEditor( {
				postId: 'twentytwentyfive//single',
				postType: 'wp_template',
				canvas: 'edit',
			} );

			// The main group wraps the post content.
			const findMain = () =>
				page.evaluate( () => {
					const store = window.wp.data.select( 'core/block-editor' );
					return (
						store
							.getBlocksByName( 'core/group' )
							.find(
								( id ) =>
									store.getBlockAttributes( id ).tagName ===
									'main'
							) ?? null
					);
				} );
			await expect.poll( findMain ).not.toBeNull();
			const mainId = await findMain();
			await page.evaluate(
				( id ) =>
					window.wp.data
						.dispatch( 'core/block-editor' )
						.selectBlock( id ),
				mainId
			);

			await schemaPanel.open();
			await schemaPanel.sidebar
				.getByRole( 'button', { name: 'Web page', exact: true } )
				.click();

			await expect(
				schemaPanel.sidebar.getByLabel( 'Entity ID' )
			).toBeVisible();
			await expect(
				schemaPanel.sidebar.getByLabel( 'Nest inner entities as' )
			).toHaveValue( 'mainEntity' );
			expect( await getSchemaOrg( page, mainId ) ).toMatchObject( {
				type: 'WebPage',
				contains: 'mainEntity',
			} );

			await editor.saveSiteEditorEntities( {
				isOnlyCurrentEntityDirty: true,
			} );

			await page.goto( post.link );
			const script = page.locator(
				'head script[type="application/ld+json"]'
			);
			await expect( script ).toBeAttached();
			const data = JSON.parse( await script.textContent() );
			await testInfo.attach( 'json-ld', {
				body: JSON.stringify( data, null, 2 ),
				contentType: 'application/json',
			} );

			expect(
				graphOf( data ).find(
					( node ) => node[ '@type' ] === 'WebPage'
				)
			).toMatchObject( {
				'@id': post.link,
				isPartOf: { '@id': `${ home }#website` },
			} );
		} finally {
			await requestUtils
				.rest( {
					method: 'DELETE',
					path: TEMPLATE,
					params: { force: true },
				} )
				.catch( () => {} );
			await requestUtils.rest( {
				method: 'DELETE',
				path: `/wp/v2/posts/${ post.id }`,
				params: { force: true },
			} );
		}
	} );
} );
