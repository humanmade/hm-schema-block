<?php
/**
 * Collect schema objects for the current request and output them.
 *
 * Block templates render before wp_head, so their schema is collected from render_block as
 * the page renders. Classic themes render post content after wp_head, so for them the
 * queried post's blocks are read directly instead.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\SchemaOutput;

use SchemaOrgBlocks\BlockExtensions;
use SchemaOrgBlocks\BlockValues;
use SchemaOrgBlocks\DynamicValues;
use WP_Block;
use WP_Post;

/**
 * Register collection and output hooks.
 */
function init() : void {
	add_filter( 'template_include', __NAMESPACE__ . '\\start_collecting', PHP_INT_MAX );
	add_filter( 'render_block', __NAMESPACE__ . '\\collect_rendered_block', 10, 3 );

	if ( is_yoast_seo_active() ) {
		add_filter( 'wpseo_schema_graph', __NAMESPACE__ . '\\add_to_yoast_graph' );
	} else {
		add_action( 'wp_head', __NAMESPACE__ . '\\output_json_ld', 1 );
	}
}

/**
 * Get or update the collection state for the current request.
 *
 * Objects are keyed by a hash of their JSON, with a count of how many blocks produced each one.
 *
 * @param array<string, mixed>|null $update Keys to replace: `objects`, `counts` and `collecting`.
 * @return array{objects: array<string, array<string, mixed>>, counts: array<string, int>, collecting: bool}
 */
function state( ?array $update = null ) : array {
	static $state = [
		'objects'    => [],
		'counts'     => [],
		'collecting' => false,
	];

	if ( null !== $update ) {
		$state = array_merge( $state, $update );
	}

	return $state;
}

/**
 * Add schema objects to the collection. Exact duplicates are output once.
 *
 * @param array<int, array<string, mixed>> $objects Schema objects.
 */
function add_objects( array $objects ) : void {
	[ 'objects' => $collected, 'counts' => $counts ] = state();

	foreach ( $objects as $object ) {
		$hash               = md5( (string) wp_json_encode( $object ) );
		$collected[ $hash ] = $object;
		$counts[ $hash ]    = ( $counts[ $hash ] ?? 0 ) + 1;
	}

	state(
		[
			'objects' => $collected,
			'counts'  => $counts,
		]
	);
}

/**
 * Remove one occurrence of each schema object, keeping objects other blocks also produced.
 *
 * @param array<int, array<string, mixed>> $objects Schema objects.
 */
function remove_objects( array $objects ) : void {
	[ 'objects' => $collected, 'counts' => $counts ] = state();

	foreach ( $objects as $object ) {
		$hash = md5( (string) wp_json_encode( $object ) );

		if ( ! isset( $counts[ $hash ] ) ) {
			continue;
		}

		if ( --$counts[ $hash ] < 1 ) {
			unset( $collected[ $hash ], $counts[ $hash ] );
		}
	}

	state(
		[
			'objects' => $collected,
			'counts'  => $counts,
		]
	);
}

/**
 * Start collecting once the front-end template is chosen.
 *
 * @param string $template Template file path.
 * @return string
 */
function start_collecting( $template ) {
	state(
		[
			'objects'    => [],
			'counts'     => [],
			'collecting' => false,
		]
	);

	if ( ! empty( $GLOBALS['_wp_current_template_content'] ) && 'template-canvas.php' === basename( (string) $template ) ) {
		state( [ 'collecting' => true ] );
		return $template;
	}

	$post = is_singular() ? get_queried_object() : null;

	if ( $post instanceof WP_Post && has_blocks( $post ) && ! post_password_required( $post ) ) {
		add_objects( BlockExtensions\extract_schema( parse_blocks( $post->post_content ), [ 'postId' => $post->ID ] ) );
	}

	return $template;
}

/**
 * Collect the schema object of a typed block as it renders.
 *
 * Skipped: excerpts, which render a trimmed copy of a post's blocks, and the content of posts
 * other than the queried one, such as full posts in a query loop. When a hidden block renders,
 * the objects its inner blocks added are removed again.
 *
 * @param string               $block_content Rendered block content.
 * @param array<string, mixed> $block         Parsed block.
 * @param WP_Block|null        $instance      Block instance, which carries the block context.
 * @return string
 */
