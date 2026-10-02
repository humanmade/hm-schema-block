<?php
/**
 * Block extensions for schema.org mapping, and building schema objects from blocks.
 *
 * A typed block is an entity. Its properties come from its own mappings and from property
 * blocks below it: inner blocks marked as properties, found through any untyped container
 * blocks in between. A typed block inside another typed block is a separate entity unless it
 * is marked as a property; the outer entity also contains it, nested under its `contains`
 * property (hasPart by default for creative works). Post content blocks resolve to the post's
 * blocks, so a template entity contains the entities in the post. A typed post template gives
 * one entity per post in its query.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\BlockExtensions;

use SchemaOrgBlocks\BlockValues;
use SchemaOrgBlocks\DynamicValues;
use SchemaOrgBlocks\SchemaTypes;
use WP_Block;
use WP_Query;

/**
 * Schema.org data types. Properties that accept one of these take plain values.
 */
const DATA_TYPES = [ 'Text', 'URL', 'Number', 'Integer', 'Float', 'Boolean', 'Date', 'DateTime', 'Time', 'Duration' ];

/**
 * Register the schemaOrg attribute on every block type.
 */
function register_block_attribute() : void {
	add_filter( 'register_block_type_args', __NAMESPACE__ . '\\add_schema_org_attribute', 10, 2 );
}

/**
 * Add schemaOrg attribute to all blocks.
 *
 * @param array<string, mixed> $args       Block type registration args.
 * @param string               $block_name Block name.
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
 * Get a block's schemaOrg configuration with every key present and typed.
 *
 * `id` names a site-wide entity, output as `@id` home URL + `#id`, so other entities can
 * refer to it with a `reference` mapping. `contains` names the property that holds entities
 * found inside the block; an empty string turns that off, and null uses the default.
 *
 * @param array<string, mixed> $block Parsed block.
 * @return array{type: ?string, mappings: array<string, mixed>, isProperty: bool, propertyName: ?string, id: ?string, contains: ?string}
 */
function get_config( array $block ) : array {
	$config = $block['attrs']['schemaOrg'] ?? [];
	$config = is_array( $config ) ? $config : [];
	$id     = sanitize_key( (string) ( $config['id'] ?? '' ) );

	return [
		'type'         => is_string( $config['type'] ?? null ) && '' !== $config['type'] ? $config['type'] : null,
		'mappings'     => is_array( $config['mappings'] ?? null ) ? $config['mappings'] : [],
		'isProperty'   => ! empty( $config['isProperty'] ),
		'propertyName' => is_string( $config['propertyName'] ?? null ) && '' !== $config['propertyName'] ? $config['propertyName'] : null,
		'id'           => '' === $id ? null : $id,
		'contains'     => is_string( $config['contains'] ?? null ) ? $config['contains'] : null,
	];
}

/**
 * Whether a block is hidden with the block visibility support, so it and its inner blocks do not render.
 *
 * @param array<string, mixed> $block Parsed block.
 * @return bool
 */
function is_hidden( array $block ) : bool {
	return false === ( $block['attrs']['metadata']['blockVisibility'] ?? null );
}

/**
 * Whether a block is a standalone schema entity, rather than a property of its parent.
 *
 * @param array<string, mixed> $block Parsed block.
 * @return bool
 */
function is_entity( array $block ) : bool {
	$config = get_config( $block );
	return null !== $config['type'] && ! $config['isProperty'] && ! is_hidden( $block );
}

/**
 * Get the `@id` URL for a site-wide entity id.
 *
 * @param string $id Entity id, e.g. `organization`.
 * @return string
 */
function get_entity_id_url( string $id ) : string {
	return home_url( '/#' . sanitize_key( $id ) );
}

/**
 * Add what a block passes on to its inner blocks to the context: a query block's query.
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $context Context the block received.
 * @return array<string, mixed> Context for its inner blocks.
 */
