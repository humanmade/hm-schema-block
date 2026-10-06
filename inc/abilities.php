<?php
/**
 * Read-only abilities that let agents read the structured data guide, the supported schema.org
 * types and the schema graph of a page.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\Abilities;

use SchemaOrgBlocks\BlockExtensions;
use SchemaOrgBlocks\BlockValues;
use SchemaOrgBlocks\Patterns;
use SchemaOrgBlocks\SchemaOutput;
use SchemaOrgBlocks\SchemaTypes;
use WP_Block_Template;
use WP_Error;
use WP_HTML_Tag_Processor;
use WP_Post;

/**
 * Ability category slug.
 */
const CATEGORY = 'schema-org-blocks';

/**
 * Register hooks.
 */
function bootstrap() : void {
	add_action( 'wp_abilities_api_categories_init', __NAMESPACE__ . '\\register_category' );
	add_action( 'wp_abilities_api_init', __NAMESPACE__ . '\\register_abilities' );
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_graph_route' );
}

/**
 * Register the ability category.
 */
function register_category() : void {
	wp_register_ability_category(
		CATEGORY,
		[
			'label'       => __( 'Schema.org Blocks', 'schema-org-blocks' ),
			'description' => __( 'Structured data from block markup.', 'schema-org-blocks' ),
		]
	);
}

/**
 * Get the meta shared by all abilities: exposed in REST and MCP, and read-only.
 *
 * @return array<string, mixed>
 */
function get_meta() : array {
	return [
		'show_in_rest' => true,
		'mcp'          => [
			'public' => true,
			'type'   => 'tool',
		],
		'annotations'  => [
			'readonly'    => true,
			'destructive' => false,
			'idempotent'  => true,
		],
	];
}

/**
 * Register the abilities.
 */
