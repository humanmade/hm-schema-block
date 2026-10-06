/**
 * E2E tests for the core Breadcrumbs block, which is a BreadcrumbList without setup.
 *
 * @package
 */

const { test, expect } = require( './fixtures' );

const TEMPLATE = '/wp/v2/templates/twentytwentyfive//page';

const schemaOrg = ( overrides = {} ) => ( {
	type: null,
	mappings: {},
	isProperty: false,
	propertyName: null,
	...overrides,
} );

// A page template: header, main with a breadcrumbs block and the post content, footer.
const pageTemplate = ( breadcrumbsAttrs ) =>
	[
		'<!-- wp:template-part {"slug":"header","tagName":"header"} /-->',
		'<!-- wp:group {"tagName":"main"} --><main class="wp-block-group">',
		`<!-- wp:breadcrumbs ${ JSON.stringify( breadcrumbsAttrs ) } /-->`,
		'<!-- wp:post-content /-->',
		'</main><!-- /wp:group -->',
		'<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->',
	].join( '\n' );

const getGraphAt = async ( page, url ) => {
	await page.goto( url );
	const scripts = await page
		.locator( 'script[type="application/ld+json"]' )
		.allTextContents();
	return scripts.length ? JSON.parse( scripts[ 0 ] )[ '@graph' ] : [];
};

test.describe( 'Breadcrumbs block', () => {
	let available = true;

	test.beforeAll( async ( { requestUtils } ) => {
		available = await requestUtils
			.rest( { path: '/wp/v2/block-types/core/breadcrumbs' } )
			.then( () => true )
			.catch( () => false );
	} );

	test.beforeEach( () => {
		test.skip( ! available, 'The Breadcrumbs block needs WordPress 7.0.' );
	} );

	test.describe( 'on the front end', () => {
		let home;
		let parent;
		let child;

		test.beforeAll( async ( { requestUtils } ) => {
			const settings = await requestUtils.rest( {
				path: '/wp/v2/settings',
			} );
			home = settings.url.replace( /\/?$/, '/' );
			parent = await requestUtils.rest( {
				method: 'POST',
				path: '/wp/v2/pages',
				data: { title: 'Parent', status: 'publish' },
			} );
			child = await requestUtils.rest( {
				method: 'POST',
				path: '/wp/v2/pages',
				data: {
					title: 'Child',
					status: 'publish',
					parent: parent.id,
				},
			} );
		} );

		test.afterEach( async ( { requestUtils } ) => {
			await requestUtils
				.rest( {
					method: 'DELETE',
					path: TEMPLATE,
					params: { force: true },
				} )
				.catch( () => {} );
		} );

		test.afterAll( async ( { requestUtils } ) => {
			for ( const page of [ child, parent ] ) {
				await requestUtils
					?.rest( {
						method: 'DELETE',
						path: `/wp/v2/pages/${ page?.id }`,
						params: { force: true },
					} )
					.catch( () => {} );
			}
		} );

		test( 'a block with no schema attribute outputs the trail and links it from the page', async ( {
			page,
			requestUtils,
		}, testInfo ) => {
			await requestUtils.rest( {
				method: 'POST',
				path: TEMPLATE,
				data: { content: pageTemplate( {} ) },
			} );

			const graph = await getGraphAt( page, child.link );
			await testInfo.attach( 'json-ld', {
				body: JSON.stringify( graph, null, 2 ),
				contentType: 'application/json',
			} );

			const lists = graph.filter(
				( node ) => node[ '@type' ] === 'BreadcrumbList'
			);
			expect( lists ).toEqual( [
				{
					'@id': `${ child.link }#breadcrumb`,
					'@type': 'BreadcrumbList',
					itemListElement: [
						{
							'@type': 'ListItem',
							position: 1,
							name: 'Home',
							item: home,
						},
						{
							'@type': 'ListItem',
							position: 2,
							name: 'Parent',
							item: parent.link,
						},
						{
							'@type': 'ListItem',
							position: 3,
							name: 'Child',
							item: child.link,
						},
					],
				},
			] );

			const pageNode = graph.find(
				( node ) => node[ '@id' ] === child.link
			);
			expect( pageNode[ '@type' ] ).toBe( 'WebPage' );
			expect( pageNode.breadcrumb ).toEqual( {
				'@id': `${ child.link }#breadcrumb`,
			} );
			expect( pageNode.mainEntity ).toBeUndefined();
			expect( lists[ 0 ].isPartOf ).toBeUndefined();
		} );

		test( 'a block saved with no schema type outputs nothing', async ( {
			page,
			requestUtils,
		} ) => {
			await requestUtils.rest( {
				method: 'POST',
				path: TEMPLATE,
				data: {
					content: pageTemplate( { schemaOrg: schemaOrg() } ),
				},
			} );

			const graph = await getGraphAt( page, child.link );

			expect(
				graph.filter( ( node ) => node[ '@type' ] === 'BreadcrumbList' )
			).toEqual( [] );
			expect( JSON.stringify( graph ) ).not.toContain( 'breadcrumb' );
			await expect(
				page.locator( 'nav[aria-label="Breadcrumbs"]' )
			).toBeVisible();
		} );
	} );

	test.describe( 'in the editor', () => {
		test.beforeEach( async ( { newPost } ) => {
			await newPost();
		} );

		test( 'shows Breadcrumb List as the schema type', async ( {
			insertBlock,
			schemaPanel,
		} ) => {
			await insertBlock( { name: 'core/breadcrumbs' } );
			await schemaPanel.open();

			await expect(
				schemaPanel.sidebar.getByRole( 'combobox', {
					name: 'Schema Type',
				} )
			).toHaveValue( 'Breadcrumb List' );
		} );

		test( 'clearing the type saves a null type', async ( {
			getSchemaTree,
			insertBlock,
			schemaPanel,
		} ) => {
			const clientId = await insertBlock( { name: 'core/breadcrumbs' } );
			await schemaPanel.open();
			await schemaPanel.sidebar
				.getByRole( 'button', { name: 'Reset' } )
				.click();

			const tree = await getSchemaTree( clientId );
			expect( tree.schemaOrg.type ).toBeNull();
		} );
	} );
} );
