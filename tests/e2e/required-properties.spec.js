/**
 * E2E tests for required properties: Article gaps filled from the post, the missing check of
 * the graph ability, and the pre-publish panel.
 *
 * @package
 */

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { test, expect } = require( './fixtures' );

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

const readPattern = ( slug ) =>
	fs.readFileSync(
		path.join( process.cwd(), 'patterns', `${ slug }.html` ),
		'utf8'
	);

const graphOf = ( data ) => data?.[ '@graph' ] ?? [];

const ofType = ( data, type ) =>
	graphOf( data ).filter( ( node ) => node[ '@type' ] === type );

// The first answer of the FAQ pattern, which the incomplete FAQ leaves empty.
const FIRST_ANSWER =
	'<p>Most orders arrive within 3 to 5 working days. You can track your parcel on <a href="https://example.com/track">our tracking page</a>.</p>';
const INCOMPLETE_FAQ = readPattern( 'faq' ).replace( FIRST_ANSWER, '<p></p>' );
const MISSING_ANSWER = {
	type: 'Question',
	property: 'acceptedAnswer',
	label: 'How long does delivery take?',
};

// Read-only abilities run with GET; input goes in the query string as input[name].
const run = ( requestUtils, input ) =>
	requestUtils.rest( {
		path: '/wp-abilities/v1/abilities/schema-org-blocks/get-schema-graph/run',
		params: Object.fromEntries(
			Object.entries( input ).map( ( [ key, value ] ) => [
				`input[${ key }]`,
				value,
			] )
		),
	} );

