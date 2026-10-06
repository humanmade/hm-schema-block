<?php
/**
 * Plugin Name: Schema.org Blocks test helpers
 * Description: Test-only REST route that runs the page assembly on a posted graph. Mounted by the E2E global setup.
 *
 * @package SchemaOrgBlocks
 */

add_action(
	'rest_api_init',
	static function () : void {
		register_rest_route(
			'schema-org-blocks-test/v1',
			'/assemble',
			[
				'methods'             => 'POST',
				'callback'            => static function ( WP_REST_Request $request ) {
					return SchemaOrgBlocks\SchemaOutput\assemble_page(
						(array) $request->get_param( 'graph' ),
						(string) $request->get_param( 'pageId' ),
						(bool) $request->get_param( 'ownsPage' )
					);
				},
				'permission_callback' => static fn () => current_user_can( 'manage_options' ),
			]
		);
	}
);