function register_abilities() : void {
	wp_register_ability(
		'schema-org-blocks/get-guidance',
		[
			'label'               => __( 'Get structured data guide', 'schema-org-blocks' ),
			'description'         => __( 'Read this first when adding or checking schema.org structured data (JSON-LD) on this site. Returns how to annotate blocks in posts, patterns and templates with the schemaOrg attribute, and example block markup for FAQ, how-to, article, organization and post list patterns.', 'schema-org-blocks' ),
			'category'            => CATEGORY,
			'execute_callback'    => __NAMESPACE__ . '\\get_guidance',
			'permission_callback' => __NAMESPACE__ . '\\can_edit_posts',
			'input_schema'        => [
				'type'                 => 'object',
				'default'              => [],
				'properties'           => [],
				'additionalProperties' => false,
			],
			'output_schema'       => [
				'type'       => 'object',
				'properties' => [
					'guide'    => [
						'type'        => 'string',
						'description' => __( 'The guide, in Markdown.', 'schema-org-blocks' ),
					],
					'patterns' => [
						'type'        => 'array',
						'description' => __( 'Example block markup with schema.org mappings.', 'schema-org-blocks' ),
						'items'       => [
							'type'       => 'object',
							'properties' => [
								'name'        => [ 'type' => 'string' ],
								'title'       => [ 'type' => 'string' ],
								'description' => [ 'type' => 'string' ],
								'content'     => [
									'type'        => 'string',
									'description' => __( 'Block markup.', 'schema-org-blocks' ),
								],
							],
						],
					],
				],
			],
			'meta'                => get_meta(),
		]
	);

	wp_register_ability(
		'schema-org-blocks/get-schema-types',
		[
			'label'               => __( 'Get schema.org types', 'schema-org-blocks' ),
			'description'         => __( 'Lists the schema.org types blocks can be mapped to on this site, with each type\'s parent and properties (including inherited ones). Pass a type to get just that type and its subtypes.', 'schema-org-blocks' ),
			'category'            => CATEGORY,
			'execute_callback'    => __NAMESPACE__ . '\\get_schema_types',
			'permission_callback' => __NAMESPACE__ . '\\can_edit_posts',
			'input_schema'        => [
				'type'                 => 'object',
				'default'              => [],
				'properties'           => [
					'type' => [
						'type'        => 'string',
						'description' => __( 'A schema.org type name, such as Article.', 'schema-org-blocks' ),
					],
				],
				'additionalProperties' => false,
			],
			'output_schema'       => [
				'type'       => 'object',
				'properties' => [
					'types' => [
						'type'  => 'array',
						'items' => [
							'type'       => 'object',
							'properties' => [
								'name'       => [ 'type' => 'string' ],
								'label'      => [ 'type' => 'string' ],
								'parent'     => [ 'type' => [ 'string', 'null' ] ],
								'properties' => [
									'type'        => 'object',
									'description' => __( 'Properties by name, with their accepted types. Only returned when a type is passed.', 'schema-org-blocks' ),
								],
								'subtypes'   => [
									'type'        => 'array',
									'description' => __( 'Names of the types below this one. Only returned when a type is passed.', 'schema-org-blocks' ),
									'items'       => [ 'type' => 'string' ],
								],
							],
						],
					],
				],
			],
			'meta'                => get_meta(),
		]
	);

	wp_register_ability(
		'schema-org-blocks/get-schema-graph',
		[
			'label'               => __( 'Get structured data graph', 'schema-org-blocks' ),
			'description'         => __( 'Returns the schema.org JSON-LD graph for a page, to check structured data after editing. Pass the url or post_id of a published page to read what the page outputs, including the template. For a draft, or block markup passed as content, the graph is built from those blocks only and leaves out template entities such as a typed template block, unless with_template is set. With a post_id it is joined into one WebPage node for the post. Every result has a missing list: required properties, such as an Article\'s author or a Question\'s accepted answer, that no node sets.', 'schema-org-blocks' ),
			'category'            => CATEGORY,
			'execute_callback'    => __NAMESPACE__ . '\\get_schema_graph',
			'permission_callback' => __NAMESPACE__ . '\\can_get_schema_graph',
			'input_schema'        => [
				'type'                 => 'object',
				'default'              => [],
				'properties'           => [
					'url'           => [
						'type'        => 'string',
						'format'      => 'uri',
						'description' => __( 'URL of a page on this site.', 'schema-org-blocks' ),
					],
					'post_id'       => [
						'type'        => 'integer',
						'description' => __( 'ID of a post. With content, the post that post fields read from.', 'schema-org-blocks' ),
					],
					'content'       => [
						'type'        => 'string',
						'description' => __( 'Block markup to build the graph from.', 'schema-org-blocks' ),
					],
					'with_template' => [
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'With content and post_id in a block theme, build the graph from the post\'s block template, with the content standing in for the post content, so template entities are included.', 'schema-org-blocks' ),
					],
				],
				'additionalProperties' => false,
			],
			'output_schema'       => [
				'type'       => 'object',
				'properties' => [
					'source'  => [
						'type'        => 'string',
						'enum'        => [ 'page', 'content' ],
						'description' => __( 'Whether the graph was read from the rendered page or built from blocks.', 'schema-org-blocks' ),
					],
					'url'     => [ 'type' => 'string' ],
					'post_id' => [ 'type' => 'integer' ],
					'note'    => [ 'type' => 'string' ],
					'graph'   => [
						'type'  => 'array',
						'items' => [ 'type' => 'object' ],
					],
					'missing' => [
						'type'        => 'array',
						'description' => __( 'Required properties the graph does not set. A property that is a list means one of them is needed.', 'schema-org-blocks' ),
						'items'       => [
							'type'       => 'object',
							'properties' => [
								'type'     => [ 'type' => 'string' ],
								'property' => [ 'type' => [ 'string', 'array' ] ],
								'label'    => [ 'type' => 'string' ],
							],
						],
					],
				],
			],
			'meta'                => get_meta(),
		]
	);
}

/**
 * Register the REST route the editor uses to check the graph of unsaved content.
 *
 * The get-schema-graph ability only accepts GET, which puts the content in the URL. This route
 * takes the same input as a POST body.
 */
