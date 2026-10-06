/**
 * Schema Type Selector Component
 *
 * @package
 */

/* eslint-disable @wordpress/no-unsafe-wp-apis -- Layout components are only exported as experimental. */

import {
	BaseControl,
	ComboboxControl,
	SelectControl,
	ToggleControl,
	__experimentalText as Text,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';

import { DATA_TYPES } from './EntityControls';
import { propertyAcceptsType } from '../utils/smart-defaults';

const NONE = '__none';
const MAX_TOGGLE_OPTIONS = 3;

/**
 * Types a property of a parent type accepts.
 *
 * @param {string} parentType   Schema type that has the property.
 * @param {string} propertyName Property name.
 * @return {{types: string[], acceptsData: boolean}} Object types the property accepts, including
 *                                                   subtypes, and whether it also accepts plain data types.
 */
function getAcceptedTypes( parentType, propertyName ) {
	const { schemaTypes = {}, schemaProperties = {} } =
		window.schemaOrgBlocksData || {};
	const accepted = [].concat(
		schemaProperties[ parentType ]?.[ propertyName ]?.type || []
	);

	return {
		types: Object.keys( schemaTypes ).filter( ( typeName ) =>
			accepted.some(
				( type ) =>
					type === typeName ||
					isSubtypeOf( typeName, type, schemaTypes )
			)
		),
		acceptsData: accepted.some( ( type ) => DATA_TYPES.includes( type ) ),
	};
}

/**
 * The only type a property can hold, or null when it accepts several types or plain data.
 *
 * @param {string} parentType   Schema type that has the property.
 * @param {string} propertyName Property name.
 * @return {string|null} Schema type, or null.
 */
export function getLockedValueType( parentType, propertyName ) {
	const { types, acceptsData } = getAcceptedTypes( parentType, propertyName );

	return types.length === 1 && ! acceptsData ? types[ 0 ] : null;
}

/**
 * A value shown as plain text in place of a picker with a single choice.
 *
 * @param {Object} props       Component props.
 * @param {string} props.label Visual label.
 * @param {string} props.value Text to show.
 * @param {string} props.help  Optional help text.
 */
const ReadOnlyValue = ( { label, value, help } ) => (
	<BaseControl __nextHasNoMarginBottom help={ help }>
		<VStack spacing={ 2 }>
			<BaseControl.VisualLabel>{ label }</BaseControl.VisualLabel>
			<Text>{ value }</Text>
		</VStack>
	</BaseControl>
);

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

		const typeNames = isProperty
			? getAcceptedTypes( parentSchemaType, propertyName ).types
			: Object.keys( schemaTypes );

		return typeNames.map( ( typeName ) => ( {
			label: schemaTypes[ typeName ].label || typeName,
			value: typeName,
		} ) );
	}, [ isProperty, parentSchemaType, propertyName, schemaTypes ] );

	// Properties of the parent type. A typed block is offered only those that accept its type.
	const availableProperties = useMemo( () => {
		if ( ! parentSchemaType || ! schemaProperties ) {
			return [];
		}

		const entries = Object.entries(
			schemaProperties[ parentSchemaType ] || {}
		);
		const accepting = value
			? entries.filter(
					( [ propName ] ) =>
						propName === propertyName ||
						propertyAcceptsType( parentSchemaType, propName, value )
				)
			: entries;

		return ( accepting.length > 0 ? accepting : entries ).map(
			( [ propName, propConfig ] ) => ( {
				label: propConfig.label || propName,
				value: propName,
			} )
		);
	}, [ parentSchemaType, schemaProperties, value, propertyName ] );

	const handleTypeChange = ( newType ) => {
		onChange( newType && newType !== NONE ? newType : null );
	};

	const handlePropertyToggle = ( enabled ) => {
		if ( enabled && availableProperties.length > 0 ) {
			onPropertyChange( availableProperties[ 0 ].value, true );
		} else {
			onPropertyChange( null, false );
		}
	};

	const lockedProperty =
		value &&
		availableProperties.length === 1 &&
		availableProperties[ 0 ].value === propertyName
			? availableProperties[ 0 ]
			: null;

	const lockedType = isProperty
		? getLockedValueType( parentSchemaType, propertyName )
		: null;

	const typeHelp = isProperty
		? __(
				"Pick a type to output this property as a nested object. Leave as None to use the block's text.",
				'schema-org-blocks'
			)
		: __( 'Select a schema.org type for this block', 'schema-org-blocks' );

	const renderTypeControl = () => {
		if ( lockedType ) {
			return (
				<ReadOnlyValue
					label={ __( 'Value Type', 'schema-org-blocks' ) }
					value={ schemaTypes?.[ lockedType ]?.label || lockedType }
					help={ __(
						'This property only accepts this type.',
						'schema-org-blocks'
					) }
				/>
			);
		}

		if ( ! isProperty ) {
			return (
				<ComboboxControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Schema Type', 'schema-org-blocks' ) }
					value={ value || null }
					options={ availableTypes }
					onChange={ handleTypeChange }
					help={ typeHelp }
				/>
			);
		}

		if ( availableTypes.length === 0 ) {
			return null;
		}

		const options = [
			{
				label: __( 'None (use block text)', 'schema-org-blocks' ),
				value: NONE,
			},
			...availableTypes,
		];

		if ( options.length <= MAX_TOGGLE_OPTIONS ) {
			return (
				<ToggleGroupControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					isBlock
					label={ __( 'Value Type', 'schema-org-blocks' ) }
					value={ value || NONE }
					onChange={ handleTypeChange }
					help={ typeHelp }
				>
					{ options.map( ( option ) => (
						<ToggleGroupControlOption
							key={ option.value }
							value={ option.value }
							label={ option.label }
						/>
					) ) }
				</ToggleGroupControl>
			);
		}

		return (
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Value Type', 'schema-org-blocks' ) }
				value={ value || NONE }
				options={ options }
				onChange={ handleTypeChange }
				help={ typeHelp }
			/>
		);
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

					{ isProperty &&
						( lockedProperty ? (
							<ReadOnlyValue
								label={ __(
									'Property Name',
									'schema-org-blocks'
								) }
								value={ lockedProperty.label }
								help={ __(
									'This is the only property of the parent that accepts this type. Save the post to apply.',
									'schema-org-blocks'
								) }
							/>
						) : (
							<SelectControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								label={ __(
									'Property Name',
									'schema-org-blocks'
								) }
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
						) ) }
				</>
			) }

			{ renderTypeControl() }
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
