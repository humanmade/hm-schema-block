/**
 * Schema Type Selector Component
 *
 * @package SchemaOrgBlocks
 */

import { SelectControl, ToggleControl, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';

const SchemaTypeSelector = ( {
	value,
	onChange,
	parentSchemaType,
	isProperty,
	propertyName,
	onPropertyChange,
} ) => {
	const { schemaTypes, schemaProperties } = window.schemaOrgBlocksData || {};

	// Get available schema types based on context.
	const availableTypes = useMemo( () => {
		if ( ! schemaTypes ) {
			return [];
		}

		// If there's a parent schema type, filter to valid subtypes.
		if ( parentSchemaType ) {
			const parentProperties = schemaProperties?.[ parentSchemaType ] || {};
			const validTypes = new Set();

			// Add types that are valid for parent properties.
			Object.entries( parentProperties ).forEach( ( [ propName, propConfig ] ) => {
				const propTypes = Array.isArray( propConfig.type )
					? propConfig.type
					: [ propConfig.type ];

				propTypes.forEach( ( type ) => {
					validTypes.add( type );
					// Also add subtypes.
					Object.entries( schemaTypes ).forEach( ( [ typeName, typeConfig ] ) => {
						if ( isSubtypeOf( typeName, type, schemaTypes ) ) {
							validTypes.add( typeName );
						}
					} );
				} );
			} );

			return Array.from( validTypes ).map( ( type ) => ( {
				label: schemaTypes[ type ]?.label || type,
				value: type,
			} ) );
		}

		// Otherwise, show all top-level types.
		return Object.entries( schemaTypes ).map( ( [ typeName, typeConfig ] ) => ( {
			label: typeConfig.label || typeName,
			value: typeName,
		} ) );
	}, [ parentSchemaType, schemaTypes, schemaProperties ] );

	// Get available property names if parent has schema type.
	const availableProperties = useMemo( () => {
		if ( ! parentSchemaType || ! schemaProperties ) {
			return [];
		}

		const properties = schemaProperties[ parentSchemaType ] || {};
		return Object.entries( properties ).map( ( [ propName, propConfig ] ) => ( {
			label: propConfig.label || propName,
			value: propName,
		} ) );
	}, [ parentSchemaType, schemaProperties ] );

	const handleTypeChange = ( newType ) => {
		onChange( newType || null );
	};

	const handlePropertyToggle = ( enabled ) => {
		if ( enabled && availableProperties.length > 0 ) {
			onPropertyChange( availableProperties[ 0 ].value, true );
		} else {
			onPropertyChange( null, false );
		}
	};

	return (
		<div className="schema-org-blocks-type-selector">
			{ parentSchemaType && (
				<Notice status="info" isDismissible={ false }>
					{ __( 'Parent block has schema type: ', 'schema-org-blocks' ) }
					<strong>{ parentSchemaType }</strong>
				</Notice>
			) }

			{ parentSchemaType && availableProperties.length > 0 && (
				<>
					<ToggleControl
						label={ __( 'Map as property of parent', 'schema-org-blocks' ) }
						checked={ isProperty }
						onChange={ handlePropertyToggle }
						help={ __(
							'Set this block as a specific property of the parent schema object',
							'schema-org-blocks'
						) }
					/>

					{ isProperty && (
						<SelectControl
							label={ __( 'Property Name', 'schema-org-blocks' ) }
							value={ propertyName || '' }
							options={ [
								{ label: __( 'Select a property...', 'schema-org-blocks' ), value: '' },
								...availableProperties,
							] }
							onChange={ ( prop ) => onPropertyChange( prop, true ) }
						/>
					) }
				</>
			) }

			{ ! isProperty && (
				<SelectControl
					label={ __( 'Schema Type', 'schema-org-blocks' ) }
					value={ value || '' }
					options={ [
						{ label: __( 'None', 'schema-org-blocks' ), value: '' },
						...availableTypes,
					] }
					onChange={ handleTypeChange }
					help={
						parentSchemaType
							? __(
									'Select a schema type or leave empty to use parent type',
									'schema-org-blocks'
							  )
							: __( 'Select a schema.org type for this block', 'schema-org-blocks' )
					}
				/>
			) }
		</div>
	);
};

/**
 * Check if a type is a subtype of another.
 *
 * @param {string} type Type to check.
 * @param {string} parentType Parent type.
 * @param {Object} schemaTypes All schema types.
 * @return {boolean} Whether type is subtype of parentType.
 */
function isSubtypeOf( type, parentType, schemaTypes ) {
	if ( ! schemaTypes[ type ] ) {
		return false;
	}

	let currentParent = schemaTypes[ type ].parent;

	while ( currentParent ) {
		if ( currentParent === parentType ) {
			return true;
		}
		currentParent = schemaTypes[ currentParent ]?.parent;
	}

	return false;
}

export default SchemaTypeSelector;
