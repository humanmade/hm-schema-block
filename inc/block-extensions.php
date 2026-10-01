<?php
/**
 * Block extensions for schema.org mapping, and building schema objects from blocks.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\BlockExtensions;

use SchemaOrgBlocks\BlockValues;
use SchemaOrgBlocks\SchemaTypes;

/**
 * Schema.org data types. Properties that accept one of these take plain values.
 */
const DATA_TYPES = [ 'Text', 'URL', 'Number', 'Integer', 'Float', 'Boolean', 'Date', 'DateTime', 'Time', 'Duration' ];

/**
 * Register the schemaOrg attribute and context on every block type.
 */
function register_block_context() : void {
	add_filter( 'register_block_type_args', __NAMESPACE__ . '\\add_schema_org_attribute', 10, 2 );
	add_filter( 'register_block_type_args', __NAMESPACE__ . '\\add_block_context', 10, 2 );
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
 * Add block context support for schema.org types.
 *
 * @param array<string, mixed> $args       Block type registration args.
 * @param string               $block_name Block name.
 * @return array<string, mixed>
 */
function add_block_context( array $args, string $block_name ) : array {
	$args['provides_context']                   = $args['provides_context'] ?? [];
	$args['provides_context']['schemaOrg/type'] = 'schemaOrg';

	$args['uses_context'] = array_values( array_unique( array_merge( $args['uses_context'] ?? [], [ 'schemaOrg/type' ] ) ) );

	return $args;
}

/**
 * Get a block's schemaOrg configuration with every key present and typed.
 *
 * @param array<string, mixed> $block Parsed block.
 * @return array{type: ?string, mappings: array<string, mixed>, isProperty: bool, propertyName: ?string}
 */
function get_config( array $block ) : array {
	$config = $block['attrs']['schemaOrg'] ?? [];
	$config = is_array( $config ) ? $config : [];

	return [
		'type'         => is_string( $config['type'] ?? null ) && '' !== $config['type'] ? $config['type'] : null,
		'mappings'     => is_array( $config['mappings'] ?? null ) ? $config['mappings'] : [],
		'isProperty'   => ! empty( $config['isProperty'] ),
		'propertyName' => is_string( $config['propertyName'] ?? null ) && '' !== $config['propertyName'] ? $config['propertyName'] : null,
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
 * Build schema objects for every standalone typed block in a parsed block tree.
 *
 * @param array<int, array<string, mixed>> $blocks Parsed blocks.
 * @return array<int, array<string, mixed>>
 */
function extract_schema( array $blocks ) : array {
	$schema = [];

	foreach ( $blocks as $block ) {
		if ( is_hidden( $block ) ) {
			continue;
		}

		if ( is_entity( $block ) ) {
			$object = build_schema_object( $block );
			if ( $object ) {
				$schema[] = $object;
			}
		}

		$schema = array_merge( $schema, extract_schema( BlockValues\get_inner_blocks( $block ) ) );
	}

	return $schema;
}

/**
 * Build the schema object for a typed block.
 *
 * Values come from the block's own mappings, then from direct inner blocks marked as
 * properties. A child with its own type becomes a nested object. Several children for the
 * same property produce an array. Child values replace a mapping for the same property.
 *
 * @param array<string, mixed> $block Parsed block.
 * @return array<string, mixed> The object, or an empty array when it has no properties.
 */
function build_schema_object( array $block ) : array {
	$config = get_config( $block );
	$type   = $config['type'];

	if ( null === $type ) {
		return [];
	}

	$object = [ '@type' => $type ];

	foreach ( $config['mappings'] as $property => $mapping ) {
		$value = resolve_mapping( $block, is_array( $mapping ) ? $mapping : [] );
		if ( ! is_empty_value( $value ) ) {
			$object[ $property ] = coerce_value( $type, $property, $value );
		}
	}

	$from_children = [];

	foreach ( BlockValues\get_inner_blocks( $block ) as $child ) {
		$child_config = get_config( $child );
		$property     = $child_config['propertyName'];

		if ( ! $child_config['isProperty'] || null === $property || is_hidden( $child ) ) {
			continue;
		}

		$value = null !== $child_config['type']
			? build_schema_object( $child )
			: get_property_value( $child, $property );

		if ( ! is_empty_value( $value ) ) {
			$from_children[ $property ][] = coerce_value( $type, $property, $value );
		}
	}

	foreach ( $from_children as $property => $values ) {
		$object[ $property ] = 1 === count( $values ) ? $values[0] : $values;
	}

	return count( $object ) > 1 ? $object : [];
}

/**
 * Get the value an untyped property block gives its parent.
 *
 * Uses the block's mapping for that property when there is one, otherwise its text content.
 *
 * @param array<string, mixed> $block    Parsed block.
 * @param string               $property Property name.
 * @return string|int|float|bool|null
 */
function get_property_value( array $block, string $property ) {
	$mapping = get_config( $block )['mappings'][ $property ] ?? null;

	if ( is_array( $mapping ) ) {
		return resolve_mapping( $block, $mapping );
	}

	return BlockValues\get_text( BlockValues\get_html( $block ) );
}

/**
 * Resolve a property mapping against a block.
 *
 * Sources: `attribute` (a block attribute; with no attribute name, the block's text),
 * `content` (the block's text), `innerBlocks` (the text of its inner blocks only, e.g. a
 * details block without its summary) and `post` (a field of the current post: `title` or `url`).
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $mapping Mapping, e.g. [ 'source' => 'attribute', 'attributeName' => 'url' ].
 * @return string|int|float|bool|null
 */
function resolve_mapping( array $block, array $mapping ) {
	$source         = $mapping['source'] ?? '';
	$attribute_name = $mapping['attributeName'] ?? '';

	if ( 'attribute' === $source && is_string( $attribute_name ) && '' !== $attribute_name ) {
		return BlockValues\get_attribute( $block, $attribute_name );
	}

	if ( 'attribute' === $source || 'content' === $source ) {
		return BlockValues\get_text( BlockValues\get_html( $block ) );
	}

	if ( 'innerBlocks' === $source ) {
		$html = array_map( 'SchemaOrgBlocks\\BlockValues\\get_html', BlockValues\get_inner_blocks( $block ) );
		return BlockValues\get_text( implode( "\n", $html ) );
	}

	if ( 'post' === $source ) {
		return get_post_field_value( (string) ( $mapping['field'] ?? 'title' ) );
	}

	return null;
}

/**
 * Get a field of the current post for a `post` mapping.
 *
 * @param string $field `title` or `url`.
 * @return string|null
 */
function get_post_field_value( string $field ) : ?string {
	$post = get_post();

	if ( ! $post ) {
		return null;
	}

	switch ( $field ) {
		case 'title':
			return BlockValues\get_text( get_the_title( $post ) );
		case 'url':
			return get_permalink( $post ) ?: null;
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

	$target     = $expected[0];
	$properties = SchemaTypes\get_type_properties( $target );

	$is_url = is_string( $value ) && preg_match( '#^https?://#i', $value ) && false !== filter_var( $value, FILTER_VALIDATE_URL );

	if ( $is_url && ( isset( $properties['contentUrl'] ) || isset( $properties['url'] ) ) ) {
		$key = isset( $properties['contentUrl'] ) ? 'contentUrl' : 'url';
	} else {
		$key = isset( $properties['text'] ) ? 'text' : 'name';
	}

	return [
		'@type' => $target,
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
