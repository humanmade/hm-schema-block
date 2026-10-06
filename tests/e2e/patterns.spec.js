/**
 * E2E tests for the Schema.org block patterns and the FSE blocks they use: the markup is
 * valid in the editor, the front end outputs the expected graph, and Quick setup and smart
 * defaults configure template blocks.
 *
 * @package
 */

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { test, expect } = require( './fixtures' );

const PATTERNS_DIR = path.join( process.cwd(), 'patterns' );

// A 1x1 PNG, used as the featured image and the site logo.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

const readPattern = ( slug ) =>
	fs.readFileSync( path.join( PATTERNS_DIR, `${ slug }.html` ), 'utf8' );

const SLUGS = fs
	.readdirSync( PATTERNS_DIR )
	.filter( ( file ) => file.endsWith( '.html' ) )
	.map( ( file ) => file.replace( /\.html$/, '' ) );

const graphOf = ( data ) => data?.[ '@graph' ] ?? [];

const ofType = ( data, type ) =>
	graphOf( data ).filter( ( node ) => node[ '@type' ] === type );

const property = ( propertyName ) => ( {
	type: null,
	isProperty: true,
	propertyName,
	mappings: {},
} );

// Names of blocks in the editor that failed validation, at any depth.
async function getInvalidBlocks( page ) {
	await expect
		.poll( () =>
			page.evaluate(
				() =>
					window.wp.data.select( 'core/block-editor' ).getBlocks()
						.length
			)
		)
		.toBeGreaterThan( 0 );

	return page.evaluate( () => {
		const walk = ( blocks ) =>
			blocks.flatMap( ( block ) => [
				...( block.isValid === false ? [ block.name ] : [] ),
				...walk( block.innerBlocks ),
			] );
		return walk( window.wp.data.select( 'core/block-editor' ).getBlocks() );
	} );
}

// Parses the JSON-LD in <head> of a URL, or returns null.
async function getJsonLdAt( page, url ) {
	await page.goto( url );
	const script = page.locator( 'head script[type="application/ld+json"]' );
	if ( ( await script.count() ) === 0 ) {
		return null;
	}
	return JSON.parse( await script.textContent() );
}

// What the site looks like to the patterns: set up once for the whole file.
const site = {};