function register_graph_route() : void {
	register_rest_route(
		'schema-org-blocks/v1',
		'/graph',
		[
			'methods'             => 'POST',
			'callback'            => __NAMESPACE__ . '\\get_graph_for_request',
			'permission_callback' => static fn ( $request ) => can_get_schema_graph( get_request_input( $request ) ),
			'args'                => [
				'content'       => [
					'type'        => 'string',
					'description' => __( 'Block markup to build the graph from.', 'schema-org-blocks' ),
				],
				'post_id'       => [
					'type'        => 'integer',
					'description' => __( 'ID of a post. With content, the post that post fields read from.', 'schema-org-blocks' ),
				],
				'with_template' => [
					'type'        => 'boolean',
					'default'     => false,
					'description' => __( 'With content and post_id in a block theme, build the graph from the post\'s block template.', 'schema-org-blocks' ),
				],
			],
		]
	);
}

/**
 * Get the ability input from the parameters of a request.
 *
 * @param \WP_REST_Request $request Request.
 * @return array<string, mixed>
 */
function get_request_input( $request ) : array {
	$input = [];

	foreach ( [ 'content', 'post_id', 'with_template' ] as $key ) {
		$value = $request->get_param( $key );

		if ( null !== $value ) {
			$input[ $key ] = $value;
		}
	}

	return $input;
}

/**
 * Get the schema graph for a REST request.
 *
 * @param \WP_REST_Request $request Request.
 * @return array<string, mixed>|WP_Error
 */
function get_graph_for_request( $request ) {
	return get_schema_graph( get_request_input( $request ) );
}

/**
 * Whether the current user can edit posts.
 *
 * @return bool
 */
function can_edit_posts() : bool {
	return current_user_can( 'edit_posts' );
}

/**
 * Whether the current user can read the graph for the given input.
 *
 * @param mixed $input Ability input.
 * @return bool
 */
function can_get_schema_graph( $input = null ) : bool {
	if ( is_array( $input ) && isset( $input['post_id'] ) ) {
		return current_user_can( 'edit_post', (int) $input['post_id'] );
	}

	return current_user_can( 'edit_posts' );
}

/**
 * Get the structured data guide and the example patterns.
 *
 * @return array<string, mixed>|WP_Error
 */
function get_guidance() {
	$file = SCHEMA_ORG_BLOCKS_PATH . '/skills/schema-org-blocks/SKILL.md';

	if ( ! is_readable( $file ) ) {
		return new WP_Error( 'schema_org_blocks_guide_missing', __( 'The guide could not be read.', 'schema-org-blocks' ), [ 'status' => 500 ] );
	}

	$guide = (string) file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
	$guide = trim( (string) preg_replace( '/\A---\R.*?\R---\R/s', '', $guide, 1 ) );

	$patterns = [];
	foreach ( Patterns\get_patterns() as $slug => $pattern ) {
		$content = Patterns\get_pattern_content( $slug );

		if ( null === $content ) {
			continue;
		}

		$patterns[] = [
			'name'        => 'schema-org-blocks/' . $slug,
			'title'       => $pattern['title'],
			'description' => $pattern['description'],
			'content'     => $content,
		];
	}

	return [
		'guide'    => $guide,
		'patterns' => $patterns,
	];
}

/**
 * List the schema.org types, or one type with its properties and subtypes.
 *
 * @param mixed $input Ability input.
 * @return array<string, mixed>|WP_Error
 */
