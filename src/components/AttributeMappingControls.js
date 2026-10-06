/**
 * Schema Property Mapping Controls Component
 *
 * @package
 */

/* eslint-disable @wordpress/no-unsafe-wp-apis -- ToolsPanel is only exported as experimental. */

import {
	SelectControl,
	TextControl,
	__experimentalToolsPanel as ToolsPanel,
	__experimentalToolsPanelItem as ToolsPanelItem,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';

import { toEntityId } from './EntityControls';

const AttributeMappingControls = ( {
	attributes,
	schemaType,
	mappings,
	onChange,
	claimedProperties = [],
} ) => {
	const { schemaProperties } = window.schemaOrgBlocksData || {};

	// Properties available for this schema type, minus any already claimed by child blocks.
	// Properties that already have a mapping stay listed so they can be changed or removed.
	const properties = useMemo( () => {
		const typeProperties = schemaProperties?.[ schemaType ] || {};
		const list = Object.entries( typeProperties )
			.filter(
				( [ propName ] ) =>
					! claimedProperties.includes( propName ) ||
					mappings[ propName ]
			)
			.map( ( [ propName, propConfig ] ) => ( {
				label: propConfig.label || propName,
				value: propName,
			} ) );

		Object.keys( mappings )
			.filter( ( propName ) => ! typeProperties[ propName ] )
			.forEach( ( propName ) =>
				list.push( { label: propName, value: propName } )
			);

		return list;
	}, [ schemaType, schemaProperties, claimedProperties, mappings ] );

	// Block attributes available as mapping sources (excludes schemaOrg itself).
	const availableAttributes = useMemo( () => {
		if ( ! attributes ) {
			return [];
		}

		return Object.keys( attributes )
			.filter( ( attr ) => attr !== 'schemaOrg' )
			.map( ( attr ) => ( {
				label: formatAttributeName( attr ),
				value: attr,
			} ) );
	}, [ attributes ] );

	// Infer source: use attribute if the block has mappable attributes, content otherwise.
	const addMapping = ( property ) => {
		onChange( {
			...mappings,
			[ property ]:
				availableAttributes.length > 0
					? {
							source: 'attribute',
							attributeName: availableAttributes[ 0 ].value,
						}
					: { source: 'content' },
		} );
	};

	const updateMapping = ( property, updates ) => {
		onChange( {
			...mappings,
			[ property ]: {
				...( mappings[ property ] || {} ),
				...updates,
			},
		} );
	};

	const removeMapping = ( property ) => {
		const newMappings = { ...mappings };
		delete newMappings[ property ];
		onChange( newMappings );
	};

	if ( properties.length === 0 ) {
		return null;
	}

	return (
		<ToolsPanel
			label={ __( 'Schema.org properties', 'schema-org-blocks' ) }
			resetAll={ () => onChange( {} ) }
		>
			{ properties.map( ( { label, value: property } ) => {
				const mapping = mappings[ property ] || {};

				return (
					<ToolsPanelItem
						key={ property }
						label={ label }
						hasValue={ () => !! mappings[ property ] }
						onSelect={ () => addMapping( property ) }
						onDeselect={ () => removeMapping( property ) }
					>
						<VStack spacing={ 4 }>
							<SelectControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								label={ label }
								value={ getSourceKey( mapping ) }
								options={ SOURCES }
								onChange={ ( key ) =>
									updateMapping(
										property,
										parseSourceKey( key )
									)
								}
							/>

							{ getSourceKey( mapping ) === CUSTOM_REFERENCE && (
								<TextControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={ __(
										'Linked entity ID',
										'schema-org-blocks'
									) }
									value={ mapping.id || '' }
									onChange={ ( id ) =>
										updateMapping( property, {
											id: toEntityId( id ),
										} )
									}
									help={ __(
										'The Entity ID set on the block to link to.',
										'schema-org-blocks'
									) }
								/>
							) }

							{ mapping.source === 'attribute' && (
								<SelectControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={ __(
										'Attribute',
										'schema-org-blocks'
									) }
									value={ mapping.attributeName || '' }
									options={ [
										{
											label: __(
												'Select attribute…',
												'schema-org-blocks'
											),
											value: '',
										},
										...availableAttributes,
									] }
									onChange={ ( attributeName ) =>
										updateMapping( property, {
											attributeName,
										} )
									}
									help={ __(
										'Leave empty to use block content instead.',
										'schema-org-blocks'
									) }
								/>
							) }
						</VStack>
					</ToolsPanelItem>
				);
			} ) }
		</ToolsPanel>
	);
};

/**
 * Source picker value for a reference to an entity id typed by hand.
 */
const CUSTOM_REFERENCE = 'reference:__custom';

/**
 * Mapping sources offered in the Source picker. `post:` keys carry the post field.
 */
const SOURCES = [
	{ label: __( 'Block attribute', 'schema-org-blocks' ), value: 'attribute' },
	{ label: __( 'Block text', 'schema-org-blocks' ), value: 'content' },
	{
		label: __( 'Inner blocks text', 'schema-org-blocks' ),
		value: 'innerBlocks',
	},
	{ label: __( 'Post title', 'schema-org-blocks' ), value: 'post:title' },
	{ label: __( 'Post URL', 'schema-org-blocks' ), value: 'post:url' },
	{ label: __( 'Post date', 'schema-org-blocks' ), value: 'post:date' },
	{
		label: __( 'Post modified date', 'schema-org-blocks' ),
		value: 'post:modified',
	},
	{ label: __( 'Post excerpt', 'schema-org-blocks' ), value: 'post:excerpt' },
	{ label: __( 'Post author', 'schema-org-blocks' ), value: 'post:author' },
	{
		label: __( 'Post featured image', 'schema-org-blocks' ),
		value: 'post:image',
	},
	{ label: __( 'Site name', 'schema-org-blocks' ), value: 'site:name' },
	{
		label: __( 'Site tagline', 'schema-org-blocks' ),
		value: 'site:description',
	},
	{ label: __( 'Site URL', 'schema-org-blocks' ), value: 'site:url' },
	{ label: __( 'Site logo', 'schema-org-blocks' ), value: 'site:logo' },
	{
		label: __( 'Site language', 'schema-org-blocks' ),
		value: 'site:language',
	},
	{
		label: __( 'Link to site Organization', 'schema-org-blocks' ),
		value: 'reference:organization',
	},
	{
		label: __( 'Link to site Web site', 'schema-org-blocks' ),
		value: 'reference:website',
	},
	{
		label: __( 'Link to another entity by ID', 'schema-org-blocks' ),
		value: CUSTOM_REFERENCE,
	},
];

/**
 * Get the Source picker value for a mapping.
 *
 * @param {Object} mapping Property mapping.
 * @return {string} Source key.
 */
function getSourceKey( mapping ) {
	if ( mapping.source === 'reference' ) {
		const key = `reference:${ mapping.id }`;
		return SOURCES.some( ( source ) => source.value === key )
			? key
			: CUSTOM_REFERENCE;
	}
	if ( mapping.source === 'post' || mapping.source === 'site' ) {
		return `${ mapping.source }:${
			mapping.field || ( mapping.source === 'post' ? 'title' : 'name' )
		}`;
	}
	return mapping.source;
}

/**
 * Turn a Source picker value into mapping fields.
 *
 * @param {string} key Source key.
 * @return {Object} Mapping fields to merge.
 */
function parseSourceKey( key ) {
	if ( key === CUSTOM_REFERENCE ) {
		return {
			source: 'reference',
			id: '',
			field: undefined,
			attributeName: undefined,
		};
	}
	const [ source, detail ] = key.split( ':' );
	return {
		source,
		field: source === 'reference' ? undefined : detail,
		id: source === 'reference' ? detail : undefined,
		// Keep the attribute only while the source is an attribute.
		...( source === 'attribute' ? {} : { attributeName: undefined } ),
	};
}

/**
 * Format attribute name for display.
 *
 * @param {string} attr Attribute name.
 * @return {string} Formatted name.
 */
function formatAttributeName( attr ) {
	return attr
		.replace( /([A-Z])/g, ' $1' )
		.replace( /^./, ( str ) => str.toUpperCase() )
		.trim();
}

export default AttributeMappingControls;
