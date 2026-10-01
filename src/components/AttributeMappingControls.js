/**
 * Schema Property Mapping Controls Component
 *
 * @package
 */

import { SelectControl, Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { plus, trash } from '@wordpress/icons';

const AttributeMappingControls = ( {
	attributes,
	schemaType,
	mappings,
	onChange,
	claimedProperties = [],
} ) => {
	const { schemaProperties } = window.schemaOrgBlocksData || {};

	// Properties available for this schema type, minus any already claimed by child blocks.
	const availableProperties = useMemo( () => {
		if (
			! schemaType ||
			! schemaProperties ||
			! schemaProperties[ schemaType ]
		) {
			return [];
		}

		return Object.entries( schemaProperties[ schemaType ] )
			.filter(
				( [ propName ] ) => ! claimedProperties.includes( propName )
			)
			.map( ( [ propName, propConfig ] ) => ( {
				label: propConfig.label || propName,
				value: propName,
				type: propConfig.type,
			} ) );
	}, [ schemaType, schemaProperties, claimedProperties ] );

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

	const addMapping = () => {
		const unmappedProperty = availableProperties.find(
			( prop ) => ! mappings[ prop.value ]
		);
		if ( ! unmappedProperty ) {
			return;
		}

		// Infer source: use attribute if the block has mappable attributes, content otherwise.
		const hasAttributes = availableAttributes.length > 0;
		const newMappings = {
			...mappings,
			[ unmappedProperty.value ]: hasAttributes
				? {
						source: 'attribute',
						attributeName: availableAttributes[ 0 ]?.value || '',
					}
				: { source: 'content' },
		};

		onChange( newMappings );
	};

	const updateMapping = ( property, updates ) => {
		const newMappings = {
			...mappings,
			[ property ]: {
				...( mappings[ property ] || {} ),
				...updates,
			},
		};

		onChange( newMappings );
	};

	const removeMapping = ( property ) => {
		const newMappings = { ...mappings };
		delete newMappings[ property ];
		onChange( newMappings );
	};

	const currentMappings = Object.entries( mappings );

	return (
		<div className="schema-org-blocks-attribute-mapping">
			<div className="schema-org-blocks-attribute-mapping__header">
				<strong>
					{ __( 'Schema Property Mapping', 'schema-org-blocks' ) }
				</strong>
				<Button
					icon={ plus }
					label={ __( 'Add mapping', 'schema-org-blocks' ) }
					onClick={ addMapping }
					variant="secondary"
					size="small"
					disabled={
						currentMappings.length >= availableProperties.length
					}
				/>
			</div>

			{ currentMappings.length === 0 && (
				<Notice status="info" isDismissible={ false }>
					{ __(
						"No property mappings configured. Add mappings to populate schema properties from this block's own data. Child blocks can be assigned to properties via their own Schema.org Mapping settings.",
						'schema-org-blocks'
					) }
				</Notice>
			) }

			{ currentMappings.map( ( [ property, mapping ] ) => (
				<div
					key={ property }
					className="schema-org-blocks-attribute-mapping__row"
				>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Schema Property', 'schema-org-blocks' ) }
						value={ property }
						options={ [
							{ label: property, value: property },
							...availableProperties.filter(
								( p ) =>
									! mappings[ p.value ] ||
									p.value === property
							),
						] }
						onChange={ ( newProp ) => {
							if ( newProp !== property ) {
								const newMappings = { ...mappings };
								delete newMappings[ property ];
								newMappings[ newProp ] = mapping;
								onChange( newMappings );
							}
						} }
					/>

					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Source', 'schema-org-blocks' ) }
						value={ getSourceKey( mapping ) }
						options={ SOURCES }
						onChange={ ( key ) =>
							updateMapping( property, parseSourceKey( key ) )
						}
					/>

					{ mapping.source === 'attribute' && (
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label={ __( 'Attribute', 'schema-org-blocks' ) }
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
								updateMapping( property, { attributeName } )
							}
							help={ __(
								'Leave empty to use block content instead.',
								'schema-org-blocks'
							) }
						/>
					) }

					<Button
						icon={ trash }
						label={ __( 'Remove mapping', 'schema-org-blocks' ) }
						onClick={ () => removeMapping( property ) }
						variant="secondary"
						isDestructive
						size="small"
					/>
				</div>
			) ) }
		</div>
	);
};

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
		label: __( 'Link to site Organization', 'schema-org-blocks' ),
		value: 'reference:organization',
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
		return `reference:${ mapping.id }`;
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
	const [ source, detail ] = key.split( ':' );
	return {
		source,
		field: source === 'reference' ? undefined : detail,
		id: source === 'reference' ? detail : undefined,
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