function get_schema_types( $input = null ) {
	$all   = SchemaTypes\get_schema_types();
	$input = is_array( $input ) ? $input : [];
	$type  = isset( $input['type'] ) && is_string( $input['type'] ) ? $input['type'] : '';

	if ( '' === $type ) {
		$types = [];
		foreach ( $all as $name => $data ) {
			$types[] = [
				'name'   => $name,
				'label'  => $data['label'] ?? $name,
				'parent' => $data['parent'] ?? null,
			];
		}

		return [ 'types' => $types ];
	}

	if ( ! isset( $all[ $type ] ) ) {
		/* translators: %s: schema.org type name. */
		return new WP_Error( 'schema_org_blocks_unknown_type', sprintf( __( 'The type "%s" is not supported.', 'schema-org-blocks' ), $type ), [ 'status' => 400 ] );
	}

	$subtypes = [];
	foreach ( array_keys( $all ) as $name ) {
		if ( SchemaTypes\is_subtype_of( $name, $type ) ) {
			$subtypes[] = $name;
		}
	}

	$properties = SchemaTypes\get_type_properties( $type );

	return [
		'types' => [
			[
				'name'       => $type,
				'label'      => $all[ $type ]['label'] ?? $type,
				'parent'     => $all[ $type ]['parent'] ?? null,
				'properties' => $properties ? $properties : (object) [],
				'subtypes'   => $subtypes,
			],
		],
	];
}

/**
 * Get the schema graph of a page, or build it from blocks.
 *
 * @param mixed $input Ability input.
 * @return array<string, mixed>|WP_Error
 */
function get_schema_graph( $input = null ) {
	$input   = is_array( $input ) ? $input : [];
	$url     = $input['url'] ?? null;
	$post_id = $input['post_id'] ?? null;
	$content = $input['content'] ?? null;

	$valid = ( null !== $url && null === $post_id && null === $content )
		|| ( null === $url && null !== $post_id && null === $content )
		|| ( null === $url && null !== $content );

	if ( ! $valid ) {
		return new WP_Error( 'schema_org_blocks_invalid_input', __( 'Pass one of url, post_id, content, or content with post_id.', 'schema-org-blocks' ), [ 'status' => 400 ] );
	}

	$context = [];

	if ( null !== $post_id ) {
		$context = [ 'postId' => (int) $post_id ];
	}

	if ( null !== $post_id && null === $content ) {
		$post = get_post( (int) $post_id );

		if ( ! $post instanceof WP_Post ) {
			return new WP_Error( 'schema_org_blocks_post_not_found', __( 'The post was not found.', 'schema-org-blocks' ), [ 'status' => 404 ] );
		}

		if ( is_post_publicly_viewable( $post ) && ! post_password_required( $post ) ) {
			$url = get_permalink( $post );
		} else {
			$content = $post->post_content;
		}
	}

	if ( null !== $url ) {
		$result = get_page_graph( (string) $url );

		if ( null !== $post_id && is_array( $result ) ) {
			$result['post_id'] = (int) $post_id;
		}

		return $result;
	}

	$blocks   = parse_blocks( (string) $content );
	$template = $post_id && rest_sanitize_boolean( $input['with_template'] ?? false ) ? get_post_template( (int) $post_id ) : null;

	if ( $template ) {
		BlockValues\set_post_content_blocks( (int) $post_id, $blocks );
		$blocks = parse_blocks( (string) $template->content );
	}

	$objects = [];
	foreach ( BlockExtensions\extract_schema( $blocks, $context ) as $object ) {
		$objects[ md5( (string) wp_json_encode( $object ) ) ] = $object;
	}

	if ( $template ) {
		$note = __( 'Built from the given blocks inside the post\'s block template, joined into one WebPage node for the post.', 'schema-org-blocks' );
	} elseif ( $post_id ) {
		$note = __( 'Built from the given blocks only, joined into one WebPage node for the post. Entities from the template, such as a typed template block, are not included.', 'schema-org-blocks' );
	} else {
		$note = __( 'Built from the given blocks only. Entities from the template, such as the site Organization or a WebPage around the post, are not included.', 'schema-org-blocks' );
	}

	$graph  = SchemaOutput\build_graph( array_values( $objects ), (int) $post_id );
	$result = [
		'source'  => 'content',
		'graph'   => $graph,
		'missing' => SchemaOutput\get_missing( $graph ),
		'note'    => $note,
	];

	if ( null !== $post_id ) {
		$result['post_id'] = (int) $post_id;
	}

	return $result;
}

