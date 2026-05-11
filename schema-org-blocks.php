<?php
/**
 * Plugin Name: Schema.org Blocks
 * Description: Extend all blocks with schema.org type mapping and structured data output
 * Version: __VERSION__
 * Author: Human Made
 * Author URI: https://humanmade.com
 * Text Domain: schema-org-blocks
 * Requires at least: 6.0
 * Requires PHP: 8.0
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SCHEMA_ORG_BLOCKS_PATH', __DIR__ );
define( 'SCHEMA_ORG_BLOCKS_URL', plugins_url( '', __FILE__ ) );
define( 'SCHEMA_ORG_BLOCKS_VERSION', '__VERSION__' );

// Require Composer autoloader.
if ( file_exists( __DIR__ . '/vendor/autoload.php' ) ) {
	require_once __DIR__ . '/vendor/autoload.php';
}

require_once __DIR__ . '/inc/namespace.php';
require_once __DIR__ . '/inc/schema-types.php';
require_once __DIR__ . '/inc/block-extensions.php';
require_once __DIR__ . '/inc/schema-output.php';

// Bootstrap the plugin.
bootstrap();
