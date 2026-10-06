/**
 * Schema Type Selector Component
 *
 * @package
 */

/* eslint-disable @wordpress/no-unsafe-wp-apis -- Layout components are only exported as experimental. */

import {
	SelectControl,
	ToggleControl,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
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

	// Types offered: for a property block, object types the property accepts (and their
	// subtypes); otherwise every type.
	const availableTypes = useMemo( () => {
		if ( ! schemaTypes ) {
			return [];
		}

		let typeNames = Object.keys( schemaTypes );

		if ( isProperty ) {
			const accepted = [].concat(
				schemaProperties?.[ parentSchemaType ]?.[ propertyName ]
					?.type || []
			);
			typeNames = typeNames.filter( ( typeName ) =>
				accepted.some(
					( type ) =>
						type === typeName ||
						isSubtypeOf( typeName, type, schemaTypes )
				)
			);
		}

		return typeNames.map( ( typeName ) => ( {
			label: schemaTypes[ typeName ].label || typeName,
			value: typeName,
		} ) );
	}, [
		isProperty,
		parentSchemaType,
		propertyName,
		schemaTypes,
		schemaProperties,
	] );

	// Get available property names if parent has schema type.
	const availableProperties = useMemo( () => {
		if ( ! parentSchemaType || ! schemaProperties ) {
			return [];
		}

		const properties = schemaProperties[ parentSchemaType ] || {};
		return Object.entries( properties ).map(
			( [ propName, propConfig ] ) => ( {
				label: propConfig.label || propName,
				value: propName,
			} )
		);
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
		<VStack spacing={ 4 }>
			{ parentSchemaType && availableProperties.length > 0 && (
				<>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ sprintf(
							/* translators: %s: label of the parent block's schema type. */
							__(
								'Use as a property of %s',
								'schema-org-blocks'
							),
							schemaTypes?.[ parentSchemaType ]?.label ||
								parentSchemaType
						) }
						checked={ isProperty }
						onChange={ handlePropertyToggle }
						help={ __(
							"This block's content becomes the value of a property of the parent.",
							'schema-org-blocks'
						) }
					/>

					{ isProperty && (
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label={ __( 'Property Name', 'schema-org-blocks' ) }
							value={ propertyName || '' }
							options={ [
								{
									label: __(
										'Select a property…',
										'schema-org-blocks'
									),
									value: '',
								},
								...availableProperties,
							] }
							onChange={ ( prop ) =>
								onPropertyChange( prop, true )
							}
							help={ __(
								'Save the post to apply.',
								'schema-org-blocks'
							) }
						/>
					) }
				</>
			) }

			{ ( ! isProperty || availableTypes.length > 0 ) && (
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={
						isProperty
							? __( 'Value Type', 'schema-org-blocks' )
							: __( 'Schema Type', 'schema-org-blocks' )
					}
					value={ value || '' }
					options={ [
						{ label: __( 'None', 'schema-org-blocks' ), value: '' },
						...availableTypes,
					] }
					onChange={ handleTypeChange }
					help={
						isProperty
							? __(
									"Pick a type to output this property as a nested object. Leave as None to use the block's text.",
									'schema-org-blocks'
								)
							: __(
									'Select a schema.org type for this block',
									'schema-org-blocks'
								)
					}
				/>
			) }
		</VStack>
	);
};

/**
 * Check if a type is a subtype of another.
 *
 * @param {string} type        Type to check.
 * @param {string} parentType  Parent type.
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
