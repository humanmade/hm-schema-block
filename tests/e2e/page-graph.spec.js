/**
 * E2E tests for template-level schema that contains the entities of the whole page.
 *
 * @package
 */

const fs = require( 'fs' );
const path = require( 'path' );

const { test, expect } = require( './fixtures' );

const readPattern = ( slug ) =>
	fs.readFileSync(
		path.join( __dirname, '../../patterns', `${ slug }.html` ),
		'utf8'
	);

const TEMPLATE = '/wp/v2/templates/twentytwentyfive//single';

const webPage = {
	type: 'WebPage',
	contains: 'mainEntity',
	mappings: {
		'@id': { source: 'post', field: 'url' },
		url: { source: 'post', field: 'url' },
		name: { source: 'post', field: 'title' },
		isPartOf: { source: 'reference', id: 'website' },
	},
	isProperty: false,
	propertyName: null,
};

const article = ( extra = {} ) => ( {
	type: 'Article',
	mappings: {
		url: { source: 'post', field: 'url' },
		publisher: { source: 'reference', id: 'organization' },
	},
	isProperty: false,
	propertyName: null,
	...extra,
} );

const headline = {
	type: null,
	mappings: {},
	isProperty: true,
	propertyName: 'headline',
};

// A single template: main (WebPage) > group (Article) > post title + post content.
const singleTemplate = ( articleSchema ) =>
	[
		'<!-- wp:template-part {"slug":"header","tagName":"header"} /-->',
		`<!-- wp:group ${ JSON.stringify( {
			tagName: 'main',
			schemaOrg: webPage,
		} ) } --><main class="wp-block-group">`,
		`<!-- wp:group ${ JSON.stringify( {
			schemaOrg: articleSchema,
		} ) } --><div class="wp-block-group">`,
		`<!-- wp:post-title ${ JSON.stringify( { schemaOrg: headline } ) } /-->`,
		'<!-- wp:post-content /-->',
		'</div><!-- /wp:group -->',
		'</main><!-- /wp:group -->',
		'<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->',
	].join( '\n' );

const getJsonLdAt = async ( page, url ) => {
	await page.goto( url );
	const scripts = await page
		.locator( 'script[type="application/ld+json"]' )
		.allTextContents();
	return scripts.length ? JSON.parse( scripts[ 0 ] ) : null;
};

const graphOf = ( data ) => data?.[ '@graph' ] ?? [];

test.describe( 'Template schema that contains the page', () => {
	let post;
	let home;

	test.beforeAll( async ( { requestUtils } ) => {
		const settings = await requestUtils.rest( { path: '/wp/v2/settings' } );
		home = settings.url.replace( /\/?$/, '/' );
		post = await requestUtils.createPost( {
			title: 'Questions about bread',
			content: readPattern( 'faq' ),
			status: 'publish',
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
		await requestUtils.rest( {
			method: 'DELETE',
			path: `/wp/v2/posts/${ post.id }`,
			params: { force: true },
		} );
	} );

	test( 'a WebPage template nests the Article, which nests the FAQ in the post', async ( {
		page,
		requestUtils,
	}, testInfo ) => {
		await requestUtils.rest( {
			method: 'POST',
			path: TEMPLATE,
			data: { content: singleTemplate( article() ) },
		} );

		const data = await getJsonLdAt( page, post.link );
		await testInfo.attach( 'json-ld', {
			body: JSON.stringify( data, null, 2 ),
			contentType: 'application/json',
		} );
		const graph = graphOf( data );
		const types = graph.map( ( node ) => node[ '@type' ] );

		// The FAQ and the Article are nested, not separate nodes.
		expect( types.sort() ).toEqual( [
			'Organization',
			'WebPage',
			'WebSite',
		] );

		const webPageNode = graph.find(
			( node ) => node[ '@type' ] === 'WebPage'
		);
		expect( webPageNode ).toMatchObject( {
			'@id': post.link,
			url: post.link,
			name: 'Questions about bread',
			isPartOf: { '@id': `${ home }#website` },
			mainEntity: {
				'@type': 'Article',
				url: post.link,
				headline: 'Questions about bread',
				publisher: { '@id': `${ home }#organization` },
				hasPart: { '@type': 'FAQPage' },
			},
		} );
		expect(
			webPageNode.mainEntity.hasPart.mainEntity.length
		).toBeGreaterThan( 1 );

		// The site nodes the page refers to are built from the site settings.
		expect(
			graph.find( ( node ) => node[ '@type' ] === 'WebSite' )
		).toMatchObject( {
			'@id': `${ home }#website`,
			url: home,
			publisher: { '@id': `${ home }#organization` },
		} );
		expect(
			graph.find( ( node ) => node[ '@type' ] === 'Organization' )
		).toMatchObject( { '@id': `${ home }#organization`, url: home } );
	} );

	test( 'contains set to empty keeps the FAQ as its own node', async ( {
		page,
		requestUtils,
	} ) => {
		await requestUtils.rest( {
			method: 'POST',
			path: TEMPLATE,
			data: { content: singleTemplate( article( { contains: '' } ) ) },
		} );

		const graph = graphOf( await getJsonLdAt( page, post.link ) );
		const webPageNode = graph.find(
			( node ) => node[ '@type' ] === 'WebPage'
		);

		expect( webPageNode.mainEntity.hasPart ).toBeUndefined();
		expect(
			graph.filter( ( node ) => node[ '@type' ] === 'FAQPage' )
		).toHaveLength( 1 );
	} );

	test( 'a synced pattern that shows post content does not loop', async ( {
		page,
		requestUtils,
	} ) => {
		const pattern = await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/blocks',
			data: {
				title: 'Post content inside a pattern',
				status: 'publish',
				content: '<!-- wp:post-content /-->',
			},
		} );
		const looping = await requestUtils.createPost( {
			title: 'Looping post',
			content: `${ readPattern( 'faq' ) }\n<!-- wp:block {"ref":${ pattern.id }} /-->`,
			status: 'publish',
		} );

		try {
			await requestUtils.rest( {
				method: 'POST',
				path: TEMPLATE,
				data: { content: singleTemplate( article() ) },
			} );

			const response = await page.goto( looping.link );
			expect( response.status() ).toBe( 200 );

			const graph = graphOf( await getJsonLdAt( page, looping.link ) );
			const webPageNode = graph.find(
				( node ) => node[ '@type' ] === 'WebPage'
			);
			expect( webPageNode.mainEntity.hasPart[ '@type' ] ).toBe(
				'FAQPage'
			);
		} finally {
			for ( const route of [
				`/wp/v2/posts/${ looping.id }`,
				`/wp/v2/blocks/${ pattern.id }`,
			] ) {
				await requestUtils.rest( {
					method: 'DELETE',
					path: route,
					params: { force: true },
				} );
			}
		}
	} );

	test( 'without a typed template the post FAQ stays a top-level node', async ( {
		page,
	} ) => {
		const graph = graphOf( await getJsonLdAt( page, post.link ) );

		expect( graph.map( ( node ) => node[ '@type' ] ) ).toEqual( [
			'FAQPage',
		] );
	} );
} );
