<?php
/**
 * Schema.org output handling.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\SchemaOutput;

/**
 * Register output hooks.
 * Priming is registered separately in namespace.php on template_redirect priority 0.
 */
function init() : void {
	if ( is_yoast_seo_active() ) {
		add_filter( 'wpseo_schema_graph_pieces', __NAMESPACE__ . '\\add_to_yoast_schema', 10, 2 );
	} else {
		add_action( 'wp_head', __NAMESPACE__ . '\\output_json_ld', 1 );
	}
}

/**
 * Populate $schema_org_blocks_data before wp_head fires.
 * Registered on template_redirect at priority 0 (namespace.php).
 *
 * After this runs, the primed flag is set and render_block extraction
 * becomes a no-op, preventing duplicate entries when the_content() renders later.
 */
function prime_schema_data() : void {
	global $schema_org_blocks_data, $schema_org_blocks_primed;

	$schema_org_blocks_data  = [];
	$schema_org_blocks_primed = false;

	if ( wp_is_block_theme() ) {
		// FSE: render the active block template, which folds in post-content blocks.
		prime_from_active_template();
	} elseif ( is_singular() ) {
		// Classic theme singular: use save-time static cache + dynamic fallback.
		prime_singular_classic();
	}
	// Classic theme archives have no block content to extract.

	$schema_org_blocks_primed = true;
}

/**
 * Prime from the current singular post's saved static data (classic theme path).
 * Falls back to a cached dynamic render when dynamic blocks are present or cache is cold.
 */
function prime_singular_classic() : void {
	$post = get_post();
	if ( ! $post || ! has_blocks( $post->post_content ) ) {
		return;
	}

	$static      = get_post_meta( $post->ID, '_hm_schema_static', true );
	$has_static  = is_array( $static );
	$has_dynamic = (bool) get_post_meta( $post->ID, '_hm_schema_has_dynamic', true );

	if ( $has_static && ! $has_dynamic ) {
		// Fast path: no render needed.
		global $schema_org_blocks_data;
		$schema_org_blocks_data = $static;
		return;
	}

	dynamic_render_with_cache( 'post_' . $post->ID, $post->post_content );
}

/**
 * Prime schema by rendering the active FSE block template.
 * For singular pages, the template embeds core/post-content, so post blocks are included.
 */
function prime_from_active_template() : void {
	$template = find_active_block_template();
	if ( ! $template || empty( $template->content ) ) {
		return;
	}

	$queried_id = (int) get_queried_object_id();
	$query_hash = md5( serialize( (array) ( $GLOBALS['wp_query']->query_vars ?? [] ) ) );
	$slug       = $template->slug ?? (string) ( $template->wp_id ?? 'index' );
	$key        = 'tpl_' . $slug . '_' . $queried_id . '_' . $query_hash;

	dynamic_render_with_cache( $key, $template->content );
}

/**
 * Render block content in an isolated scope, cache the collected schema entries,
 * and merge them into $schema_org_blocks_data.
 *
 * @param string $key     Object-cache key (within 'hm-schema-blocks' group).
 * @param string $content Raw block content with block comment delimiters.
 */
function dynamic_render_with_cache( string $key, string $content ) : void {
	global $schema_org_blocks_data, $schema_org_blocks_primed;

	$cached = wp_cache_get( $key, 'hm-schema-blocks' );
	if ( is_array( $cached ) ) {
		$schema_org_blocks_data = array_merge( $schema_org_blocks_data, $cached );
		return;
	}

	// Render in isolation: snapshot current state, reset, render, then restore + merge.
	$previous_data   = $schema_org_blocks_data;
	$previous_primed = $schema_org_blocks_primed;

	$schema_org_blocks_data   = [];
	$schema_org_blocks_primed = false;

	do_blocks( $content ); // HTML discarded; side-effect populates $schema_org_blocks_data.

	$result = $schema_org_blocks_data;

	$schema_org_blocks_data   = array_merge( $previous_data, $result );
	$schema_org_blocks_primed = $previous_primed;

	wp_cache_set( $key, $result, 'hm-schema-blocks', HOUR_IN_SECONDS );
}

/**
 * Find the active block template for the current request by walking the hierarchy.
 *
 * @return \WP_Block_Template|null
 */
