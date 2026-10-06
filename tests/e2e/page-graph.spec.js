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

const typesOf = ( node ) => [ node[ '@type' ] ].flat();

const PAGE_TYPES = [ 'WebPage', 'FAQPage' ];

// Every object with a type in the graph, at any depth.
const allNodes = ( value ) => {
	if ( Array.isArray( value ) ) {
		return value.flatMap( allNodes );
	}
	if ( value && typeof value === 'object' ) {
		return [
			...( value[ '@type' ] ? [ value ] : [] ),
			...Object.values( value ).flatMap( allNodes ),
		];
	}
	return [];
};

const pageNodes = ( graph ) =>
	allNodes( graph ).filter( ( node ) =>
		typesOf( node ).some( ( type ) => PAGE_TYPES.includes( type ) )
	);

// A group typed Article around a heading that is its headline.
const articleGroup = ( headingText ) =>
	[
		`<!-- wp:group ${ JSON.stringify( {
			schemaOrg: article(),
		} ) } --><div class="wp-block-group">`,
		`<!-- wp:heading ${ JSON.stringify( { schemaOrg: headline } ) } --><h2 class="wp-block-heading">${ headingText }</h2><!-- /wp:heading -->`,
		'</div><!-- /wp:group -->',
	].join( '\n' );

