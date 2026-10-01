/**
 * E2E tests for schema that must only describe content the visitor can see:
 * hidden blocks, password-protected synced patterns, query loops and links.
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

// Serialized block markup with the given attributes and saved HTML.
const block = ( name, attrs, html ) => {
	const json = attrs ? ` ${ JSON.stringify( attrs ) }` : '';
	return `<!-- wp:${ name }${ json } -->${ html }<!-- /wp:${ name } -->`;
};

const group = ( attrs, inner ) =>
	block( 'group', attrs, `<div class="wp-block-group">${ inner }</div>` );

const paragraph = ( text, attrs ) =>
	block( 'paragraph', attrs, `<p>${ text }</p>` );

// A paragraph that gives its text to the parent as a property.
const property = ( propertyName, text, extra = {} ) =>
	paragraph( text, {
		schemaOrg: schemaOrg( { isProperty: true, propertyName } ),
		...extra,
	} );

const person = ( inner, extra = {} ) =>
	group( { schemaOrg: schemaOrg( { type: 'Person' } ), ...extra }, inner );

const hidden = { metadata: { blockVisibility: false } };

const graphOf = ( data ) => data?.[ '@graph' ] ?? [];

const ofType = ( data, type ) =>
	graphOf( data ).filter( ( node ) => node[ '@type' ] === type );

test.describe( 'Schema output for hidden and protected content', () => {
	test( 'a hidden typed group is left out of the graph', async ( {
		publishMarkupAndGetJsonLd,
	} ) => {
		const data = await publishMarkupAndGetJsonLd(
			person( property( 'name', 'Shown' ) ) +
				person( property( 'name', 'Hidden' ), hidden )
		);

		expect( ofType( data, 'Person' ) ).toEqual( [
			{ '@type': 'Person', name: 'Shown' },
		] );
	} );

	test( 'a hidden property child is left out of its parent', async ( {
		publishMarkupAndGetJsonLd,
	} ) => {
		const data = await publishMarkupAndGetJsonLd(
			person(
				property( 'name', 'Visible' ) +
					property( 'description', 'Hidden description', hidden )
			)
		);

		expect( ofType( data, 'Person' ) ).toEqual( [
			{ '@type': 'Person', name: 'Visible' },
		] );
	} );

	test( 'a hidden copy does not remove the same visible entity', async ( {
		publishMarkupAndGetJsonLd,
	} ) => {
		const data = await publishMarkupAndGetJsonLd(
			person( property( 'name', 'Twin' ) ) +
				group( hidden, person( property( 'name', 'Twin' ) ) )
		);

		expect( ofType( data, 'Person' ) ).toEqual( [
			{ '@type': 'Person', name: 'Twin' },
		] );
	} );

	test( 'a typed group inside a hidden plain group is left out', async ( {
		publishMarkupAndGetJsonLd,
	} ) => {
		const data = await publishMarkupAndGetJsonLd(
			group( hidden, person( property( 'name', 'Wrapped' ) ) )
		);

		expect( ofType( data, 'Person' ) ).toEqual( [] );
	} );

	test( 'a password-protected synced pattern gives no values', async ( {
		requestUtils,
		page,
		publishMarkupAndGetJsonLd,
	} ) => {
		const pattern = await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/blocks',
			data: {
				title: 'Protected pattern',
				status: 'publish',
				password: 'secret',
				content: property( 'name', 'Secret name' ),
			},
		} );
		const saved = await requestUtils.rest( {
			path: `/wp/v2/blocks/${ pattern.id }`,
			params: { context: 'edit' },
		} );
		expect( saved.password ).toBe( 'secret' );

		await publishMarkupAndGetJsonLd(
			person(
				property( 'description', 'Public description' ) +
					`<!-- wp:block {"ref":${ pattern.id }} /-->`
			)
		);

		const script = page.locator(
			'head script[type="application/ld+json"]'
		);
		await expect( script ).toBeAttached();
		const json = await script.textContent();
		expect( json ).toContain( 'Public description' );
		expect( json ).not.toContain( 'Secret name' );
	} );

	test( 'a full post in a query loop is only described on its own page', async ( {
		requestUtils,
		page,
		getJsonLd,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Loop test',
			content: person( property( 'name', 'Loop person' ) ),
			status: 'publish',
		} );

		// Twenty Twenty-Five's home template shows the full content of
		// each post in its query loop.
		await page.goto( '/' );
		await expect( page.locator( 'main' ) ).toContainText( 'Loop person' );
		expect(
			ofType( await getJsonLd(), 'Person' ).filter(
				( node ) => node.name === 'Loop person'
			)
		).toEqual( [] );

		await page.goto( `/?p=${ post.id }` );
		expect( ofType( await getJsonLd(), 'Person' ) ).toContainEqual( {
			'@type': 'Person',
			name: 'Loop person',
		} );
	} );

	test( 'image url comes from its link, not from a link in its caption', async ( {
		newPost,
		editor,
		publishAndGetJsonLd,
	} ) => {
		await newPost();

		const imageObject = schemaOrg( {
			type: 'ImageObject',
			isProperty: true,
			propertyName: 'image',
			mappings: {
				contentUrl: { source: 'attribute', attributeName: 'url' },
				url: { source: 'attribute', attributeName: 'href' },
			},
		} );

		await editor.insertBlock( {
			name: 'core/group',
			attributes: { schemaOrg: schemaOrg( { type: 'Article' } ) },
			innerBlocks: [
				{
					name: 'core/image',
					attributes: {
						url: 'https://example.com/a.jpg',
						href: 'https://example.com/target',
						linkDestination: 'custom',
						schemaOrg: imageObject,
					},
				},
				{
					name: 'core/image',
					attributes: {
						url: 'https://example.com/b.jpg',
						caption:
							'See <a href="https://example.com/caption">this</a>',
						schemaOrg: imageObject,
					},
				},
			],
		} );

		const data = await publishAndGetJsonLd();
		const [ article ] = ofType( data, 'Article' );

		expect( article.image ).toEqual( [
			{
				'@type': 'ImageObject',
				contentUrl: 'https://example.com/a.jpg',
				url: 'https://example.com/target',
			},
			{
				'@type': 'ImageObject',
				contentUrl: 'https://example.com/b.jpg',
			},
		] );
	} );
} );