function collect_rendered_block( $block_content, $block, $instance = null ) {
	if ( ! state()['collecting'] || ! is_array( $block ) || doing_filter( 'get_the_excerpt' ) ) {
		return $block_content;
	}

	if ( doing_filter( 'the_content' ) && get_the_ID() !== get_queried_object_id() ) {
		return $block_content;
	}

	$context = $instance instanceof WP_Block ? $instance->context : [];

	if ( BlockExtensions\is_hidden( $block ) ) {
		remove_objects( BlockExtensions\extract_schema( BlockValues\get_inner_blocks( $block, $context ), BlockExtensions\get_inner_context( $block, $context ) ) );
		return $block_content;
	}

	if ( BlockExtensions\is_entity( $block ) ) {
		add_objects( BlockExtensions\build_entities( $block, $context ) );
	}

	return $block_content;
}

/**
 * Get the schema graph for the current request.
 *
 * @return array<int, array<string, mixed>>
 */
function get_graph() : array {
	return build_graph( array_values( state()['objects'] ) );
}

/**
 * Build the output graph from collected schema objects.
 *
 * @param array<int, array<string, mixed>> $objects Schema objects.
 * @return array<int, array<string, mixed>>
 */
function build_graph( array $objects ) : array {
	$graph = remove_nested_duplicates( $objects );
	$graph = link_repeated_entities( $graph );

	if ( ! is_yoast_seo_active() ) {
		$graph = add_referenced_site_entities( $graph );
	}

	/**
	 * Filter the schema objects output for the current request.
	 *
	 * @param array<int, array<string, mixed>> $graph Schema objects.
	 */
	$graph = apply_filters( 'schema_org_blocks_graph', $graph );

	return is_array( $graph ) ? array_values( array_filter( $graph ) ) : [];
}

/**
 * Remove top-level objects that also appear nested inside another object.
 *
 * Entities inside a template entity, such as an FAQ in the post content of a typed single
 * template, are collected on their own as they render and again as part of the outer entity.
 *
 * @param array<int, array<string, mixed>> $graph Schema objects.
 * @return array<int, array<string, mixed>>
 */
function remove_nested_duplicates( array $graph ) : array {
	$nested = [];

	$collect = static function ( $value ) use ( &$collect, &$nested ) : void {
		if ( ! is_array( $value ) ) {
			return;
		}
		foreach ( $value as $child ) {
			if ( is_array( $child ) && isset( $child['@type'] ) ) {
				$nested[ md5( (string) wp_json_encode( $child ) ) ] = true;
			}
			$collect( $child );
		}
	};

	foreach ( $graph as $object ) {
		$collect( $object );
	}

	return array_values(
		array_filter(
			$graph,
			static fn ( $object ) => ! isset( $nested[ md5( (string) wp_json_encode( $object ) ) ] )
		)
	);
}

/**
 * Output entities that are nested more than once as one top-level node, referenced by @id.
 *
 * For example the same author Person on every post in a list becomes one Person node, and each
 * post's author becomes {"@id": …}. Entities without an @id get one under the home URL.
 *
 * @param array<int, array<string, mixed>> $graph Schema objects.
 * @return array<int, array<string, mixed>>
 */
function link_repeated_entities( array $graph ) : array {
	$counts  = [];
	$objects = [];

	$count = static function ( $value ) use ( &$count, &$counts, &$objects ) : void {
		if ( ! is_array( $value ) ) {
			return;
		}
		foreach ( $value as $child ) {
			if ( is_entity_object( $child ) ) {
				$hash             = md5( (string) wp_json_encode( $child ) );
				$counts[ $hash ]  = ( $counts[ $hash ] ?? 0 ) + 1;
				$objects[ $hash ] = $child;
			}
			$count( $child );
		}
	};

	foreach ( $graph as $node ) {
		$count( $node );
	}

	$ids = [];
	foreach ( $counts as $hash => $total ) {
		if ( $total > 1 ) {
			$object       = $objects[ $hash ];
			$ids[ $hash ] = $object['@id'] ?? home_url( '/' ) . '#/schema/' . strtolower( (string) $object['@type'] ) . '/' . substr( $hash, 0, 10 );
		}
	}

	if ( ! $ids ) {
		return $graph;
	}

	$replace_children = static function ( array $value ) use ( &$replace_children, $ids ) : array {
		foreach ( $value as $key => $child ) {
			if ( ! is_array( $child ) ) {
				continue;
			}
			$hash          = is_entity_object( $child ) ? md5( (string) wp_json_encode( $child ) ) : null;
			$value[ $key ] = null !== $hash && isset( $ids[ $hash ] ) ? [ '@id' => $ids[ $hash ] ] : $replace_children( $child );
		}
		return $value;
	};

	$graph   = array_map( $replace_children, $graph );
	$defined = get_graph_ids( $graph )[0];

	foreach ( $ids as $hash => $id ) {
		if ( ! isset( $defined[ $id ] ) ) {
			$graph[] = [ '@id' => $id ] + $replace_children( $objects[ $hash ] );
		}
	}

	return $graph;
}

