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
use WP_Post;

/**
 * Register collection and output hooks.
 */
function init() : void {
	add_filter( 'template_include', __NAMESPACE__ . '\\start_collecting', PHP_INT_MAX );
	add_filter( 'render_block', __NAMESPACE__ . '\\collect_rendered_block', 10, 2 );

	if ( is_yoast_seo_active() ) {
		add_filter( 'wpseo_schema_graph', __NAMESPACE__ . '\\add_to_yoast_graph' );
	} else {
		add_action( 'wp_head', __NAMESPACE__ . '\\output_json_ld', 1 );
	}
}

/**
 * Get or update the collection state for the current request.
 *
 * @param array<string, mixed>|null $update Keys to replace: `objects` (keyed by hash) and `collecting`.
 * @return array{objects: array<string, array<string, mixed>>, collecting: bool}
 */
function state( ?array $update = null ) : array {
	static $state = [
		'objects'    => [],
		'collecting' => false,
	];

	if ( null !== $update ) {
		$state = array_merge( $state, $update );
	}

	return $state;
}

/**
 * Add schema objects to the collection, skipping exact duplicates.
 *
 * @param array<int, array<string, mixed>> $objects Schema objects.
 */
function add_objects( array $objects ) : void {
	$collected = state()['objects'];

	foreach ( $objects as $object ) {
		$collected[ md5( (string) wp_json_encode( $object ) ) ] = $object;
	}

	state( [ 'objects' => $collected ] );
}

/**
 * Remove schema objects from the collection.
 *
 * @param array<int, array<string, mixed>> $objects Schema objects.
 */
function remove_objects( array $objects ) : void {
	$collected = state()['objects'];

	foreach ( $objects as $object ) {
		unset( $collected[ md5( (string) wp_json_encode( $object ) ) ] );
	}

	state( [ 'objects' => $collected ] );
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
			'collecting' => false,
		]
	);

	if ( ! empty( $GLOBALS['_wp_current_template_content'] ) && 'template-canvas.php' === basename( (string) $template ) ) {
		state( [ 'collecting' => true ] );
		return $template;
	}

	$post = is_singular() ? get_queried_object() : null;

	if ( $post instanceof WP_Post && has_blocks( $post ) && ! post_password_required( $post ) ) {
		add_objects( BlockExtensions\extract_schema( parse_blocks( $post->post_content ) ) );
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
 * @return string
 */
function collect_rendered_block( $block_content, $block ) {
	if ( ! state()['collecting'] || ! is_array( $block ) || doing_filter( 'get_the_excerpt' ) ) {
		return $block_content;
	}

	if ( doing_filter( 'the_content' ) && get_the_ID() !== get_queried_object_id() ) {
		return $block_content;
	}

	if ( BlockExtensions\is_hidden( $block ) ) {
		remove_objects( BlockExtensions\extract_schema( BlockValues\get_inner_blocks( $block ) ) );
		return $block_content;
	}

	if ( BlockExtensions\is_entity( $block ) ) {
		$object = BlockExtensions\build_schema_object( $block );
		if ( $object ) {
			add_objects( [ $object ] );
		}
	}

	return $block_content;
}

/**
 * Get the schema graph for the current request.
 *
 * @return array<int, array<string, mixed>>
 */
function get_graph() : array {
	/**
	 * Filter the schema objects output for the current request.
	 *
	 * @param array<int, array<string, mixed>> $graph Schema objects.
	 */
	$graph = apply_filters( 'schema_org_blocks_graph', array_values( state()['objects'] ) );

	return is_array( $graph ) ? array_values( array_filter( $graph ) ) : [];
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
