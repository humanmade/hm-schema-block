/**
 * Graph settings of a typed block: its entity id and the property its inner entities nest under.
 */

import { SelectControl, TextControl } from '@wordpress/components';
import { useMemo } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Schema.org data types. Properties that only accept these hold plain values, not entities.
 */
const DATA_TYPES = [
	'Text',
	'URL',
	'Number',
	'Integer',
	'Float',
	'Boolean',
	'Date',
	'DateTime',
	'Time',
	'Duration',
];

const EMPTY = {};
const DEFAULT = '__default';
const NONE = '__none';

/**
 * Turn typed text into an entity id: lowercase letters, digits, dashes and underscores.
 *
 * @param {string} value Typed value.
 * @return {string} Entity id.
 */
export function toEntityId( value ) {
	return value
		.toLowerCase()
		.replace( /\s+/g, '-' )
		.replace( /[^a-z0-9_-]/g, '' );
}

const EntityControls = ( { schemaOrg, onChange } ) => {
	const properties =
		window.schemaOrgBlocksData?.schemaProperties?.[ schemaOrg.type ] ??
		EMPTY;

	const entityProperties = useMemo(
		() =>
			Object.entries( properties )
				.filter( ( [ , config ] ) =>
					[]
						.concat( config.type )
						.some( ( type ) => ! DATA_TYPES.includes( type ) )
				)
				.map( ( [ name, config ] ) => ( {
					label: config.label || name,
					value: name,
				} ) ),
		[ properties ]
	);

	let containsValue = DEFAULT;
	if ( schemaOrg.contains === '' ) {
		containsValue = NONE;
	} else if ( schemaOrg.contains ) {
		containsValue = schemaOrg.contains;
	}

	const defaultLabel = properties.hasPart
		? sprintf(
				/* translators: %s: property label, e.g. Has Part. */
				__( 'Default (%s)', 'schema-org-blocks' ),
				properties.hasPart.label || 'hasPart'
			)
		: __( 'Default (none)', 'schema-org-blocks' );

	return (
		<div className="schema-org-blocks-entity-controls">
			<TextControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Entity ID', 'schema-org-blocks' ) }
				value={ schemaOrg.id || '' }
				onChange={ ( value ) =>
					onChange( { id: toEntityId( value ) || undefined } )
				}
				help={ __(
					'Names this entity so other blocks can link to it, e.g. organization or website. It is output as @id: the site URL followed by #id.',
					'schema-org-blocks'
				) }
			/>
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Nest inner entities as', 'schema-org-blocks' ) }
				value={ containsValue }
				options={ [
					{ label: defaultLabel, value: DEFAULT },
					{
						label: __(
							'None (keep them as separate nodes)',
							'schema-org-blocks'
						),
						value: NONE,
					},
					...entityProperties,
				] }
				onChange={ ( value ) => {
					if ( value === DEFAULT ) {
						onChange( { contains: undefined } );
					} else {
						onChange( { contains: value === NONE ? '' : value } );
					}
				} }
				help={ __(
					'Typed blocks inside this one, including the post content in a template, are nested under this property.',
					'schema-org-blocks'
				) }
			/>
		</div>
	);
};

export default EntityControls;