function find_active_block_template() : ?\WP_Block_Template {
	$stylesheet = get_stylesheet();

	foreach ( resolve_template_slugs() as $slug ) {
		$template = get_block_template( $stylesheet . '//' . $slug, 'wp_template' );
		if ( $template ) {
			return $template;
		}
	}

	return null;
}

/**
 * Return block template slug candidates in hierarchy order for the current request.
 * Mirrors WordPress's block template resolution without relying on private functions.
 *
 * @return array<int, string>
 */
function resolve_template_slugs() : array {
	$slugs = [];

	if ( is_singular() ) {
		$post = get_post();
		if ( $post ) {
			$page_tpl = get_page_template_slug( $post->ID );
			if ( $page_tpl ) {
				$slugs[] = str_replace( '.html', '', basename( (string) $page_tpl ) );
			}
			$slugs[] = 'single-' . $post->post_type . '-' . $post->post_name;
			$slugs[] = 'single-' . $post->post_type;
		}
		$slugs[] = 'single';
		$slugs[] = 'singular';
	} elseif ( is_front_page() ) {
		$slugs = [ 'front-page', 'home' ];
	} elseif ( is_home() ) {
		$slugs = [ 'home' ];
	} elseif ( is_category() ) {
		$cat = get_queried_object();
		if ( $cat instanceof \WP_Term ) {
			$slugs[] = 'category-' . $cat->slug;
			$slugs[] = 'category-' . $cat->term_id;
		}
		$slugs[] = 'category';
		$slugs[] = 'archive';
	} elseif ( is_tag() ) {
		$tag = get_queried_object();
		if ( $tag instanceof \WP_Term ) {
			$slugs[] = 'tag-' . $tag->slug;
			$slugs[] = 'tag-' . $tag->term_id;
		}
		$slugs[] = 'tag';
		$slugs[] = 'archive';
	} elseif ( is_tax() ) {
		$term = get_queried_object();
		if ( $term instanceof \WP_Term ) {
			$slugs[] = 'taxonomy-' . $term->taxonomy . '-' . $term->slug;
			$slugs[] = 'taxonomy-' . $term->taxonomy;
		}
		$slugs[] = 'taxonomy';
		$slugs[] = 'archive';
	} elseif ( is_post_type_archive() ) {
		$post_type = (string) get_query_var( 'post_type' );
		if ( $post_type ) {
			$slugs[] = 'archive-' . $post_type;
		}
		$slugs[] = 'archive';
	} elseif ( is_author() ) {
		$author = get_queried_object();
		if ( $author instanceof \WP_User ) {
			$slugs[] = 'author-' . $author->user_nicename;
			$slugs[] = 'author-' . $author->ID;
		}
		$slugs[] = 'author';
		$slugs[] = 'archive';
	} elseif ( is_date() ) {
		$slugs = [ 'date', 'archive' ];
	} elseif ( is_archive() ) {
		$slugs = [ 'archive' ];
	} elseif ( is_search() ) {
		$slugs = [ 'search' ];
	} elseif ( is_404() ) {
		$slugs = [ '404' ];
	}

	$slugs[] = 'index';
	return $slugs;
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
 * Add schema data to Yoast SEO's schema graph.
 *
 * @param array<int, mixed> $pieces Schema graph pieces.
 * @param mixed            $context Context.
 * @return array<int, mixed>
 */
function add_to_yoast_schema( array $pieces, $context ) : array {
	global $schema_org_blocks_data;

	if ( empty( $schema_org_blocks_data ) ) {
		return $pieces;
	}

	foreach ( $schema_org_blocks_data as $schema_data ) {
		if ( ! empty( $schema_data ) ) {
			$schema_data['@context'] = 'https://schema.org';
			$pieces[]                = $schema_data;
		}
	}

	return $pieces;
}

/**
 * Output JSON-LD schema in the site header.
 */
function output_json_ld() : void {
	global $schema_org_blocks_data;

	if ( empty( $schema_org_blocks_data ) ) {
		return;
	}

	$graph = array_values( array_filter( $schema_org_blocks_data ) );

	if ( empty( $graph ) ) {
		return;
	}

	$schema_output = [
		'@context' => 'https://schema.org',
		'@graph'   => $graph,
	];

	printf(
		'<script type="application/ld+json">%s</script>' . "\n",
		wp_json_encode( $schema_output, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT )
	);
}
