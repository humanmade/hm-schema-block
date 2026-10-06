/**
 * E2E tests for the read-only Abilities API abilities that let agents read the structured
 * data guide, the schema.org types and the schema graph of a page.
 *
 * @package
 */

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { test, expect } = require( './fixtures' );

const NAMES = [
	'schema-org-blocks/get-guidance',
	'schema-org-blocks/get-schema-types',
	'schema-org-blocks/get-schema-graph',
];

const readPattern = ( slug ) =>
	fs.readFileSync(
		path.join( process.cwd(), 'patterns', `${ slug }.html` ),
		'utf8'
	);

// Read-only abilities run with GET; input goes in the query string as input[name].
const run = ( requestUtils, name, input = {} ) =>
	requestUtils.rest( {
		path: `/wp-abilities/v1/abilities/${ name }/run`,
		params: Object.fromEntries(
			Object.entries( input ).map( ( [ key, value ] ) => [
				`input[${ key }]`,
				value,
			] )
		),
	} );

// The error status of a failed run, from the REST error that rest() throws.
const failureOf = ( promise ) =>
	promise.then(
		() => {
			throw new Error( 'Expected the ability to fail.' );
		},
		( error ) => error
	);

test.describe( 'Abilities', () => {
	test( 'are listed as read-only tools', async ( { requestUtils } ) => {
		const abilities = await requestUtils.rest( {
			path: '/wp-abilities/v1/abilities',
			params: { category: 'schema-org-blocks', per_page: 100 },
		} );

		expect( abilities.map( ( ability ) => ability.name ).sort() ).toEqual(
			[ ...NAMES ].sort()
		);

		for ( const ability of abilities ) {
			expect( ability.meta.annotations.readonly ).toBe( true );
			expect( ability.meta.mcp.public ).toBe( true );
		}
	} );

	test( 'get-guidance returns the guide and the patterns', async ( {
		requestUtils,
	} ) => {
		const result = await run( requestUtils, NAMES[ 0 ] );

		expect( result.guide ).toContain( '# Schema.org Blocks' );
		expect( result.guide.startsWith( '---' ) ).toBe( false );
		expect( result.patterns ).toHaveLength( 7 );

		for ( const pattern of result.patterns ) {
			expect( pattern.name ).toMatch( /^schema-org-blocks\// );
			expect( pattern.content.length ).toBeGreaterThan( 0 );
		}
	} );

	test( 'get-schema-types lists the types', async ( { requestUtils } ) => {
		const { types } = await run( requestUtils, NAMES[ 1 ] );

		expect( types ).toContainEqual(
			expect.objectContaining( {
				name: 'Article',
				parent: 'CreativeWork',
			} )
		);
		expect( types[ 0 ].properties ).toBeUndefined();
	} );

	test( 'get-schema-types returns one type with inherited properties and subtypes', async ( {
		requestUtils,
	} ) => {
		const { types } = await run( requestUtils, NAMES[ 1 ], {
			type: 'Article',
		} );

		expect( types ).toHaveLength( 1 );
		expect( Object.keys( types[ 0 ].properties ) ).toEqual(
			expect.arrayContaining( [ 'headline', 'name' ] )
		);
		expect( types[ 0 ].subtypes ).toContain( 'BlogPosting' );
	} );

	test( 'get-schema-types rejects an unknown type', async ( {
		requestUtils,
	} ) => {
		const error = await failureOf(
			run( requestUtils, NAMES[ 1 ], { type: 'NotAType' } )
		);

		expect( error.code ).toBe( 'schema_org_blocks_unknown_type' );
		expect( error.data.status ).toBe( 400 );
	} );

	test.describe( 'get-schema-graph', () => {
		const posts = [];

		const createPost = async ( requestUtils, status ) => {
			const post = await requestUtils.createPost( {
				title: `Questions about bread (${ status })`,
				content: readPattern( 'faq' ),
				status,
			} );
			posts.push( post );
			return post;
		};

		test.afterAll( async ( { requestUtils } ) => {
			for ( const post of posts ) {
				await requestUtils.rest( {
					method: 'DELETE',
					path: `/wp/v2/posts/${ post.id }`,
					params: { force: true },
				} );
			}
		} );

		test( 'builds the graph from block markup', async ( {
			requestUtils,
		} ) => {
			const result = await run( requestUtils, NAMES[ 2 ], {
				content: readPattern( 'faq' ),
			} );

			expect( result.source ).toBe( 'content' );
			expect( result.note ).toContain( 'template' );
			expect( result.issues ).toEqual( expect.any( Array ) );
			expect( result ).not.toHaveProperty( 'missing' );
			expect( result.graph ).toContainEqual(
				expect.objectContaining( {
					'@type': 'FAQPage',
					mainEntity: expect.anything(),
				} )
			);
		} );

		test( 'reads the rendered page of a published post', async ( {
			requestUtils,
		} ) => {
			const post = await createPost( requestUtils, 'publish' );
			const result = await run( requestUtils, NAMES[ 2 ], {
				post_id: post.id,
			} );

			expect( result.source ).toBe( 'page' );
			expect( result.url ).toBe( post.link );
			expect( result.graph ).toContainEqual(
				expect.objectContaining( { '@type': 'FAQPage' } )
			);
		} );

		test( 'builds the graph from the blocks of a draft', async ( {
			requestUtils,
		} ) => {
			const post = await createPost( requestUtils, 'draft' );
			const result = await run( requestUtils, NAMES[ 2 ], {
				post_id: post.id,
			} );

			expect( result.source ).toBe( 'content' );
			expect( result.post_id ).toBe( post.id );
			expect( result.graph ).toHaveLength( 3 );
			expect( result.graph ).toContainEqual(
				expect.objectContaining( {
					'@type': 'FAQPage',
					'@id': post.link,
					name: post.title.raw,
					mainEntity: expect.anything(),
				} )
			);
		} );

		test( 'rejects a url on another site', async ( { requestUtils } ) => {
			const error = await failureOf(
				run( requestUtils, NAMES[ 2 ], { url: 'https://example.org/' } )
			);

			expect( error.code ).toBe( 'schema_org_blocks_external_url' );
			expect( error.data.status ).toBe( 400 );
		} );

		test( 'rejects input that mixes a url with a post', async ( {
			requestUtils,
		} ) => {
			const error = await failureOf(
				run( requestUtils, NAMES[ 2 ], {
					url: 'https://example.org/',
					post_id: 1,
				} )
			);

			expect( error.code ).toBe( 'schema_org_blocks_invalid_input' );
		} );
	} );
} );
