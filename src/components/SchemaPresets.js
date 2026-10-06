/**
 * Quick setup buttons: apply a preset type to a container and smart defaults to its inner blocks.
 */

/* eslint-disable @wordpress/no-unsafe-wp-apis -- Layout components are only exported as experimental. */

import {
	BaseControl,
	Button,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { getPresetsFor, getTreeDefaults } from '../utils/smart-defaults';

const SchemaPresets = ( { clientId, blockName, schemaOrg } ) => {
	const { getBlocks, hasInnerBlocks } = useSelect(
		( select ) => ( {
			getBlocks: select( blockEditorStore ).getBlocks,
			hasInnerBlocks:
				select( blockEditorStore ).getBlockCount( clientId ) > 0,
		} ),
		[ clientId ]
	);
	const { updateBlockAttributes, __unstableMarkLastChangeAsPersistent } =
		useDispatch( blockEditorStore );

	const apply = ( blockSchemaOrg ) => {
		const updates = {
			...getTreeDefaults( getBlocks( clientId ), blockSchemaOrg.type ),
			[ clientId ]: blockSchemaOrg,
		};
		const clientIds = Object.keys( updates );

		// Close the previous undo level so each preset can be undone on its own.
		__unstableMarkLastChangeAsPersistent();
		updateBlockAttributes(
			clientIds,
			Object.fromEntries(
				clientIds.map( ( id ) => [ id, { schemaOrg: updates[ id ] } ] )
			),
			{ uniqueByBlock: true }
		);
	};

	const presets = getPresetsFor( blockName );
	const showPresets = presets.length > 0 && ! schemaOrg.isProperty;
	const showReapply = Boolean( schemaOrg.type ) && hasInnerBlocks;

	if ( ! showPresets && ! showReapply ) {
		return null;
	}

	return (
		<VStack spacing={ 4 }>
			{ showPresets && (
				<BaseControl
					__nextHasNoMarginBottom
					help={ __(
						'Sets the schema type and maps the inner blocks, e.g. accordion items or details blocks become questions or steps.',
						'schema-org-blocks'
					) }
				>
					<VStack spacing={ 2 }>
						<BaseControl.VisualLabel>
							{ __( 'Quick setup', 'schema-org-blocks' ) }
						</BaseControl.VisualLabel>
						<HStack wrap spacing={ 2 } justify="flex-start">
							{ presets.map( ( [ key, preset ] ) => (
								<Button
									key={ key }
									variant="secondary"
									size="compact"
									isPressed={
										schemaOrg.type === preset.schemaOrg.type
									}
									onClick={ () => apply( preset.schemaOrg ) }
								>
									{ preset.label }
								</Button>
							) ) }
						</HStack>
					</VStack>
				</BaseControl>
			) }

			{ showReapply && (
				<HStack justify="flex-start">
					<Button variant="link" onClick={ () => apply( schemaOrg ) }>
						{ __(
							'Apply suggested mappings to inner blocks',
							'schema-org-blocks'
						) }
					</Button>
				</HStack>
			) }
		</VStack>
	);
};

export default SchemaPresets;
