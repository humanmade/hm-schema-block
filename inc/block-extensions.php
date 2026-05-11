<?php
/**
 * Block extensions for schema.org mapping.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\BlockExtensions;

/**
 * Register block context for schema.org types.
 */
function register_block_context() : void {
	add_filter( 'register_block_type_args', __NAMESPACE__ . '\\add_schema_org_attribute', 10, 2 );
	add_filter( 'register_block_type_args', __NAMESPACE__ . '\\add_block_context', 10, 2 );
	add_filter( 'render_block', __NAMESPACE__ . '\\extract_schema_data', 10, 2 );
}

/**
 * Add schemaOrg attribute to all blocks.
 *
 * @param array<string, mixed> $args Block type registration args.
 * @param string              $block_name Block name.
 * @return array<string, mixed>
 */
function add_schema_org_attribute( array $args, string $block_name ) : array {
	$args['attributes']['schemaOrg'] = [
		'type'    => 'object',
		'default' => [
			'type'         => null,
			'mappings'     => [],
			'isProperty'   => false,
			'propertyName' => null,
		],
	];
	return $args;
}

/**
 * Add block context support for schema.org types.
 *
 * @param array<string, mixed> $args Block type registration args.
 * @param string              $block_name Block name.
 * @return array<string, mixed>
 */
function add_block_context( array $args, string $block_name ) : array {
	if ( ! isset( $args['provides_context'] ) ) {
		$args['provides_context'] = [];
	}
	$args['provides_context']['schemaOrg/type'] = 'schemaOrg';

	if ( ! isset( $args['uses_context'] ) ) {
		$args['uses_context'] = [];
	}
	$args['uses_context'][] = 'schemaOrg/type';

	return $args;
}

/**
 * Extract schema.org data from a rendered block.
 *
 * Short-circuits when the request has already been primed via prime_schema_data(),
 * preventing duplicate entries when the_content() or a template renders after priming.
 *
 * @param string               $block_content Rendered block content.
 * @param array<string, mixed> $block Block data.
 * @return string
 */
function extract_schema_data( string $block_content, array $block ) : string {
	global $schema_org_blocks_data, $schema_org_blocks_primed;

	if ( ! empty( $schema_org_blocks_primed ) ) {
		return $block_content;
	}

	if ( ! isset( $schema_org_blocks_data ) ) {
		$schema_org_blocks_data = [];
	}

	$schema_org = $block['attrs']['schemaOrg'] ?? null;

	if ( ! $schema_org || empty( $schema_org['type'] ) ) {
		return $block_content;
	}

	$schema_object = build_schema_object( $block, $schema_org );

	if ( ! empty( $schema_object ) ) {
		$schema_org_blocks_data[] = $schema_object;
	}

	return $block_content;
}

/**
 * Build a schema.org object from block data and mappings.
 * Works against both live rendered blocks and parse_blocks() output.
 *
 * @param array<string, mixed> $block Block data.
 * @param array<string, mixed> $schema_org Schema org configuration.
 * @return array<string, mixed>
 */
function build_schema_object( array $block, array $schema_org ) : array {
	$schema_type = $schema_org['type'];
	$mappings    = $schema_org['mappings'] ?? [];

	$schema_object = [
		'@type' => $schema_type,
	];

	foreach ( $mappings as $property => $mapping ) {
		$value = null;

		if ( $mapping['source'] === 'attribute' ) {
			$attribute_name = $mapping['attributeName'] ?? null;
			if ( $attribute_name && isset( $block['attrs'][ $attribute_name ] ) ) {
				$value = $block['attrs'][ $attribute_name ];
			}
		} elseif ( $mapping['source'] === 'content' ) {
			$value = wp_strip_all_tags( $block['innerHTML'] ?? '' );
		} elseif ( $mapping['source'] === 'context' ) {
			continue;
		}

		if ( $value !== null ) {
			$schema_object[ $property ] = $value;
		}
	}

	return $schema_object;
}

/**
 * Return true if a registered block type has a server-side render callback.
 *
 * @param string $name Block name.
 * @return bool
 */
function is_dynamic_block_name( string $name ) : bool {
	$type = \WP_Block_Type_Registry::get_instance()->get_registered( $name );
	return $type instanceof \WP_Block_Type && $type->is_dynamic();
}

/**
 * Walk a block tree and return schema objects for all static (non-dynamic) blocks.
 * Subtrees rooted in a dynamic block are skipped — their output changes per-request.
 *
 * @param array<int, array<string, mixed>> $blocks Parsed block list from parse_blocks().
 * @return array<int, array<string, mixed>>
 */
function extract_static_schema( array $blocks ) : array {
	$schema = [];

	foreach ( $blocks as $block ) {
		$name = $block['blockName'] ?? '';

		if ( $name && is_dynamic_block_name( $name ) ) {
			continue;
		}

		$schema_org = $block['attrs']['schemaOrg'] ?? [];

		if ( ! empty( $schema_org['type'] ) ) {
			$object = build_schema_object( $block, $schema_org );
			if ( ! empty( $object ) ) {
				$schema[] = $object;
			}
		}

		if ( ! empty( $block['innerBlocks'] ) ) {
			$schema = array_merge( $schema, extract_static_schema( $block['innerBlocks'] ) );
		}
	}

	return $schema;
}

/**
 * Return true if the block tree contains at least one dynamic block.
 *
 * @param array<int, array<string, mixed>> $blocks Parsed block list.
 * @return bool
 */
function tree_has_dynamic_block( array $blocks ) : bool {
	foreach ( $blocks as $block ) {
		$name = $block['blockName'] ?? '';
		if ( $name && is_dynamic_block_name( $name ) ) {
			return true;
		}
		if ( ! empty( $block['innerBlocks'] ) && tree_has_dynamic_block( $block['innerBlocks'] ) ) {
			return true;
		}
	}
	return false;
}

/**
 * Precompute and persist schema data when a post (or block template) is saved.
 *
 * @param int      $post_id Post ID.
 * @param \WP_Post $post    Post object.
 */
function on_save_post( int $post_id, \WP_Post $post ) : void {
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( wp_is_post_revision( $post_id ) ) {
		return;
	}

	if ( ! has_blocks( $post->post_content ) ) {
		delete_post_meta( $post_id, '_hm_schema_static' );
		delete_post_meta( $post_id, '_hm_schema_has_dynamic' );
		invalidate_schema_cache();
		return;
	}

	$blocks  = parse_blocks( $post->post_content );
	$static  = extract_static_schema( $blocks );
	$dynamic = tree_has_dynamic_block( $blocks );

	update_post_meta( $post_id, '_hm_schema_static', $static );
	update_post_meta( $post_id, '_hm_schema_has_dynamic', $dynamic ? 1 : 0 );

	invalidate_schema_cache();
}

/**
 * Flush the schema object cache group so stale data isn't served.
 *
 * @param int $post_id Unused; present for use as a hook callback.
 */
function invalidate_schema_cache( int $post_id = 0 ) : void {
	if ( function_exists( 'wp_cache_flush_group' ) ) {
		wp_cache_flush_group( 'hm-schema-blocks' );
	}
	// On WP < 6.1 without group flush support, cached entries expire via their TTL.
}