function get_inner_context( array $block, array $context ) : array {
	if ( 'core/query' === ( $block['blockName'] ?? '' ) ) {
		$context['query']   = $block['attrs']['query'] ?? [];
		$context['queryId'] = $block['attrs']['queryId'] ?? null;
	}

	return $context;
}

/**
 * Build schema objects for every standalone typed block in a parsed block tree.
 *
 * @param array<int, array<string, mixed>> $blocks  Parsed blocks.
 * @param array<string, mixed>             $context Block context, e.g. `postId`.
 * @return array<int, array<string, mixed>>
 */
function extract_schema( array $blocks, array $context = [] ) : array {
	$schema = [];

	foreach ( $blocks as $block ) {
		if ( is_hidden( $block ) ) {
			continue;
		}

		if ( is_entity( $block ) ) {
			$schema = array_merge( $schema, build_entities( $block, $context ) );
		}

		$schema = array_merge( $schema, extract_schema( BlockValues\get_inner_blocks( $block, $context ), get_inner_context( $block, $context ) ) );
	}

	return $schema;
}

/**
 * Build the schema objects of a standalone typed block.
 *
 * A post template gives one object per post in its query; other blocks give one object.
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $context Block context.
 * @return array<int, array<string, mixed>>
 */
function build_entities( array $block, array $context ) : array {
	if ( 'core/post-template' === ( $block['blockName'] ?? '' ) ) {
		return build_post_items( $block, $context );
	}

	$object = build_schema_object( $block, $context );
	return $object ? [ $object ] : [];
}

/**
 * Build one object per post in a post template's query, each with the post's URL.
 *
 * @param array<string, mixed> $block   Parsed core/post-template block with a schema type.
 * @param array<string, mixed> $context Context holding the query (`query`, `queryId`).
 * @return array<int, array<string, mixed>>
 */
function build_post_items( array $block, array $context ) : array {
	$items = [];

	foreach ( get_query_post_ids( $block, $context ) as $post_id ) {
		$object = build_schema_object( $block, array_merge( $context, [ 'postId' => $post_id ] ) );

		if ( ! $object ) {
			continue;
		}

		$object['url'] ??= get_permalink( $post_id );
		$items[]         = $object;
	}

	return $items;
}

/**
 * Get the IDs of the posts a post template shows, running its query block's query.
 *
 * @param array<string, mixed> $block   Parsed core/post-template block.
 * @param array<string, mixed> $context Context holding the query (`query`, `queryId`).
 * @return array<int, int>
 */
