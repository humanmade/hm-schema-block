/**
 * Quick setup buttons: apply a preset type to a container and smart defaults to its inner blocks.
 */

import { BaseControl, Button } from '@wordpress/components';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import {
	PRESETS,
	PRESET_BLOCKS,
	getTreeDefaults,
} from '../utils/smart-defaults';

const SchemaPresets = ( { clientId, blockName, schemaOrg } ) => {
	const { getBlocks, hasInnerBlocks } = useSelect(
		( select ) => ( {
			getBlocks: select( blockEditorStore ).getBlocks,
			hasInnerBlocks:
				select( blockEditorStore ).getBlockCount( clientId ) > 0,
		} ),
		[ clientId ]
	);
	const { updateBlockAttributes } = useDispatch( blockEditorStore );

	const apply = ( blockSchemaOrg ) => {
		const updates = {
			...getTreeDefaults( getBlocks( clientId ), blockSchemaOrg.type ),
			[ clientId ]: blockSchemaOrg,
		};
		const clientIds = Object.keys( updates );

		updateBlockAttributes(
			clientIds,
			Object.fromEntries(
				clientIds.map( ( id ) => [ id, { schemaOrg: updates[ id ] } ] )
			),
			{ uniqueByBlock: true }
		);
	};

	const showPresets =
		PRESET_BLOCKS.includes( blockName ) && ! schemaOrg.isProperty;
	const showReapply = Boolean( schemaOrg.type ) && hasInnerBlocks;

	if ( ! showPresets && ! showReapply ) {
		return null;
	}

	return (
		<div className="schema-org-blocks-presets">
			{ showPresets && (
				<BaseControl
					id={ `schema-org-blocks-presets-${ clientId }` }
					label={ __( 'Quick setup', 'schema-org-blocks' ) }
					help={ __(
						'Sets the schema type and maps the inner blocks, e.g. accordion items or details blocks become questions or steps.',
						'schema-org-blocks'
					) }
				>
					<div className="schema-org-blocks-presets__buttons">
						{ Object.entries( PRESETS ).map(
							( [ key, preset ] ) => (
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
							)
						) }
					</div>
				</BaseControl>
			) }

			{ showReapply && (
				<Button
					variant="link"
					onClick={ () => apply( schemaOrg ) }
					className="schema-org-blocks-presets__reapply"
				>
					{ __(
						'Apply suggested mappings to inner blocks',
						'schema-org-blocks'
					) }
				</Button>
			) }
		</div>
	);
};

export default SchemaPresets;