test.describe( 'Required properties', () => {
	test( 'an Article group with no author or date blocks gets them from the post', async ( {
		page,
		editor,
		newPost,
		schemaPanel,
		publishAndGetJsonLd,
		requestUtils,
	}, testInfo ) => {
		const settings = await requestUtils.rest( { path: '/wp/v2/settings' } );
		const home = settings.url.replace( /\/?$/, '/' );
		const user = await requestUtils.rest( { path: '/wp/v2/users/me' } );

		await newPost();
		await page.evaluate( () =>
			window.wp.data
				.dispatch( 'core/editor' )
				.editPost( { title: 'Ten tips for bread' } )
		);
		await editor.insertBlock( {
			name: 'core/group',
			innerBlocks: [
				{
					name: 'core/paragraph',
					attributes: { content: 'Start with a good flour.' },
				},
			],
		} );
		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/group"]' )
		);
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'Article', exact: true } )
			.click();

		const data = await publishAndGetJsonLd();
		const graph = graphOf( data );
		const [ article ] = ofType( data, 'Article' );
		await testInfo.attach( 'article', {
			body: JSON.stringify( article, null, 2 ),
			contentType: 'application/json',
		} );

		expect( article ).toMatchObject( {
			headline: 'Ten tips for bread',
			datePublished: expect.stringMatching( ISO_DATE ),
			dateModified: expect.stringMatching( ISO_DATE ),
			publisher: { '@id': `${ home }#organization` },
			author: {
				'@type': 'Person',
				'@id': expect.stringMatching( /#\/schema\/person\/[a-f0-9]+$/ ),
				name: user.name,
				url: expect.stringMatching( /^https?:\/\// ),
			},
		} );
		expect(
			graph.find( ( node ) => node[ '@id' ] === `${ home }#organization` )
		).toMatchObject( { '@type': 'Organization', url: home } );
	} );

	test( 'BlogPosting items in a typed query loop get the author and date of their own post', async ( {
		page,
		requestUtils,
	} ) => {
		const query = {
			queryId: 1,
			query: {
				perPage: 10,
				pages: 0,
				offset: 0,
				postType: 'post',
				order: 'asc',
				orderBy: 'date',
				author: '',
				search: 'Quillfeather',
				exclude: [],
				sticky: '',
				inherit: false,
			},
		};
		const schemaOrg = ( extra ) => ( {
			mappings: {},
			isProperty: false,
			propertyName: null,
			...extra,
		} );
		const content = [
			`<!-- wp:query ${ JSON.stringify( {
				...query,
				schemaOrg: schemaOrg( { type: 'Blog' } ),
			} ) } --><div class="wp-block-query">`,
			`<!-- wp:post-template ${ JSON.stringify( {
				schemaOrg: schemaOrg( {
					type: 'BlogPosting',
					isProperty: true,
					propertyName: 'blogPost',
				} ),
			} ) } -->`,
			`<!-- wp:post-title ${ JSON.stringify( {
				schemaOrg: schemaOrg( {
					isProperty: true,
					propertyName: 'headline',
				} ),
			} ) } /-->`,
			'<!-- /wp:post-template --></div><!-- /wp:query -->',
		].join( '\n' );

		const writer = await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/users',
			data: {
				username: 'quillfeather_writer',
				email: 'quillfeather@example.com',
				password: 'Quillfeather-123!',
				name: 'Quill Writer',
				roles: [ 'author' ],
			},
		} );
		const admin = await requestUtils.rest( { path: '/wp/v2/users/me' } );
		const created = [];

		try {
			for ( const [ title, date, author ] of [
				[ 'Quillfeather one', '2021-03-04T10:00:00', admin.id ],
				[ 'Quillfeather two', '2022-05-06T11:00:00', writer.id ],
			] ) {
				created.push(
					await requestUtils.createPost( {
						title,
						date,
						author,
						status: 'publish',
					} )
				);
			}
			const list = await requestUtils.createPost( {
				title: 'Quillfeather list',
				content,
				status: 'publish',
				date: '2023-01-01T00:00:00',
			} );
			created.push( list );

			await page.goto( list.link );
			const data = JSON.parse(
				await page
					.locator( 'script[type="application/ld+json"]' )
					.first()
					.textContent()
			);
			const graph = graphOf( data );
			const [ blog ] = graph.filter(
				( node ) => node[ '@type' ] === 'Blog'
			);
			const posts = blog.blogPost;
			const byHeadline = ( headline ) =>
				posts.find( ( node ) => node.headline === headline );
			const personOf = ( node ) =>
				node.author[ '@id' ] && ! node.author[ '@type' ]
					? graph.find(
							( item ) => item[ '@id' ] === node.author[ '@id' ]
						)
					: node.author;

			expect( byHeadline( 'Quillfeather one' ).datePublished ).toMatch(
				/^2021-03-04T10:00:00/
			);
			expect( byHeadline( 'Quillfeather two' ).datePublished ).toMatch(
				/^2022-05-06T11:00:00/
			);
			expect( personOf( byHeadline( 'Quillfeather one' ) ).name ).toBe(
				admin.name
			);
			expect( personOf( byHeadline( 'Quillfeather two' ) ).name ).toBe(
				'Quill Writer'
			);
		} finally {
			for ( const post of created ) {
				await requestUtils.rest( {
					method: 'DELETE',
					path: `/wp/v2/posts/${ post.id }`,
					params: { force: true },
				} );
			}
			await requestUtils.rest( {
				method: 'DELETE',
				path: `/wp/v2/users/${ writer.id }`,
				params: { force: true, reassign: 1 },
			} );
		}
	} );

	test.describe( 'get-schema-graph missing', () => {
		const TEMPLATE = '/wp/v2/templates/twentytwentyfive//single';
		let draft;

		test.beforeAll( async ( { requestUtils } ) => {
			draft = await requestUtils.createPost( {
				title: 'Questions about bread',
				content: readPattern( 'faq' ),
				status: 'draft',
			} );
		} );

		test.afterAll( async ( { requestUtils } ) => {
			await requestUtils.rest( {
				method: 'DELETE',
				path: `/wp/v2/posts/${ draft.id }`,
				params: { force: true },
			} );
			await requestUtils
				.rest( {
					method: 'DELETE',
					path: TEMPLATE,
					params: { force: true },
				} )
				.catch( () => {} );
		} );

		test( 'lists a question with no answer', async ( { requestUtils } ) => {
			const result = await run( requestUtils, {
				content: INCOMPLETE_FAQ,
			} );

			expect( result.missing ).toEqual( [ MISSING_ANSWER ] );
		} );

		test( 'is empty for a complete FAQ', async ( { requestUtils } ) => {
			const result = await run( requestUtils, {
				content: readPattern( 'faq' ),
			} );

			expect( result.missing ).toEqual( [] );
		} );

		test( 'lists what an Article cannot infer without a post', async ( {
			requestUtils,
		} ) => {
			const article = `<!-- wp:group ${ JSON.stringify( {
				schemaOrg: {
					type: 'Article',
					mappings: { headline: { source: 'attribute' } },
					isProperty: false,
					propertyName: null,
				},
			} ) } --><div class="wp-block-group"><!-- wp:paragraph --><p>Body</p><!-- /wp:paragraph --></div><!-- /wp:group -->`;

			const alone = await run( requestUtils, { content: article } );
			expect( alone.missing ).toEqual( [
				{ type: 'Article', property: 'author', label: 'Body' },
				{ type: 'Article', property: 'publisher', label: 'Body' },
				{ type: 'Article', property: 'datePublished', label: 'Body' },
			] );

			const inPost = await run( requestUtils, {
				content: article,
				post_id: draft.id,
			} );
			expect( inPost.missing ).toEqual( [] );
		} );

		test( 'with_template builds the graph from the post template', async ( {
			requestUtils,
		} ) => {
			const settings = await requestUtils.rest( {
				path: '/wp/v2/settings',
			} );
			const webPage = {
				type: 'WebPage',
				contains: 'mainEntity',
				mappings: {
					'@id': { source: 'post', field: 'url' },
					url: { source: 'post', field: 'url' },
					name: { source: 'post', field: 'title' },
					description: { source: 'site', field: 'name' },
				},
				isProperty: false,
				propertyName: null,
			};
			await requestUtils.rest( {
				method: 'POST',
				path: TEMPLATE,
				data: {
					content: [
						`<!-- wp:group ${ JSON.stringify( {
							tagName: 'main',
							schemaOrg: webPage,
						} ) } --><main class="wp-block-group">`,
						'<!-- wp:post-content /-->',
						'</main><!-- /wp:group -->',
					].join( '\n' ),
				},
			} );

			const input = { content: INCOMPLETE_FAQ, post_id: draft.id };
			const plain = await run( requestUtils, input );
			const withTemplate = await run( requestUtils, {
				...input,
				with_template: true,
			} );

			const pageNode = ( result ) =>
				result.graph.find( ( node ) => node[ '@id' ] === draft.link );

			expect( pageNode( plain ).description ).toBeUndefined();
			expect( pageNode( withTemplate ) ).toMatchObject( {
				'@type': 'FAQPage',
				description: settings.title,
			} );
			expect( withTemplate.missing ).toEqual( [ MISSING_ANSWER ] );
		} );
	} );

	test.describe( 'graph route', () => {
		const ROUTE = '/schema-org-blocks/v1/graph';
		const padding = `<!-- wp:paragraph --><p>${ 'x'.repeat(
			25000
		) }</p><!-- /wp:paragraph -->`;

		test( 'takes content over 20,000 characters in a POST body', async ( {
			requestUtils,
		} ) => {
			const content = INCOMPLETE_FAQ + padding;
			expect( content.length ).toBeGreaterThan( 20000 );

			const result = await requestUtils.rest( {
				method: 'POST',
				path: ROUTE,
				data: { content },
			} );

			expect( result.source ).toBe( 'content' );
			expect( result.graph ).toContainEqual(
				expect.objectContaining( { '@type': 'FAQPage' } )
			);
			expect( result.missing ).toEqual( [ MISSING_ANSWER ] );
		} );

		test( 'refuses a request without edit rights', async ( {
			playwright,
			baseURL,
		} ) => {
			const anonymous = await playwright.request.newContext( {
				baseURL,
			} );
			const response = await anonymous.post( `/?rest_route=${ ROUTE }`, {
				data: { content: INCOMPLETE_FAQ, post_id: 1 },
			} );
			await anonymous.dispose();

			expect( response.status() ).toBe( 401 );
		} );
	} );

	test.describe( 'pre-publish panel', () => {
		const insertMarkup = ( page, markup ) =>
			page.evaluate( ( content ) => {
				window.wp.data
					.dispatch( 'core/block-editor' )
					.insertBlocks( window.wp.blocks.parse( content ) );
			}, markup );

		const openPublishPanel = async ( page ) => {
			await page
				.getByRole( 'region', { name: 'Editor top bar' } )
				.getByRole( 'button', { name: 'Publish', exact: true } )
				.click();
			return page.getByRole( 'region', { name: 'Editor publish' } );
		};

		test( 'lists the missing property and does not block publishing', async ( {
			page,
			newPost,
		} ) => {
			await newPost();
			await insertMarkup( page, INCOMPLETE_FAQ );

			const panel = await openPublishPanel( page );

			await expect(
				panel.getByRole( 'button', { name: 'Schema.org' } )
			).toBeVisible();
			await expect( panel ).toContainText(
				'Some structured data is incomplete.'
			);
			await expect( panel.getByRole( 'listitem' ) ).toHaveText( [
				'How long does delivery take? (Question): missing Accepted Answer',
			] );
			await expect(
				panel.getByRole( 'button', { name: 'Publish', exact: true } )
			).toBeEnabled();
		} );

		test( 'says everything is set for a complete FAQ', async ( {
			page,
			newPost,
		} ) => {
			await newPost();
			await insertMarkup( page, readPattern( 'faq' ) );

			const panel = await openPublishPanel( page );

			await expect( panel ).toContainText(
				'All required structured data is set.'
			);
			await expect( panel.getByRole( 'listitem' ) ).toHaveCount( 0 );
			await expect(
				panel.getByRole( 'button', { name: 'Publish', exact: true } )
			).toBeEnabled();
		} );
	} );
} );
