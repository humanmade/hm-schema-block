<?php
/**
 * Plugin bootstrap and initialization.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks;

/**
 * Bootstrap the plugin.
 */
function bootstrap() : void {
	add_action( 'init', __NAMESPACE__ . '\\init' );
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\enqueue_block_editor_assets' );
}

/**
 * Initialize the plugin.
 */
function init() : void {
	// Register block attributes and render_block extraction hook.
	BlockExtensions\register_block_context();

	// Register output hooks (wp_head JSON-LD or Yoast filter).
	SchemaOutput\init();

	// Prime schema data before wp_head fires.
	// Priority 0 ensures this runs before any plugin that hooks template_redirect at 1+.
	add_action( 'template_redirect', __NAMESPACE__ . '\\SchemaOutput\\prime_schema_data', 0 );

	// Precompute static schema when a post or block template is saved.
	add_action( 'save_post', __NAMESPACE__ . '\\BlockExtensions\\on_save_post', 10, 2 );

	// Flush the schema cache when any post's cache is invalidated (e.g. a query-loop post changes).
	add_action( 'clean_post_cache', __NAMESPACE__ . '\\BlockExtensions\\invalidate_schema_cache' );
}

/**
 * Enqueue block editor assets.
 */
function enqueue_block_editor_assets() : void {
	$asset_file = include SCHEMA_ORG_BLOCKS_PATH . '/build/index.asset.php';

	wp_enqueue_script(
		'schema-org-blocks-editor',
		SCHEMA_ORG_BLOCKS_URL . '/build/index.js',
		$asset_file['dependencies'],
		$asset_file['version'],
		true
	);

	wp_enqueue_style(
		'schema-org-blocks-editor',
		SCHEMA_ORG_BLOCKS_URL . '/build/index.css',
		[],
		$asset_file['version']
	);

	// Pass schema types to JavaScript.
	wp_localize_script(
		'schema-org-blocks-editor',
		'schemaOrgBlocksData',
		[
			'schemaTypes'      => SchemaTypes\get_schema_types(),
			'schemaProperties' => SchemaTypes\get_all_properties(),
		]
	);
}