test.describe( 'Schema.org patterns', () => {
	test.beforeAll( async ( { requestUtils }, testInfo ) => {
		await requestUtils.deleteAllPosts();

		const settings = await requestUtils.rest( {
			path: '/wp/v2/settings',
		} );
		site.title = settings.title;
		site.description = settings.description;
		site.home = settings.url.replace( /\/$/, '' ) + '/';
		site.originalLogo = settings.site_logo ?? 0;

		const user = await requestUtils.rest( { path: '/wp/v2/users/me' } );
		site.author = user.name;

		const imagePath = testInfo.outputPath( 'schema-pattern.png' );
		fs.writeFileSync( imagePath, PNG );
		site.image = await requestUtils.uploadMedia( imagePath );

		site.category = await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/categories',
			data: { name: `Gardening ${ Date.now() }` },
		} );

		await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/settings',
			data: { site_logo: site.image.id },
		} );

		site.posts = [];
		for ( const title of [ 'Spring planting', 'Pruning roses' ] ) {
			site.posts.push(
				await requestUtils.createPost( {
					title,
					content:
						'<!-- wp:paragraph --><p>Some tips.</p><!-- /wp:paragraph -->',
					status: 'publish',
				} )
			);
		}
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/settings',
			data: { site_logo: site.originalLogo },
		} );
		await requestUtils.deleteAllPosts();
		if ( site.image ) {
			await requestUtils.deleteMedia( site.image.id );
		}
		if ( site.category ) {
			await requestUtils.rest( {
				method: 'DELETE',
				path: `/wp/v2/categories/${ site.category.id }`,
				params: { force: true },
			} );
		}
	} );

	test( 'registers every pattern in the Schema.org category', async ( {
		requestUtils,
	} ) => {
		const categories = await requestUtils.rest( {
			path: '/wp/v2/block-patterns/categories',
		} );
		expect( categories ).toContainEqual(
			expect.objectContaining( {
				name: 'schema-org-blocks',
				label: 'Schema.org',
			} )
		);

		const patterns = await requestUtils.rest( {
			path: '/wp/v2/block-patterns/patterns',
		} );
		const ours = patterns.filter( ( pattern ) =>
			pattern.name.startsWith( 'schema-org-blocks/' )
		);

		expect( ours.map( ( pattern ) => pattern.name ).sort() ).toEqual(
			SLUGS.map( ( slug ) => `schema-org-blocks/${ slug }` ).sort()
		);
		// The registry re-serializes the markup, which turns empty objects into empty arrays.
		const normalize = ( markup ) => markup.trim().replace( /\{\}/g, '[]' );
		for ( const pattern of ours ) {
			expect( pattern.categories ).toEqual( [ 'schema-org-blocks' ] );
			expect( normalize( pattern.content ) ).toBe(
				normalize(
					readPattern(
						pattern.name.replace( 'schema-org-blocks/', '' )
					)
				)
			);
		}
		expect(
			ours.find( ( p ) => p.name === 'schema-org-blocks/blog-list' )
				.block_types
		).toEqual( [ 'core/query' ] );
		expect(
			ours.find( ( p ) => p.name === 'schema-org-blocks/article-header' )
				.template_types
		).toEqual( [ 'single' ] );
	} );

	const faqQuestions = [
		'How long does delivery take?',
		'Can I return an item?',
		'Do you ship abroad?',
	];

	const expectFaq = ( data ) => {
		const [ faq ] = ofType( data, 'FAQPage' );
		expect( faq.mainEntity ).toHaveLength( 3 );
		expect( faq.mainEntity.map( ( q ) => q.name ) ).toEqual( faqQuestions );
		for ( const question of faq.mainEntity ) {
			expect( question ).toEqual( {
				'@type': 'Question',
				name: expect.any( String ),
				acceptedAnswer: {
					'@type': 'Answer',
					text: expect.stringMatching( /\S/ ),
				},
			} );
		}
		expect( faq.mainEntity[ 0 ].acceptedAnswer.text ).toContain(
			'our tracking page'
		);
		expect( faq.mainEntity[ 0 ].acceptedAnswer.text ).not.toContain( '<a' );
	};

	const expectPostItem = ( item ) => {
		const post = [ ...site.posts, site.current ].find(
			( p ) => p.link === item.url
		);
		expect( post ).toBeTruthy();
		expect( item ).toMatchObject( {
			'@type': 'BlogPosting',
			url: post.link,
			headline: post.title.raw,
			datePublished: expect.stringMatching( ISO_DATE ),
		} );
	};

	// Slug => post to create and checks on the JSON-LD of its page.
	const CASES = {
		faq: { check: expectFaq },
		'faq-details': { check: expectFaq },
		'how-to': {
			title: 'Plant a shrub',
			check: ( data ) => {
				const [ howTo ] = ofType( data, 'HowTo' );
				expect( howTo.name ).toBe( 'Plant a shrub' );
				expect( howTo.step ).toHaveLength( 3 );
				expect( howTo.step[ 0 ] ).toEqual( {
					'@type': 'HowToStep',
					name: 'Gather your tools',
					text: 'You need a trowel, a watering can and some compost.',
				} );
				for ( const step of howTo.step ) {
					expect( step[ '@type' ] ).toBe( 'HowToStep' );
					expect( step.name ).toMatch( /\S/ );
					expect( step.text ).toMatch( /\S/ );
				}
			},
		},
		'article-header': {
			title: 'Planting season',
			extra: () => ( {
				categories: [ site.category.id ],
				featured_media: site.image.id,
			} ),
			check: ( data, post ) => {
				const [ article ] = ofType( data, 'Article' );
				expect( article ).toEqual( {
					'@type': 'Article',
					url: post.link,
					publisher: { '@id': `${ site.home }#organization` },
					keywords: site.category.name,
					headline: 'Planting season',
					author: {
						'@type': 'Person',
						'@id': expect.stringMatching(
							/#\/schema\/person\/[a-f0-9]+$/
						),
						name: site.author,
						url: expect.stringMatching( /^https?:\/\// ),
					},
					datePublished: expect.stringMatching( ISO_DATE ),
					image: site.image.source_url,
				} );
			},
		},
		'site-header-organization': {
			check: ( data ) => {
				const [ organization ] = ofType( data, 'Organization' );
				expect( organization ).toEqual( {
					'@id': `${ site.home }#organization`,
					'@type': 'Organization',
					url: site.home,
					logo: site.image.source_url,
					name: site.title,
					...( site.description
						? { description: site.description }
						: {} ),
				} );
			},
		},
		'blog-list': {
			title: 'Our blog',
			check: ( data ) => {
				const [ blog ] = ofType( data, 'Blog' );
				const headlines = blog.blogPost.map(
					( item ) => item.headline
				);
				expect( headlines.sort() ).toEqual(
					[ 'Our blog', 'Pruning roses', 'Spring planting' ].sort()
				);
				blog.blogPost.forEach( expectPostItem );
			},
		},
		'item-list': {
			title: 'Latest posts',
			check: ( data ) => {
				const [ list ] = ofType( data, 'ItemList' );
				expect( list.itemListElement ).toHaveLength( 3 );
				list.itemListElement.forEach( ( listItem, index ) => {
					expect( listItem ).toMatchObject( {
						'@type': 'ListItem',
						position: index + 1,
					} );
					expectPostItem( listItem.item );
				} );
			},
		},
	};

	for ( const slug of SLUGS ) {
		test( `${ slug } pattern is valid and outputs its schema`, async ( {
			admin,
			page,
			requestUtils,
		} ) => {
			const { title = 'Pattern test', extra, check } = CASES[ slug ];

			const post = await requestUtils.createPost( {
				title,
				content: readPattern( slug ),
				status: 'publish',
				...( extra ? extra() : {} ),
			} );
			site.current = post;

			// Removed afterwards, so the list patterns only show their own post and site.posts.
			try {
				await admin.editPost( post.id );
				expect( await getInvalidBlocks( page ) ).toEqual( [] );

				const data = await getJsonLdAt( page, post.link );
				check( data, post );
			} finally {
				await requestUtils.rest( {
					method: 'DELETE',
					path: `/wp/v2/posts/${ post.id }`,
					params: { force: true },
				} );
			}
		} );
	}

	test( 'FAQ pattern inserted from the registry outputs its schema', async ( {
		newPost,
		page,
		requestUtils,
		publishAndGetJsonLd,
	} ) => {
		const patterns = await requestUtils.rest( {
			path: '/wp/v2/block-patterns/patterns',
		} );
		const { content } = patterns.find(
			( pattern ) => pattern.name === 'schema-org-blocks/faq'
		);

		await newPost();
		await page.evaluate( ( markup ) => {
			const { dispatch } = window.wp.data;
			dispatch( 'core/block-editor' ).insertBlocks(
				window.wp.blocks.parse( markup )
			);
		}, content );
		expect( await getInvalidBlocks( page ) ).toEqual( [] );

		expectFaq( await publishAndGetJsonLd() );
	} );

	test( 'Modified Date block gives the modified date', async ( {
		page,
		requestUtils,
	} ) => {
		const modifiedDate = ( schemaOrg ) =>
			`<!-- wp:post-date ${ JSON.stringify( {
				metadata: {
					bindings: {
						datetime: {
							source: 'core/post-data',
							args: { field: 'modified' },
						},
					},
				},
				className: 'wp-block-post-date__modified-date',
				schemaOrg,
			} ) } /-->`;
		const post = await requestUtils.createPost( {
			title: 'Old post',
			date: '2020-01-01T10:00:00',
			status: 'publish',
			content: `<!-- wp:group {"schemaOrg":{"type":"Article","mappings":{},"isProperty":false,"propertyName":null}} --><div class="wp-block-group">${ modifiedDate(
				property( 'dateModified' )
			) }</div><!-- /wp:group -->`,
		} );

		try {
			// A new post's modified date starts as its publish date; editing it moves it on.
			await requestUtils.rest( {
				method: 'POST',
				path: `/wp/v2/posts/${ post.id }`,
				data: { title: 'Old post, updated' },
			} );

			const [ article ] = ofType(
				await getJsonLdAt( page, post.link ),
				'Article'
			);
			expect( article.dateModified ).not.toMatch( /^2020-01-01/ );
		} finally {
			await requestUtils.rest( {
				method: 'DELETE',
				path: `/wp/v2/posts/${ post.id }`,
				params: { force: true },
			} );
		}
	} );

	test( 'article header and organization in block templates build a linked graph', async ( {
		page,
		requestUtils,
	}, testInfo ) => {
		const post = await requestUtils.createPost( {
			title: 'A plain post',
			content:
				'<!-- wp:paragraph --><p>No schema here.</p><!-- /wp:paragraph -->',
			status: 'publish',
		} );

		try {
			await requestUtils.rest( {
				method: 'POST',
				path: '/wp/v2/templates/twentytwentyfive//single',
				data: {
					content: [
						'<!-- wp:template-part {"slug":"header","tagName":"header"} /-->',
						readPattern( 'article-header' ),
						'<!-- wp:post-content {"layout":{"type":"constrained"}} /-->',
						'<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->',
					].join( '\n\n' ),
				},
			} );
			await requestUtils.rest( {
				method: 'POST',
				path: '/wp/v2/template-parts/twentytwentyfive//header',
				data: { content: readPattern( 'site-header-organization' ) },
			} );

			const data = await getJsonLdAt( page, post.link );
			await testInfo.attach( 'json-ld', {
				body: JSON.stringify( data, null, 2 ),
				contentType: 'application/json',
			} );

			const organizationId = `${ site.home }#organization`;
			const [ organization ] = ofType( data, 'Organization' );
			expect( organization ).toMatchObject( {
				'@id': organizationId,
				name: site.title,
				url: site.home,
				logo: site.image.source_url,
			} );

			const [ article ] = ofType( data, 'Article' );
			expect( article ).toMatchObject( {
				url: post.link,
				headline: 'A plain post',
				publisher: { '@id': organizationId },
				author: { '@type': 'Person', name: site.author },
				datePublished: expect.stringMatching( ISO_DATE ),
			} );
		} finally {
			for ( const route of [
				'/wp/v2/templates/twentytwentyfive//single',
				'/wp/v2/template-parts/twentytwentyfive//header',
			] ) {
				await requestUtils
					.rest( {
						method: 'DELETE',
						path: route,
						params: { force: true },
					} )
					.catch( () => {} );
			}
		}

		// The theme's own templates are back.
		const template = await requestUtils.rest( {
			path: '/wp/v2/templates/twentytwentyfive//single',
		} );
		expect( template.source ).toBe( 'theme' );
		const header = await requestUtils.rest( {
			path: '/wp/v2/template-parts/twentytwentyfive//header',
		} );
		expect( header.source ).toBe( 'theme' );
	} );
} );