/**
 * Whether a value is a schema entity worth linking by @id: an object with a type, other than a
 * ListItem, whose position ties it to one list.
 *
 * @param mixed $value Value.
 * @return bool
 */
function is_entity_object( $value ) : bool {
	return is_array( $value ) && isset( $value['@type'] ) && 'ListItem' !== $value['@type'];
}

/**
 * Add WebSite and Organization nodes built from the site settings when the graph refers to
 * `#website` or `#organization` but no block defines them.
 *
 * @param array<int, array<string, mixed>> $graph Schema objects.
 * @return array<int, array<string, mixed>>
 */
function add_referenced_site_entities( array $graph ) : array {
	[ $defined, $referenced ] = get_graph_ids( $graph );

	$website      = BlockExtensions\get_entity_id_url( 'website' );
	$organization = BlockExtensions\get_entity_id_url( 'organization' );

	if ( isset( $referenced[ $website ] ) && ! isset( $defined[ $website ] ) ) {
		$graph[]                     = [
			'@id'       => $website,
			'@type'     => 'WebSite',
			'url'       => DynamicValues\get_site_field( 'url' ),
			'name'      => DynamicValues\get_site_field( 'name' ),
			'publisher' => [ '@id' => $organization ],
		];
		$referenced[ $organization ] = true;
	}

	if ( isset( $referenced[ $organization ] ) && ! isset( $defined[ $organization ] ) ) {
		$graph[] = array_filter(
			[
				'@id'   => $organization,
				'@type' => 'Organization',
				'url'   => DynamicValues\get_site_field( 'url' ),
				'name'  => DynamicValues\get_site_field( 'name' ),
				'logo'  => DynamicValues\get_site_field( 'logo' ),
			]
		);
	}

	return $graph;
}

/**
 * Get the @ids nodes in a graph define, and the @ids its references point to.
 *
 * A reference is an object with only an `@id`; a definition is an object with an `@id` and more.
 *
 * @param array<int, array<string, mixed>> $graph Schema objects.
 * @return array{0: array<string, bool>, 1: array<string, bool>} Defined and referenced ids.
 */
function get_graph_ids( array $graph ) : array {
	$defined    = [];
	$referenced = [];

	$walk = static function ( $value ) use ( &$walk, &$defined, &$referenced ) : void {
		if ( ! is_array( $value ) ) {
			return;
		}
		if ( isset( $value['@id'] ) && is_string( $value['@id'] ) ) {
			if ( 1 === count( $value ) ) {
				$referenced[ $value['@id'] ] = true;
			} else {
				$defined[ $value['@id'] ] = true;
			}
		}
		array_map( $walk, $value );
	};

	$walk( $graph );

	return [ $defined, $referenced ];
}

/**
 * Check if Yoast SEO is active.
 *
 * @return bool
 */
function is_yoast_seo_active() : bool {
	return defined( 'WPSEO_VERSION' );
}

/**
 * Add the collected schema objects to Yoast SEO's graph.
 *
 * @param array<int, mixed> $graph Yoast schema graph nodes.
 * @return array<int, mixed>
 */
function add_to_yoast_graph( $graph ) : array {
	return array_merge( is_array( $graph ) ? $graph : [], get_graph() );
}

/**
 * Output the collected schema objects as JSON-LD.
 */
function output_json_ld() : void {
	$graph = get_graph();

	if ( ! $graph ) {
		return;
	}

	$json = wp_json_encode(
		[
			'@context' => 'https://schema.org',
			'@graph'   => $graph,
		],
		JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP
	);

	if ( $json ) {
		printf( "<script type=\"application/ld+json\">%s</script>\n", $json ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JSON with < > & hex-escaped.
	}
}