/**
 * Read the JSON-LD graph a page of this site outputs.
 *
 * @param string $url Page URL.
 * @return array<string, mixed>|WP_Error
 */
function get_page_graph( string $url ) {
	$host = wp_parse_url( $url, PHP_URL_HOST );

	if ( ! $host || wp_parse_url( home_url(), PHP_URL_HOST ) !== $host ) {
		return new WP_Error( 'schema_org_blocks_external_url', __( 'Only pages on this site can be read.', 'schema-org-blocks' ), [ 'status' => 400 ] );
	}

	$response = wp_safe_remote_get( $url, [ 'timeout' => 10 ] );

	if ( is_wp_error( $response ) ) {
		/* translators: %s: error message. */
		return new WP_Error( 'schema_org_blocks_fetch_failed', sprintf( __( 'The page could not be fetched: %s', 'schema-org-blocks' ), $response->get_error_message() ), [ 'status' => 502 ] );
	}

	$status = (int) wp_remote_retrieve_response_code( $response );

	if ( 200 !== $status ) {
		/* translators: %d: HTTP status code. */
		return new WP_Error( 'schema_org_blocks_fetch_failed', sprintf( __( 'The page could not be fetched: status %d.', 'schema-org-blocks' ), $status ), [ 'status' => 502 ] );
	}

	$graph = parse_json_ld( wp_remote_retrieve_body( $response ) );

	return [
		'source'  => 'page',
		'url'     => $url,
		'graph'   => $graph,
		'missing' => SchemaOutput\get_missing( $graph ),
	];
}

/**
 * Get the block template that renders a post, in a block theme.
 *
 * Tries `front-page` for the static front page, then the post's chosen template, else the template for its type and slug, then `singular`
 * and `index`, and returns the first that exists.
 *
 * @param int $post_id Post ID.
 * @return WP_Block_Template|null Null in a classic theme or when no template is found.
 */
function get_post_template( int $post_id ) : ?WP_Block_Template {
	$post = get_post( $post_id );

	if ( ! $post instanceof WP_Post || ! wp_is_block_theme() ) {
		return null;
	}

	$custom = get_page_template_slug( $post );

	if ( $custom ) {
		$slugs = [ $custom ];
	} elseif ( 'page' === $post->post_type ) {
		$slugs = [ 'page-' . $post->post_name, 'page-' . $post->ID, 'page' ];
	} else {
		$slugs = [ 'single-' . $post->post_type . '-' . $post->post_name, 'single-' . $post->post_type, 'single' ];
	}

	if ( 'page' === $post->post_type && 'page' === get_option( 'show_on_front' ) && (int) get_option( 'page_on_front' ) === $post->ID ) {
		array_unshift( $slugs, 'front-page' );
	}

	foreach ( array_merge( $slugs, [ 'singular', 'index' ] ) as $slug ) {
		$template = str_ends_with( $slug, '-' ) ? null : get_block_template( get_stylesheet() . '//' . $slug );

		if ( $template instanceof WP_Block_Template ) {
			return $template;
		}
	}

	return null;
}

/**
 * Get the schema objects from the JSON-LD scripts in an HTML document.
 *
 * @param string $html HTML document.
 * @return array<int, array<string, mixed>>
 */
function parse_json_ld( string $html ) : array {
	$graph     = [];
	$processor = new WP_HTML_Tag_Processor( $html );

	while ( $processor->next_tag( 'SCRIPT' ) ) {
		if ( 'application/ld+json' !== $processor->get_attribute( 'type' ) ) {
			continue;
		}

		$data = json_decode( $processor->get_modifiable_text(), true );

		if ( ! is_array( $data ) ) {
			continue;
		}

		if ( isset( $data['@graph'] ) && is_array( $data['@graph'] ) ) {
			$items = $data['@graph'];
		} elseif ( wp_is_numeric_array( $data ) ) {
			$items = $data;
		} else {
			$items = [ $data ];
		}

		foreach ( $items as $item ) {
			if ( is_array( $item ) && $item ) {
				$graph[] = $item;
			}
		}
	}

	return $graph;
}