test.describe( 'Smart defaults for FSE blocks', () => {
	test.beforeEach( async ( { newPost } ) => {
		await newPost();
	} );

	test( 'a heading in columns inside an Article group becomes the headline', async ( {
		insertBlock,
		getSchemaTree,
	} ) => {
		const groupId = await insertBlock( {
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
					name: 'core/columns',
					innerBlocks: [
						{ name: 'core/column' },
						{ name: 'core/column' },
					],
				},
			],
		} );
		const group = await getSchemaTree( groupId );
		const columnId = group.innerBlocks[ 0 ].innerBlocks[ 0 ].clientId;

		const headingId = await insertBlock(
			{ name: 'core/heading', attributes: { content: 'Hello' } },
			columnId
		);

		await expect
			.poll( async () => ( await getSchemaTree( headingId ) ).schemaOrg )
			.toEqual( property( 'headline' ) );
	} );

	test( 'a heading in a details block inside an Article group becomes the headline', async ( {
		insertBlock,
		getSchemaTree,
	} ) => {
		const groupId = await insertBlock( {
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
				{ name: 'core/details', attributes: { summary: 'More' } },
			],
		} );
		const group = await getSchemaTree( groupId );
		const detailsId = group.innerBlocks[ 0 ].clientId;

		const headingId = await insertBlock(
			{ name: 'core/heading', attributes: { content: 'Hello' } },
			detailsId
		);

		await expect
			.poll( async () => ( await getSchemaTree( headingId ) ).schemaOrg )
			.toEqual( property( 'headline' ) );
	} );

	test( 'changing the type keeps the Organization id only for subtypes', async ( {
		editor,
		schemaPanel,
		getSchemaTree,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			innerBlocks: [ { name: 'core/site-title' } ],
		} );
		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/group"]' ).first()
		);
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'Organization', exact: true } )
			.click();

		await schemaPanel.setType( 'LocalBusiness' );
		expect( ( await getSchemaTree() )[ 0 ].schemaOrg ).toMatchObject( {
			type: 'LocalBusiness',
			id: 'organization',
		} );

		await schemaPanel.setType( 'Article' );
		const [ group ] = await getSchemaTree();
		expect( group.schemaOrg.type ).toBe( 'Article' );
		expect( group.schemaOrg.id ).toBeUndefined();
	} );

	test( 'Quick setup Organization maps site title and logo', async ( {
		editor,
		schemaPanel,
		getSchemaTree,
	} ) => {
		await editor.insertBlock( {
			name: 'core/group',
			innerBlocks: [
				{ name: 'core/site-logo' },
				{
					name: 'core/group',
					innerBlocks: [ { name: 'core/site-title' } ],
				},
			],
		} );
		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/group"]' ).first()
		);
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'Organization', exact: true } )
			.click();

		const [ group ] = await getSchemaTree();
		expect( group.schemaOrg ).toEqual( {
			type: 'Organization',
			id: 'organization',
			mappings: { url: { source: 'site', field: 'url' } },
			isProperty: false,
			propertyName: null,
		} );
		const [ logo, inner ] = group.innerBlocks;
		expect( logo.schemaOrg ).toEqual( property( 'logo' ) );
		expect( inner.innerBlocks[ 0 ].schemaOrg ).toEqual(
			property( 'name' )
		);
	} );

	test( 'Quick setup Blog maps the post template and its post title', async ( {
		editor,
		schemaPanel,
		getSchemaTree,
	} ) => {
		await editor.insertBlock( {
			name: 'core/query',
			attributes: {
				query: {
					perPage: 3,
					pages: 0,
					offset: 0,
					postType: 'post',
					order: 'desc',
					orderBy: 'date',
					inherit: false,
				},
			},
			innerBlocks: [
				{
					name: 'core/post-template',
					innerBlocks: [ { name: 'core/post-title' } ],
				},
			],
		} );
		await editor.selectBlocks(
			editor.canvas.locator( '[data-type="core/query"]' )
		);
		await schemaPanel.open();
		await schemaPanel.sidebar
			.getByRole( 'button', { name: 'Blog', exact: true } )
			.click();

		const [ query ] = await getSchemaTree();
		expect( query.schemaOrg.type ).toBe( 'Blog' );
		const [ template ] = query.innerBlocks;
		expect( template.schemaOrg ).toEqual( {
			type: 'BlogPosting',
			isProperty: true,
			propertyName: 'blogPost',
			mappings: {},
		} );
		expect( template.innerBlocks[ 0 ].schemaOrg ).toEqual(
			property( 'headline' )
		);
	} );
} );
