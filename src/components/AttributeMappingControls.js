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

					{ /* Source is inferred and shown as read-only text.
					     Attribute source shows a picker; content source is implicit. */ }
					{ mapping.source === 'attribute' && (
						<SelectControl
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

					{ mapping.source === 'content' && (
						<p
							style={ {
								fontSize: '12px',
								color: '#757575',
								marginTop: '0',
							} }
						>
							{ __(
								'Source: block content',
								'schema-org-blocks'
							) }
						</p>
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
