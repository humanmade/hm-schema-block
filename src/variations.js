/**
 * Inserter variations of core/accordion that come set up as an FAQ or a how-to.
 */

import { registerBlockVariation } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { formatListNumbered, help } from '@wordpress/icons';

import { PRESETS, getSmartDefaults } from './utils/smart-defaults';

/**
 * Add smart default schemaOrg attributes to an inner blocks template.
 *
 * @param {Array}  template   Inner blocks template: [ name, attributes, innerBlocks ] items.
 * @param {string} parentType Schema type of the block the template belongs to.
 * @return {Array} Template with schemaOrg attributes.
 */
function withDefaults( template, parentType ) {
	return template.map( ( [ name, attributes = {}, innerBlocks = [] ] ) => {
		const schemaOrg = parentType
			? getSmartDefaults( name, parentType )
			: null;

		return [
			name,
			schemaOrg ? { ...attributes, schemaOrg } : attributes,
			withDefaults( innerBlocks, schemaOrg?.type ),
		];
	} );
}

/**
 * Inner blocks for one accordion item.
 *
 * @param {string} placeholder Placeholder for the panel paragraph.
 * @return {Array} Template item.
 */
function item( placeholder ) {
	return [
		'core/accordion-item',
		{},
		[
			[ 'core/accordion-heading' ],
			[
				'core/accordion-panel',
				{},
				[ [ 'core/paragraph', { placeholder } ] ],
			],
		],
	];
}

const answer = __( 'Write the answer…', 'schema-org-blocks' );
const step = __( 'Describe this step…', 'schema-org-blocks' );

registerBlockVariation( 'core/accordion', {
	name: 'schema-org-faq',
	title: __( 'FAQ', 'schema-org-blocks' ),
	description: __(
		'Questions and answers, output as FAQPage structured data.',
		'schema-org-blocks'
	),
	icon: help,
	keywords: [ __( 'questions', 'schema-org-blocks' ), 'schema' ],
	attributes: { schemaOrg: PRESETS.faq.schemaOrg },
	innerBlocks: withDefaults(
		[ item( answer ), item( answer ) ],
		PRESETS.faq.schemaOrg.type
	),
	isActive: ( attributes ) =>
		attributes.schemaOrg?.type === PRESETS.faq.schemaOrg.type,
	scope: [ 'inserter' ],
} );

registerBlockVariation( 'core/accordion', {
	name: 'schema-org-how-to',
	title: __( 'How-to', 'schema-org-blocks' ),
	description: __(
		'Steps to complete a task, output as HowTo structured data named after the post.',
		'schema-org-blocks'
	),
	icon: formatListNumbered,
	keywords: [ __( 'steps', 'schema-org-blocks' ), 'schema' ],
	attributes: { schemaOrg: PRESETS.howTo.schemaOrg },
	innerBlocks: withDefaults(
		[ item( step ), item( step ) ],
		PRESETS.howTo.schemaOrg.type
	),
	isActive: ( attributes ) =>
		attributes.schemaOrg?.type === PRESETS.howTo.schemaOrg.type,
	scope: [ 'inserter' ],
} );
