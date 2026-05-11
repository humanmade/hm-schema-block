/**
 * Attribute Mapping Controls Component
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
} ) => {
	const { schemaProperties } = window.schemaOrgBlocksData || {};

	// Get available properties for the schema type.
	const availableProperties = useMemo( () => {
		if (
			! schemaType ||
			! schemaProperties ||
			! schemaProperties[ schemaType ]
		) {
			return [];
		}

		return Object.entries( schemaProperties[ schemaType ] ).map(
			( [ propName, propConfig ] ) => ( {
				label: propConfig.label || propName,
				value: propName,
				type: propConfig.type,
			} )
		);
	}, [ schemaType, schemaProperties ] );

	// Get available block attributes.
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
		if ( availableProperties.length === 0 ) {
			return;
		}

		// Find first unmapped property.
		const unmappedProperty = availableProperties.find(
			( prop ) => ! mappings[ prop.value ]
		);

		if ( ! unmappedProperty ) {
			return;
		}

		const newMappings = {
			...mappings,
			[ unmappedProperty.value ]: {
				source: 'attribute',
				attributeName: availableAttributes[ 0 ]?.value || '',
			},
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
					{ __( 'Attribute Mappings', 'schema-org-blocks' ) }
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
				<Notice status="warning" isDismissible={ false }>
					{ __(
						'No attribute mappings configured. Add mappings to include block data in schema output.',
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
						options={ availableProperties }
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
						label={ __( 'Source', 'schema-org-blocks' ) }
						value={ mapping.source || 'attribute' }
						options={ [
							{
								label: __(
									'Block Attribute',
									'schema-org-blocks'
								),
								value: 'attribute',
							},
							{
								label: __(
									'Block Content',
									'schema-org-blocks'
								),
								value: 'content',
							},
							{
								label: __(
									'Child Blocks',
									'schema-org-blocks'
								),
								value: 'context',
							},
						] }
						onChange={ ( source ) =>
							updateMapping( property, { source } )
						}
					/>

					{ mapping.source === 'attribute' && (
						<SelectControl
							label={ __(
								'Attribute Name',
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
								updateMapping( property, { attributeName } )
							}
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