// A single template: main (WebPage) > post content.
const pageTemplate = () =>
	[
		'<!-- wp:template-part {"slug":"header","tagName":"header"} /-->',
		`<!-- wp:group ${ JSON.stringify( {
			tagName: 'main',
			schemaOrg: webPage,
		} ) } --><main class="wp-block-group">`,
		'<!-- wp:post-content /-->',
		'</main><!-- /wp:group -->',
		'<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->',
	].join( '\n' );

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

	test( 'a WebPage template with an FAQ in the post is one FAQPage node', async ( {
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

		// The FAQ is not nested in the page; the page is the FAQ.
		expect( graph.map( ( node ) => node[ '@type' ] ).sort() ).toEqual( [
			'FAQPage',
			'Organization',
			'WebSite',
		] );
		expect( pageNodes( graph ) ).toHaveLength( 1 );

		const pageNode = graph.find(
			( node ) => node[ '@type' ] === 'FAQPage'
		);
		expect( pageNode ).toMatchObject( {
			'@id': post.link,
			url: post.link,
			name: 'Questions about bread',
			isPartOf: { '@id': `${ home }#website` },
			hasPart: {
				'@type': 'Article',
				url: post.link,
				headline: 'Questions about bread',
				publisher: { '@id': `${ home }#organization` },
			},
		} );
		expect( pageNode.hasPart.hasPart ).toBeUndefined();
		expect( pageNode.mainEntity.length ).toBeGreaterThan( 1 );
		for ( const question of pageNode.mainEntity ) {
			expect( question[ '@type' ] ).toBe( 'Question' );
		}

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

	test( 'contains set to empty keeps the Article apart from the FAQ page', async ( {
		page,
		requestUtils,
	} ) => {
		await requestUtils.rest( {
			method: 'POST',
			path: TEMPLATE,
			data: { content: singleTemplate( article( { contains: '' } ) ) },
		} );

		const graph = graphOf( await getJsonLdAt( page, post.link ) );
		const pageNode = graph.find( ( node ) => node[ '@id' ] === post.link );

		expect( pageNodes( graph ) ).toHaveLength( 1 );
		expect( pageNode[ '@type' ] ).toBe( 'FAQPage' );
		expect( pageNode.hasPart ).toMatchObject( { '@type': 'Article' } );
		expect( pageNode.hasPart.hasPart ).toBeUndefined();
	} );

	test( 'an FAQ and an Article group in the post of a WebPage template make one page', async ( {
		page,
		requestUtils,
	} ) => {
		const mixed = await requestUtils.createPost( {
			title: 'Bread and questions',
			content: `${ articleGroup( 'All about bread' ) }\n${ readPattern( 'faq' ) }`,
			status: 'publish',
		} );

		try {
			await requestUtils.rest( {
				method: 'POST',
				path: TEMPLATE,
				data: { content: pageTemplate() },
			} );

			const graph = graphOf( await getJsonLdAt( page, mixed.link ) );
			const pageNode = graph.find(
				( node ) => node[ '@id' ] === mixed.link
			);

			expect( pageNodes( graph ) ).toHaveLength( 1 );
			expect( pageNode[ '@type' ] ).toBe( 'FAQPage' );
			expect( pageNode.mainEntity.length ).toBeGreaterThan( 1 );
			for ( const question of pageNode.mainEntity ) {
				expect( question[ '@type' ] ).toBe( 'Question' );
			}
			expect( pageNode.hasPart ).toMatchObject( {
				'@type': 'Article',
				headline: 'All about bread',
			} );
		} finally {
			await requestUtils.rest( {
				method: 'DELETE',
				path: `/wp/v2/posts/${ mixed.id }`,
				params: { force: true },
			} );
		}
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
			const pageNode = graph.find(
				( node ) => node[ '@id' ] === looping.link
			);
			expect( pageNodes( graph ) ).toHaveLength( 1 );
			expect( pageNode[ '@type' ] ).toBe( 'FAQPage' );
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

	test( 'without a typed template the post FAQ becomes the page node', async ( {
		page,
	} ) => {
		const graph = graphOf( await getJsonLdAt( page, post.link ) );

		expect( graph.map( ( node ) => node[ '@type' ] ).sort() ).toEqual( [
			'FAQPage',
			'Organization',
			'WebSite',
		] );
		expect( pageNodes( graph ) ).toHaveLength( 1 );

		const pageNode = graph.find(
			( node ) => node[ '@type' ] === 'FAQPage'
		);
		expect( pageNode ).toMatchObject( {
			'@id': post.link,
			url: post.link,
			name: 'Questions about bread',
			isPartOf: { '@id': `${ home }#website` },
			inLanguage: expect.any( String ),
		} );
		expect( pageNode.mainEntity.length ).toBeGreaterThan( 1 );
		for ( const question of pageNode.mainEntity ) {
			expect( question[ '@type' ] ).toBe( 'Question' );
		}
	} );
} );

test.describe( 'Page node without a typed template', () => {
	test( 'a lone Article is the main entity of a WebPage node', async ( {
		page,
		requestUtils,
	} ) => {
		const settings = await requestUtils.rest( { path: '/wp/v2/settings' } );
		const home = settings.url.replace( /\/?$/, '/' );
		const single = await requestUtils.createPost( {
			title: 'All about bread',
			content: articleGroup( 'All about bread' ),
			status: 'publish',
		} );

		try {
			const graph = graphOf( await getJsonLdAt( page, single.link ) );

			expect( graph.map( ( node ) => node[ '@type' ] ).sort() ).toEqual( [
				'Article',
				'Organization',
				'WebPage',
				'WebSite',
			] );

			const pageNode = graph.find(
				( node ) => node[ '@type' ] === 'WebPage'
			);
			expect( pageNode ).toMatchObject( {
				'@id': single.link,
				url: single.link,
				name: 'All about bread',
				isPartOf: { '@id': `${ home }#website` },
				mainEntity: { '@id': `${ single.link }#article` },
			} );
			expect(
				graph.find( ( node ) => node[ '@type' ] === 'Article' )
			).toMatchObject( {
				'@id': `${ single.link }#article`,
				mainEntityOfPage: { '@id': single.link },
				headline: 'All about bread',
			} );
		} finally {
			await requestUtils.rest( {
				method: 'DELETE',
				path: `/wp/v2/posts/${ single.id }`,
				params: { force: true },
			} );
		}
	} );
} );

test.describe( 'Page node of a graph that already has one', () => {
	const ROUTE = '/schema-org-blocks-test/v1/assemble';
	const pageId = 'https://example.com/bread/';
	const faq = {
		'@type': 'FAQPage',
		mainEntity: [
			{ '@type': 'Question', name: 'Why?' },
			{ '@type': 'Question', name: 'How?' },
		],
	};
	const yoastGraph = () => [
		{
			'@type': 'Article',
			'@id': `${ pageId }#article`,
			isPartOf: { '@id': pageId },
			headline: 'Bread',
		},
		{
			'@type': 'WebPage',
			'@id': pageId,
			url: pageId,
			name: 'Bread',
			isPartOf: { '@id': 'https://example.com/#website' },
		},
		{ '@type': 'WebSite', '@id': 'https://example.com/#website' },
		{ '@type': 'Organization', '@id': 'https://example.com/#organization' },
	];

	const assemble = async ( requestUtils, graph, ownsPage ) => {
		try {
			return await requestUtils.rest( {
				method: 'POST',
				path: ROUTE,
				data: { graph, pageId, ownsPage },
			} );
		} catch ( error ) {
			if ( error.code === 'rest_no_route' ) {
				return null;
			}
			throw error;
		}
	};

	test( 'a block FAQPage joins the WebPage node as a second type', async ( {
		requestUtils,
	} ) => {
		const result = await assemble(
			requestUtils,
			[ ...yoastGraph(), faq ],
			false
		);
		test.skip(
			! result,
			'The test mu-plugin is not mounted on this server.'
		);

		const pages = pageNodes( result );
		expect( pages ).toHaveLength( 1 );
		expect( pages[ 0 ] ).toMatchObject( {
			'@id': pageId,
			'@type': [ 'WebPage', 'FAQPage' ],
			name: 'Bread',
			mainEntity: faq.mainEntity,
		} );
		expect( result.map( ( node ) => node[ '@type' ] ) ).toEqual( [
			'Article',
			[ 'WebPage', 'FAQPage' ],
			'WebSite',
			'Organization',
		] );
	} );

	test( 'a WebPage node matched by url takes the page @id', async ( {
		requestUtils,
	} ) => {
		const graph = yoastGraph();
		delete graph[ 1 ][ '@id' ];
		const result = await assemble( requestUtils, [ ...graph, faq ], false );
		test.skip(
			! result,
			'The test mu-plugin is not mounted on this server.'
		);

		const pages = pageNodes( result );
		expect( pages ).toHaveLength( 1 );
		expect( pages[ 0 ] ).toMatchObject( {
			'@id': pageId,
			'@type': [ 'WebPage', 'FAQPage' ],
		} );
	} );

	test( 'several entities are not linked to an added page node', async ( {
		requestUtils,
	} ) => {
		const graph = [
			{ '@type': 'Article', headline: 'Bread' },
			{ '@type': 'Recipe', name: 'Sourdough' },
		];
		const result = await assemble( requestUtils, graph, true );
		test.skip(
			! result,
			'The test mu-plugin is not mounted on this server.'
		);

		expect( result ).toEqual( [
			{
				'@id': pageId,
				'@type': 'WebPage',
				url: pageId,
				isPartOf: { '@id': expect.stringMatching( /\/#website$/ ) },
				inLanguage: expect.any( String ),
			},
			...graph,
		] );
	} );

	test( 'without a page node the graph is left as it is', async ( {
		requestUtils,
	} ) => {
		const graph = [ faq, { '@type': 'Article', headline: 'Bread' } ];
		const result = await assemble( requestUtils, graph, false );
		test.skip(
			! result,
			'The test mu-plugin is not mounted on this server.'
		);

		expect( result ).toEqual( graph );
	} );
} );

test.describe( 'Entities repeated in the graph', () => {
	test( 'the same author on every post in a list is one Person node', async ( {
		page,
		requestUtils,
	} ) => {
		const posts = [];
		for ( const title of [ 'First loaf', 'Second loaf' ] ) {
			posts.push(
				await requestUtils.createPost( {
					title,
					content:
						'<!-- wp:paragraph --><p>Bread.</p><!-- /wp:paragraph -->',
					status: 'publish',
				} )
			);
		}
		const property = ( propertyName, extra = {} ) => ( {
			schemaOrg: {
				type: null,
				mappings: {},
				isProperty: true,
				propertyName,
				...extra,
			},
		} );
		const list = `<!-- wp:query ${ JSON.stringify( {
			queryId: 7,
			query: {
				perPage: 2,
				postType: 'post',
				order: 'desc',
				orderBy: 'date',
				inherit: false,
			},
			schemaOrg: {
				type: 'Blog',
				mappings: {},
				isProperty: false,
				propertyName: null,
			},
		} ) } --><div class="wp-block-query"><!-- wp:post-template ${ JSON.stringify(
			{
				schemaOrg: {
					type: 'BlogPosting',
					mappings: {},
					isProperty: true,
					propertyName: 'blogPost',
				},
			}
		) } --><!-- wp:post-title ${ JSON.stringify(
			property( 'headline' )
		) } /--><!-- wp:post-author-name ${ JSON.stringify(
			property( 'author' )
		) } /--><!-- /wp:post-template --></div><!-- /wp:query -->`;
		const listing = await requestUtils.createPost( {
			title: 'Latest loaves',
			content: list,
			status: 'publish',
		} );

		try {
			const graph = graphOf( await getJsonLdAt( page, listing.link ) );
			const people = graph.filter(
				( node ) => node[ '@type' ] === 'Person'
			);
			expect( people ).toHaveLength( 1 );
			expect( people[ 0 ] ).toMatchObject( {
				'@id': expect.stringMatching( /#\/schema\/person\/[a-f0-9]+$/ ),
				name: expect.any( String ),
				url: expect.stringMatching( /^https?:\/\// ),
			} );

			const blog = graph.find( ( node ) => node[ '@type' ] === 'Blog' );
			expect( blog.blogPost.length ).toBeGreaterThanOrEqual( 2 );
			for ( const posting of blog.blogPost ) {
				expect( posting.author ).toEqual( {
					'@id': people[ 0 ][ '@id' ],
				} );
			}
		} finally {
			for ( const post of [ ...posts, listing ] ) {
				await requestUtils.rest( {
					method: 'DELETE',
					path: `/wp/v2/posts/${ post.id }`,
					params: { force: true },
				} );
			}
		}
	} );
} );
