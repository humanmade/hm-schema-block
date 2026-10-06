<?php
/**
 * Plugin bootstrap and initialization.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks;

/**
 * Bootstrap the plugin.
 *
 * Block type filters are added straight away: core blocks register on `init` before
 * callbacks added by plugins at the same priority run.
 */
function bootstrap() : void {
	BlockExtensions\register_block_attribute();
	Patterns\bootstrap();
	Abilities\bootstrap();

	add_action( 'init', __NAMESPACE__ . '\\SchemaOutput\\init' );
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\enqueue_block_editor_assets' );
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

	wp_set_script_translations( 'schema-org-blocks-editor', 'schema-org-blocks' );

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
			'schemaRequired'   => SchemaTypes\get_all_required_properties(),
		]
	);
}
