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
use SchemaOrgBlocks\SchemaTypes;
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
	return build_graph( array_values( state()['objects'] ), is_singular() ? get_queried_object_id() : 0 );
}

/**
 * Build the output graph from collected schema objects.
 *
 * @param array<int, array<string, mixed>> $objects Schema objects.
 * @param int                              $post_id Post the objects belong to, or 0 to leave out the page node.
 * @return array<int, array<string, mixed>>
 */
function build_graph( array $objects, int $post_id = 0 ) : array {
	$graph   = remove_nested_duplicates( $objects );
	$page_id = $post_id ? get_permalink( $post_id ) : false;

	if ( $page_id ) {
		$graph = assemble_page( $graph, $page_id, true );
	}

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
 * Join the graph's nodes into one page.
 *
 * The page node is the WebPage (or WebPage subtype) with the page's @id or url; with
 * `$owns_page` one is added when missing. Page subtypes such as FAQPage, at the top level or
 * nested in the page node, are merged into it. Main entities the page type does not accept move
 * to `hasPart`. With `$owns_page`, the only entity of the page becomes its main entity, and the
 * creative works left over, such as an Article beside an FAQPage, are marked as part of the page.
 *
 * @param array<int, array<string, mixed>> $graph     Schema objects.
 * @param string                           $page_id   Permalink of the page, used as its @id.
 * @param bool                             $owns_page Whether the graph is the whole page: a missing page node is added, a page node's WebPage type is replaced by its subtype and the main entity is linked.
 * @return array<int, array<string, mixed>>
 */
function assemble_page( array $graph, string $page_id, bool $owns_page ) : array {
	$index = find_page_node( $graph, $page_id );

	if ( null === $index ) {
		if ( ! $owns_page || ! $graph ) {
			return $graph;
		}

		array_unshift( $graph, build_page_node( $page_id ) );
		$index = 0;
	}

	$hub = [ '@id' => $page_id ] + $graph[ $index ];
	unset( $graph[ $index ] );
	$hub['@id'] = $page_id;

	$absorbed = [];
	foreach ( $graph as $key => $node ) {
		if ( is_page_node( $node, $page_id ) ) {
			$absorbed[] = $node;
			unset( $graph[ $key ] );
		}
	}
	$hub = extract_page_nodes( $hub, $page_id, $absorbed );

	$types = get_node_types( $hub );
	foreach ( $absorbed as $node ) {
		$hub   = merge_page_node( $hub, $node );
		$types = array_merge( $types, get_node_types( $node ) );
	}

	$types = array_values( array_unique( $types ) );
	if ( $owns_page && count( $types ) > 1 ) {
		$types = array_values( array_diff( $types, [ 'WebPage' ] ) );
	}
	$hub['@type'] = 1 === count( $types ) ? $types[0] : $types;

	$hub = move_unaccepted_main_entities( $hub );

	if ( $owns_page && ! isset( $hub['mainEntity'] ) ) {
		[ $hub, $graph ] = link_main_entity( $hub, $graph, $page_id );
	}

	if ( $owns_page ) {
		$graph = link_page_parts( $graph, $page_id );
	}

	$graph[ $index ] = $hub;
	ksort( $graph );

	return array_values( $graph );
}

/**
 * Build a WebPage node for a page of this site.
 *
 * @param string $page_id Permalink of the page.
 * @return array<string, mixed>
 */
function build_page_node( string $page_id ) : array {
	$post_id = url_to_postid( $page_id );

	return array_filter(
		[
			'@id'        => $page_id,
			'@type'      => 'WebPage',
			'url'        => $page_id,
			'name'       => $post_id ? DynamicValues\text( get_the_title( $post_id ) ) : null,
			'isPartOf'   => [ '@id' => BlockExtensions\get_entity_id_url( 'website' ) ],
			'inLanguage' => DynamicValues\get_site_field( 'language' ),
		]
	);
}

/**
 * Find the top-level page node: a WebPage with the page's @id, else one with its url.
 *
 * @param array<int, array<string, mixed>> $graph   Schema objects.
 * @param string                           $page_id Permalink of the page.
 * @return int|string|null Key in the graph.
 */
function find_page_node( array $graph, string $page_id ) {
	foreach ( [ '@id', 'url' ] as $property ) {
		foreach ( $graph as $key => $node ) {
			if ( is_array( $node ) && ( $node[ $property ] ?? null ) === $page_id && has_page_type( $node ) ) {
				return $key;
			}
		}
	}

	return null;
}

/**
 * Get the types of a node as a list.
 *
 * @param array<string, mixed> $node Schema object.
 * @return array<int, string>
 */
function get_node_types( array $node ) : array {
	return array_values( array_filter( (array) ( $node['@type'] ?? [] ), 'is_string' ) );
}

/**
 * Whether a node is a WebPage or a WebPage subtype.
 *
 * @param array<string, mixed> $node Schema object.
 * @return bool
 */
function has_page_type( array $node ) : bool {
	foreach ( get_node_types( $node ) as $type ) {
		if ( 'WebPage' === $type || SchemaTypes\is_subtype_of( $type, 'WebPage' ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Whether a value is a page node of this page: a WebPage or subtype with no @id or the page's @id.
 *
 * @param mixed  $value   Value.
 * @param string $page_id Permalink of the page.
 * @return bool
 */
function is_page_node( $value, string $page_id ) : bool {
	return is_array( $value ) && ( ! isset( $value['@id'] ) || $page_id === $value['@id'] ) && has_page_type( $value );
}

/**
 * Take the page nodes nested inside a node out of it.
 *
 * A list left with one value becomes that value, and an emptied one is removed.
 *
 * @param array<string, mixed>             $node    Schema object.
 * @param string                           $page_id Permalink of the page.
 * @param array<int, array<string, mixed>> $found   Page nodes taken out, added to.
 * @return array<string, mixed> The node without them.
 */
function extract_page_nodes( array $node, string $page_id, array &$found ) : array {
	foreach ( $node as $key => $value ) {
		if ( ! is_array( $value ) || 0 === strpos( (string) $key, '@' ) ) {
			continue;
		}

		if ( is_page_node( $value, $page_id ) ) {
			$found[] = $value;
			unset( $node[ $key ] );
			continue;
		}

		if ( array_values( $value ) !== $value ) {
			$node[ $key ] = extract_page_nodes( $value, $page_id, $found );
			continue;
		}

		$kept = [];
		foreach ( $value as $item ) {
			if ( is_page_node( $item, $page_id ) ) {
				$found[] = $item;
			} else {
				$kept[] = is_array( $item ) && array_values( $item ) !== $item ? extract_page_nodes( $item, $page_id, $found ) : $item;
			}
		}

		if ( ! $kept ) {
			unset( $node[ $key ] );
		} else {
			$node[ $key ] = 1 === count( $kept ) && count( $value ) > 1 ? $kept[0] : $kept;
		}
	}

	return $node;
}

/**
 * Merge a page node into the page node: `mainEntity` and `hasPart` values are added, any other
 * property is copied when the page node has none.
 *
 * @param array<string, mixed> $hub  Page node.
 * @param array<string, mixed> $node Page node to merge in.
 * @return array<string, mixed>
 */
function merge_page_node( array $hub, array $node ) : array {
	foreach ( $node as $key => $value ) {
		if ( '@type' === $key || '@id' === $key ) {
			continue;
		}

		if ( 'mainEntity' === $key || 'hasPart' === $key ) {
			$hub[ $key ] = add_values( $hub[ $key ] ?? null, $value );
		} elseif ( ! isset( $hub[ $key ] ) ) {
			$hub[ $key ] = $value;
		}
	}

	return $hub;
}

/**
 * Add values to a property value: a list, or the value itself when there is only one.
 *
 * @param mixed $existing Current value, or null.
 * @param mixed $values   Value or list of values to add.
 * @return mixed
 */
function add_values( $existing, $values ) {
	$list = array_merge( to_list( $existing ), to_list( $values ) );

	return 1 === count( $list ) ? $list[0] : $list;
}

/**
 * Get a property value as a list of values.
 *
 * @param mixed $value Value, a list of values, or null.
 * @return array<int, mixed>
 */
function to_list( $value ) : array {
	if ( null === $value ) {
		return [];
	}

	return is_array( $value ) && array_values( $value ) === $value ? $value : [ $value ];
}

/**
 * Whether every type of the page accepts an entity as its main entity.
 *
 * @param array<int, string> $page_types Types of the page node.
 * @param array<int, string> $types      Types of the entity.
 * @return bool
 */
function accepts_main_entity( array $page_types, array $types ) : bool {
	foreach ( $page_types as $page_type ) {
		$accepted = (array) ( SchemaTypes\get_type_properties( $page_type )['mainEntity']['type'] ?? 'Thing' );
		$matches  = array_filter( $types, static fn ( $type ) => BlockExtensions\type_accepts( $accepted, $type ) );

		if ( ! $matches ) {
			return false;
		}
	}

	return true;
}

/**
 * Move main entities the page type does not accept to `hasPart`. Values without a type stay.
 *
 * @param array<string, mixed> $hub Page node.
 * @return array<string, mixed>
 */
function move_unaccepted_main_entities( array $hub ) : array {
	if ( ! isset( $hub['mainEntity'] ) ) {
		return $hub;
	}

	$page_types = get_node_types( $hub );
	$kept       = [];
	$moved      = [];

	foreach ( to_list( $hub['mainEntity'] ) as $value ) {
		$types = is_array( $value ) ? get_node_types( $value ) : [];

		if ( $types && ! accepts_main_entity( $page_types, $types ) ) {
			$moved[] = $value;
		} else {
			$kept[] = $value;
		}
	}

	if ( ! $moved ) {
		return $hub;
	}

	unset( $hub['mainEntity'] );
	if ( $kept ) {
		$hub['mainEntity'] = add_values( null, $kept );
	}
	$hub['hasPart'] = add_values( $hub['hasPart'] ?? null, $moved );

	return $hub;
}

/**
 * Make the only entity of the page its main entity.
 *
 * Site-wide entities (an @id under the home URL's fragment) and page nodes do not count. With
 * none or several candidates nothing changes.
 *
 * @param array<string, mixed>             $hub     Page node.
 * @param array<int, array<string, mixed>> $graph   Other top-level nodes.
 * @param string                           $page_id Permalink of the page.
 * @return array{0: array<string, mixed>, 1: array<int, array<string, mixed>>} Page node and other nodes.
 */
function link_main_entity( array $hub, array $graph, string $page_id ) : array {
	$candidates = array_keys(
		array_filter(
			$graph,
			static fn ( $node ) => is_array( $node )
				&& get_node_types( $node )
				&& ! has_page_type( $node )
				&& 0 !== strpos( (string) ( $node['@id'] ?? '' ), home_url( '/#' ) )
		)
	);

	if ( 1 !== count( $candidates ) ) {
		return [ $hub, $graph ];
	}

	$key  = $candidates[0];
	$node = $graph[ $key ];
	$id   = $node['@id'] ?? $page_id . '#' . strtolower( get_node_types( $node )[0] );

	$node['@id']              = $id;
	$node['mainEntityOfPage'] = $node['mainEntityOfPage'] ?? [ '@id' => $page_id ];
	$graph[ $key ]            = $node;

	$property         = accepts_main_entity( get_node_types( $hub ), get_node_types( $node ) ) ? 'mainEntity' : 'hasPart';
	$hub[ $property ] = add_values( $hub[ $property ] ?? null, [ '@id' => $id ] );

	return [ $hub, $graph ];
}

/**
 * Mark the creative works left at the top level as part of the page.
 *
 * Applies to CreativeWork nodes and their subtypes without an `isPartOf`. Site-wide entities
 * (an @id under the home URL's fragment), such as the WebSite, are left alone.
 *
 * @param array<int, array<string, mixed>> $graph   Top-level nodes other than the page node.
 * @param string                           $page_id Permalink of the page.
 * @return array<int, array<string, mixed>>
 */
function link_page_parts( array $graph, string $page_id ) : array {
	foreach ( $graph as $key => $node ) {
		if ( ! is_array( $node ) || isset( $node['isPartOf'] ) || 0 === strpos( (string) ( $node['@id'] ?? '' ), home_url( '/#' ) ) ) {
			continue;
		}

		foreach ( get_node_types( $node ) as $type ) {
			if ( 'CreativeWork' === $type || SchemaTypes\is_subtype_of( $type, 'CreativeWork' ) ) {
				$graph[ $key ]['isPartOf'] = [ '@id' => $page_id ];
				break;
			}
		}
	}

	return $graph;
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
 * On singular pages, page subtypes such as FAQPage are merged into Yoast's WebPage node.
 *
 * @param array<int, mixed> $graph Yoast schema graph nodes.
 * @return array<int, mixed>
 */
function add_to_yoast_graph( $graph ) : array {
	$graph   = array_merge( is_array( $graph ) ? $graph : [], build_graph( array_values( state()['objects'] ) ) );
	$page_id = is_singular() ? get_permalink( get_queried_object_id() ) : false;

	return $page_id ? assemble_page( $graph, $page_id, false ) : $graph;
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