function get_query_post_ids( array $block, array $context ) : array {
	if ( empty( $context['query'] ) || ! is_array( $context['query'] ) ) {
		return [];
	}

	if ( ! empty( $context['query']['inherit'] ) ) {
		global $wp_query;
		return array_map( 'intval', wp_list_pluck( $wp_query->posts ?? [], 'ID' ) );
	}

	$page_key = isset( $context['queryId'] ) ? 'query-' . $context['queryId'] . '-page' : 'query-page';
	$page     = max( 1, absint( wp_unslash( $_GET[ $page_key ] ?? 1 ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only pagination, as core/post-template does.
	$instance = new WP_Block( $block, $context );
	$args     = array_merge( build_query_vars_from_query_block( $instance, $page ), [
		'fields'        => 'ids',
		'no_found_rows' => true,
	] );

	return array_map( 'intval', ( new WP_Query( $args ) )->posts );
}

/**
 * Build the schema object for a typed block.
 *
 * Values come from the block's own mappings, then from its property blocks. A property block
 * with its own type becomes a nested object. Several values for one property produce an
 * array; for itemListElement each is wrapped in a ListItem with its position. Property block
 * values replace a mapping for the same property.
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $context Block context.
 * @return array<string, mixed> The object, or an empty array when it has no properties.
 */
function build_schema_object( array $block, array $context = [] ) : array {
	$config = get_config( $block );
	$type   = $config['type'];

	if ( null === $type ) {
		return [];
	}

	$object = [ '@type' => $type ];

	foreach ( $config['mappings'] as $property => $mapping ) {
		$value = resolve_mapping( $block, is_array( $mapping ) ? $mapping : [], $context );
		if ( ! is_empty_value( $value ) ) {
			$object[ $property ] = coerce_value( $type, $property, $value );
		}
	}

	$from_children = [];

	foreach ( get_property_blocks( $block, get_inner_context( $block, $context ) ) as [ $child, $child_context ] ) {
		$property = get_config( $child )['propertyName'];

		foreach ( get_property_values( $child, $property, $child_context ) as $value ) {
			$from_children[ $property ][] = coerce_value( $type, $property, $value );
		}
	}

	$contains = get_contains_property( $type, $config['contains'] );

	if ( null !== $contains ) {
		$accepted = (array) ( SchemaTypes\get_type_properties( $type )[ $contains ]['type'] ?? [] );

		foreach ( get_contained_entities( $block, get_inner_context( $block, $context ) ) as $entity ) {
			if ( type_accepts( $accepted, (string) ( $entity['@type'] ?? '' ) ) ) {
				$from_children[ $contains ][] = $entity;
			}
		}
	}

	foreach ( $from_children as $property => $values ) {
		if ( 'itemListElement' === $property ) {
			$values = wrap_list_items( $values );
		}

		$object[ $property ] = 1 === count( $values ) && 'itemListElement' !== $property ? $values[0] : $values;
	}

	$has_properties = count( $object ) > 1;

	if ( $has_properties && null !== $config['id'] ) {
		$object = [ '@id' => get_entity_id_url( $config['id'] ) ] + $object;
	}

	return $has_properties ? $object : [];
}

/**
 * Get the property that holds the entities found inside a typed block.
 *
 * @param string      $type     Schema type of the block.
 * @param string|null $contains Configured property, '' for none, or null for the default:
 *                              hasPart when the type has it.
 * @return string|null
 */
function get_contains_property( string $type, ?string $contains ) : ?string {
	if ( null !== $contains ) {
		return '' === $contains ? null : $contains;
	}

	return isset( SchemaTypes\get_type_properties( $type )['hasPart'] ) ? 'hasPart' : null;
}

/**
 * Build the entities found inside a block, stopping at each one.
 *
 * Walks through untyped containers, synced patterns, template parts and post content, but not
 * into property blocks or untyped post templates.
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $context Context for its inner blocks.
 * @return array<int, array<string, mixed>>
 */
function get_contained_entities( array $block, array $context ) : array {
	$found = [];

	foreach ( BlockValues\get_inner_blocks( $block, $context ) as $child ) {
		if ( is_hidden( $child ) ) {
			continue;
		}

		if ( is_entity( $child ) ) {
			$found = array_merge( $found, build_entities( $child, $context ) );
			continue;
		}

		if ( get_config( $child )['isProperty'] || 'core/post-template' === ( $child['blockName'] ?? '' ) ) {
			continue;
		}

		$found = array_merge( $found, get_contained_entities( $child, get_inner_context( $child, $context ) ) );
	}

	return $found;
}

/**
 * Whether a schema type is one of the accepted types or a subtype of one.
 *
 * @param array<int, string> $accepted Accepted types; Thing accepts every type.
 * @param string             $type     Schema type.
 * @return bool
 */
function type_accepts( array $accepted, string $type ) : bool {
	if ( in_array( 'Thing', $accepted, true ) ) {
		return '' !== $type;
	}

	foreach ( $accepted as $candidate ) {
		if ( $candidate === $type || SchemaTypes\is_subtype_of( $type, $candidate ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Find the property blocks of a typed block, with the context each one receives.
 *
 * Walks inner blocks through untyped containers. Stops at typed blocks that are not
 * properties (separate entities), at property blocks (whose content is their value) and at
 * untyped post templates (whose content repeats per post).
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $context Context for its inner blocks.
 * @return array<int, array{0: array<string, mixed>, 1: array<string, mixed>}>
 */
function get_property_blocks( array $block, array $context ) : array {
	$found = [];

	foreach ( BlockValues\get_inner_blocks( $block, $context ) as $child ) {
		if ( is_hidden( $child ) ) {
			continue;
		}

		$config = get_config( $child );

		if ( $config['isProperty'] ) {
			if ( null !== $config['propertyName'] ) {
				$found[] = [ $child, $context ];
			}
			continue;
		}

		if ( null !== $config['type'] || 'core/post-template' === ( $child['blockName'] ?? '' ) ) {
			continue;
		}

		$found = array_merge( $found, get_property_blocks( $child, get_inner_context( $child, $context ) ) );
	}

	return $found;
}

/**
 * Get the values a property block gives its parent: usually one, one per post for a post template.
 *
 * A typed block becomes a nested object; when nothing is mapped it falls back to its text as
 * an object of its type. An untyped block gives its mapping for the property, or its text.
 *
 * @param array<string, mixed> $block    Parsed property block.
 * @param string               $property Property name.
 * @param array<string, mixed> $context  Block context.
 * @return array<int, mixed>
 */
function get_property_values( array $block, string $property, array $context ) : array {
	$type = get_config( $block )['type'];

	if ( null === $type ) {
		$has_mapping = is_array( get_config( $block )['mappings'][ $property ] ?? null );
		$object      = $has_mapping ? null : DynamicValues\get_object( $block, $context );

		if ( $object ) {
			return [ $object ];
		}

		$value = get_property_value( $block, $property, $context );
		return is_empty_value( $value ) ? [] : [ $value ];
	}

	if ( 'core/post-template' === ( $block['blockName'] ?? '' ) ) {
		return build_post_items( $block, $context );
	}

	$object = build_schema_object( $block, $context );
	if ( $object ) {
		return [ $object ];
	}

	$text = get_property_value( $block, $property, $context );
	return is_empty_value( $text ) ? [] : [ wrap_value( $type, $text ) ];
}

/**
 * Wrap item list values in ListItem objects with their position.
 *
 * @param array<int, mixed> $values Values.
 * @return array<int, array<string, mixed>>
 */
function wrap_list_items( array $values ) : array {
	$items = [];

	foreach ( array_values( $values ) as $index => $value ) {
		$is_list_item = is_array( $value ) && 'ListItem' === ( $value['@type'] ?? '' );
		$items[]      = $is_list_item ? $value : [
			'@type'    => 'ListItem',
			'position' => $index + 1,
			'item'     => $value,
		];
	}

	return $items;
}

/**
 * Get the value an untyped property block gives its parent.
 *
 * Uses the block's mapping for that property when there is one, otherwise its text content.
 *
 * @param array<string, mixed> $block    Parsed block.
 * @param string               $property Property name.
 * @param array<string, mixed> $context  Block context.
 * @return mixed
 */
function get_property_value( array $block, string $property, array $context = [] ) {
	$mapping = get_config( $block )['mappings'][ $property ] ?? null;

	if ( is_array( $mapping ) ) {
		return resolve_mapping( $block, $mapping, $context );
	}

	return get_block_text( $block, $context );
}

/**
 * Get the text a block shows: the value of a dynamic block such as post title, or its markup's text.
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $context Block context.
 * @return string|null
 */
function get_block_text( array $block, array $context ) : ?string {
	return DynamicValues\get_value( $block, $context ) ?? BlockValues\get_text( BlockValues\get_html( $block, $context ) );
}

/**
 * Resolve a property mapping against a block.
 *
 * Sources:
 * - `attribute`: a block attribute (`attributeName`); with no attribute name, the block's text.
 * - `content`: the block's text, or a dynamic block's value.
 * - `innerBlocks`: the text of its inner blocks only, e.g. a details block without its summary.
 * - `post`: a field of the post in context (`field`: title, url, date, modified, excerpt, image,
 *   or author, which gives a Person).
 * - `site`: a field of the site (`field`: name, description, url, logo, language).
 * - `reference`: a link to a site-wide entity by its id (`id`), e.g. the header's Organization.
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $mapping Mapping, e.g. [ 'source' => 'attribute', 'attributeName' => 'url' ].
 * @param array<string, mixed> $context Block context.
 * @return mixed
 */
function resolve_mapping( array $block, array $mapping, array $context = [] ) {
	$source         = $mapping['source'] ?? '';
	$attribute_name = $mapping['attributeName'] ?? '';

	switch ( $source ) {
		case 'attribute':
			if ( is_string( $attribute_name ) && '' !== $attribute_name ) {
				return BlockValues\get_attribute( $block, $attribute_name );
			}
			return get_block_text( $block, $context );

		case 'content':
			return get_block_text( $block, $context );

		case 'innerBlocks':
			$html = array_map( static fn ( $child ) => BlockValues\get_html( $child, $context ), BlockValues\get_inner_blocks( $block, $context ) );
			return BlockValues\get_text( implode( "\n", $html ) );

		case 'post':
			$post  = get_post( DynamicValues\get_post_id( $context ) );
			$field = (string) ( $mapping['field'] ?? 'title' );
			if ( ! $post ) {
				return null;
			}
			return 'author' === $field ? DynamicValues\get_author_person( $post ) : DynamicValues\get_post_field( $field, $post );

		case 'site':
			return DynamicValues\get_site_field( (string) ( $mapping['field'] ?? 'name' ) );

		case 'reference':
			$id = sanitize_key( (string) ( $mapping['id'] ?? '' ) );
			return '' === $id ? null : [ '@id' => get_entity_id_url( $id ) ];
	}

	return null;
}

/**
 * Wrap a plain value in an object when the property only accepts objects.
 *
 * For example a text value for Question.acceptedAnswer becomes an Answer with that text,
 * and a name for Article.author becomes a Person with that name.
 *
 * @param string $type     Schema type of the object the property belongs to.
 * @param string $property Property name.
 * @param mixed  $value    Value.
 * @return mixed
 */
function coerce_value( string $type, string $property, $value ) {
	if ( ! is_scalar( $value ) ) {
		return $value;
	}

	$definition = SchemaTypes\get_type_properties( $type )[ $property ] ?? null;
	if ( ! $definition ) {
		return $value;
	}

	$expected = (array) $definition['type'];
	if ( array_intersect( $expected, DATA_TYPES ) ) {
		return $value;
	}

	return wrap_value( $expected[0], $value );
}

/**
 * Wrap a plain value in an object of a schema type.
 *
 * URLs go in contentUrl or url when the type has one, other values in text or name.
 *
 * @param string                $type  Schema type.
 * @param string|int|float|bool $value Value.
 * @return array<string, mixed>
 */
function wrap_value( string $type, $value ) : array {
	$properties = SchemaTypes\get_type_properties( $type );

	$is_url = is_string( $value ) && preg_match( '#^https?://#i', $value ) && false !== filter_var( $value, FILTER_VALIDATE_URL );

	if ( $is_url && ( isset( $properties['contentUrl'] ) || isset( $properties['url'] ) ) ) {
		$key = isset( $properties['contentUrl'] ) ? 'contentUrl' : 'url';
	} else {
		$key = isset( $properties['text'] ) ? 'text' : 'name';
	}

	return [
		'@type' => $type,
		$key    => $value,
	];
}

/**
 * Whether a resolved value should be left out of the output.
 *
 * @param mixed $value Value.
 * @return bool
 */
function is_empty_value( $value ) : bool {
	return null === $value || '' === $value || [] === $value;
}
