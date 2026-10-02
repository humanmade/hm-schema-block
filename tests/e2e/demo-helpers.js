/**
 * Helpers for the recorded demo in demo.spec.js: a visible cursor, captions, a JSON-LD
 * panel for the front end, a timeline of the recording and the ffmpeg steps that turn
 * the recording into an MP4 and a GIF.
 *
 * @package
 */

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { spawnSync } = require( 'node:child_process' );

/**
 * Runs in every page of the recorded context. In the top document it draws the cursor,
 * the caption bar and, on request, the JSON-LD panel and the end card. Mouse events
 * inside same-origin iframes (the editor canvas) are mapped to top document coordinates.
 */
function overlayScript() {
	if ( window !== window.top ) {
		return;
	}

	const CSS = `
		#demo-cursor { position: fixed; left: 0; top: 0; width: 28px; height: 28px; z-index: 2147483647; pointer-events: none; transition: opacity .2s; opacity: 0; will-change: transform; }
		#demo-cursor.is-visible { opacity: 1; }
		.demo-ripple { position: fixed; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: rgba(255, 176, 0, .55); border: 2px solid rgba(255, 140, 0, .9); z-index: 2147483646; pointer-events: none; animation: demo-ripple .6s ease-out forwards; }
		@keyframes demo-ripple { from { transform: scale(.2); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
		#demo-caption { position: fixed; left: 0; right: var(--demo-right, 0px); bottom: 28px; display: flex; justify-content: center; z-index: 2147483645; pointer-events: none; }
		#demo-caption span { max-width: min(880px, calc(100% - 40px)); padding: 14px 30px; border-radius: 26px; background: rgba(16, 16, 20, .93); color: #fff; font: 600 25px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; letter-spacing: .01em; text-align: center; text-wrap: balance; box-shadow: 0 8px 30px rgba(0, 0, 0, .35); opacity: 0; transform: translateY(8px); transition: opacity .35s ease, transform .35s ease; }
		#demo-caption span.is-visible { opacity: 1; transform: none; }
		#demo-jsonld { position: fixed; top: var(--wp-admin--admin-bar--height, 0px); right: 0; bottom: 0; width: 520px; z-index: 2147483640; display: flex; flex-direction: column; background: #0f172a; color: #e2e8f0; box-shadow: -10px 0 30px rgba(0, 0, 0, .25); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
		#demo-jsonld h2 { margin: 0; padding: 18px 22px 14px; font: 700 19px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #fff; border-bottom: 1px solid #1e293b; }
		#demo-jsonld h2 small { display: block; margin-top: 2px; font-size: 13px; font-weight: 400; color: #94a3b8; }
		#demo-jsonld pre { flex: 1; margin: 0; padding: 16px 22px 120px; overflow: auto; font: 13.5px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; word-break: break-word; }
		#demo-jsonld .k { color: #7dd3fc; } #demo-jsonld .s { color: #86efac; } #demo-jsonld .n { color: #fcd34d; } #demo-jsonld .b { color: #f9a8d4; } #demo-jsonld .p { color: #64748b; }
		#demo-jsonld .t { color: #fda4af; font-weight: 700; }
		#demo-end { position: fixed; inset: 0; z-index: 2147483644; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; background: #111318; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; opacity: 0; transition: opacity .6s ease; }
		#demo-end.is-visible { opacity: 1; }
		#demo-end strong { font-size: 64px; font-weight: 700; letter-spacing: -.01em; }
		#demo-end span { font-size: 30px; color: #cbd5e1; }
		html.demo-shoot #demo-cursor, html.demo-shoot #demo-caption, html.demo-shoot .demo-ripple, html.demo-end #demo-cursor { display: none !important; }
		html.demo-compact #demo-jsonld pre { flex: none; overflow: visible; padding-bottom: 16px; font-size: 11.5px; line-height: 1.45; }
	`;

	const ARROW =
		'<svg viewBox="0 0 28 28" width="28" height="28" xmlns="http://www.w3.org/2000/svg"><path d="M4 2 L4 22 L9.5 17 L13 25.5 L16.6 24 L13.1 15.6 L20.5 15.6 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';

	let cursor;
	let position = null;
	try {
		position = JSON.parse( sessionStorage.getItem( 'demoCursor' ) );
	} catch {}

	const moveCursor = ( x, y ) => {
		position = { x, y };
		if ( cursor ) {
			cursor.style.transform = `translate(${ x - 4 }px, ${ y - 2 }px)`;
			cursor.classList.add( 'is-visible' );
		}
	};
	const ripple = ( x, y ) => {
		const dot = document.createElement( 'div' );
		dot.className = 'demo-ripple';
		dot.style.left = `${ x }px`;
		dot.style.top = `${ y }px`;
		document.body.appendChild( dot );
		setTimeout( () => dot.remove(), 700 );
	};

	const listen = ( target, offset ) => {
		target.addEventListener(
			'mousemove',
			( event ) => {
				const { x, y, scale = 1 } = offset();
				moveCursor(
					event.clientX * scale + x,
					event.clientY * scale + y
				);
			},
			true
		);
		target.addEventListener(
			'mousedown',
			( event ) => {
				const { x, y, scale = 1 } = offset();
				ripple( event.clientX * scale + x, event.clientY * scale + y );
			},
			true
		);
	};

	const hooked = new WeakSet();
	const hookFrames = () => {
		for ( const frame of document.querySelectorAll( 'iframe' ) ) {
			let doc;
			try {
				doc = frame.contentDocument;
			} catch {
				continue;
			}
			if ( ! doc || hooked.has( doc ) ) {
				continue;
			}
			hooked.add( doc );
			listen( doc, () => {
				const rect = frame.getBoundingClientRect();
				const scale = frame.clientWidth
					? rect.width / frame.clientWidth
					: 1;
				return { x: rect.left, y: rect.top, scale };
			} );
		}
	};

	const ensure = () => {
		if ( cursor || ! document.body ) {
			return;
		}
		const style = document.createElement( 'style' );
		style.textContent = CSS;
		document.head.appendChild( style );

		cursor = document.createElement( 'div' );
		cursor.id = 'demo-cursor';
		cursor.innerHTML = ARROW;
		document.body.appendChild( cursor );
		if ( position ) {
			moveCursor( position.x, position.y );
		}

		const bar = document.createElement( 'div' );
		bar.id = 'demo-caption';
		bar.appendChild( document.createElement( 'span' ) );
		document.body.appendChild( bar );

		listen( window, () => ( { x: 0, y: 0 } ) );
		setInterval( hookFrames, 250 );
		window.addEventListener( 'pagehide', () => {
			try {
				sessionStorage.setItem(
					'demoCursor',
					JSON.stringify( position )
				);
			} catch {}
		} );
	};

	const escape = ( text ) =>
		text.replace(
			/[&<>]/g,
			( char ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;' } )[ char ]
		);

	// Pretty-printed JSON with spans for keys, strings, numbers and literals.
	const highlight = ( data ) =>
		escape( JSON.stringify( data, null, 2 ) ).replace(
			/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)|([{}\[\],])/g,
			( match, string, colon, literal, number, punctuation ) => {
				if ( string && colon ) {
					const cls = string === '"@type"' ? 't' : 'k';
					return `<span class="${ cls }">${ string }</span>${ colon }`;
				}
				if ( string ) {
					return `<span class="s">${ string }</span>`;
				}
				if ( literal ) {
					return `<span class="b">${ literal }</span>`;
				}
				if ( number ) {
					return `<span class="n">${ number }</span>`;
				}
				return `<span class="p">${ punctuation }</span>`;
			}
		);

	window.__demo = {
		caption( text, instant = false ) {
			ensure();
			// Centre the caption over the editor canvas, clear of the sidebar.
			const bar = document.querySelector( '#demo-caption' );
			const content = document.querySelector(
				'.interface-interface-skeleton__content'
			);
			const rect = content?.getBoundingClientRect();
			bar.style.left = rect?.width ? `${ rect.left }px` : '';
			bar.style.right = rect?.width
				? `${ window.innerWidth - rect.right }px`
				: '';
			const span = bar.querySelector( 'span' );
			const show = () => {
				span.textContent = text || '';
				span.classList.toggle( 'is-visible', Boolean( text ) );
			};
			if ( instant || ! span.classList.contains( 'is-visible' ) ) {
				show();
				return;
			}
			span.classList.remove( 'is-visible' );
			setTimeout( show, 380 );
		},
		shoot( on ) {
			document.documentElement.classList.toggle( 'demo-shoot', on );
		},
		jsonLd() {
			ensure();
			const scripts = [
				...document.querySelectorAll(
					'script[type="application/ld+json"]'
				),
			];
			const data = scripts.map( ( script ) =>
				JSON.parse( script.textContent )
			);
			const panel = document.createElement( 'aside' );
			panel.id = 'demo-jsonld';
			panel.innerHTML = `<h2>Structured data on this page<small>script type="application/ld+json"</small></h2><pre>${ highlight(
				data.length === 1 ? data[ 0 ] : data
			) }</pre>`;
			document.body.appendChild( panel );
			document.documentElement.style.setProperty(
				'--demo-right',
				'520px'
			);
			document.body.style.marginRight = '520px';
		},
		// Smaller JSON that is not scrolled, for a screenshot. Returns the height it needs.
		compact( on ) {
			const panel = document.querySelector( '#demo-jsonld' );
			document.documentElement.classList.toggle( 'demo-compact', on );
			const pre = panel.querySelector( 'pre' );
			pre.scrollTop = 0;
			return (
				panel.getBoundingClientRect().top +
				panel.querySelector( 'h2' ).offsetHeight +
				pre.scrollHeight
			);
		},
		scrollPanel( duration ) {
			const pre = document.querySelector( '#demo-jsonld pre' );
			const distance = pre.scrollHeight - pre.clientHeight;
			const start = performance.now();
			return new Promise( ( resolve ) => {
				const step = ( now ) => {
					const progress = Math.min( 1, ( now - start ) / duration );
					const eased = 0.5 - Math.cos( progress * Math.PI ) / 2;
					pre.scrollTop = distance * eased;
					if ( progress < 1 ) {
						window.requestAnimationFrame( step );
					} else {
						resolve();
					}
				};
				window.requestAnimationFrame( step );
			} );
		},
		endCard( title, subtitle ) {
			ensure();
			const card = document.createElement( 'div' );
			card.id = 'demo-end';
			card.innerHTML = `<strong>${ escape(
				title
			) }</strong><span>${ escape( subtitle ) }</span>`;
			document.body.appendChild( card );
			document.documentElement.classList.add( 'demo-end' );
			window.requestAnimationFrame( () =>
				card.classList.add( 'is-visible' )
			);
		},
	};

	if ( document.body ) {
		ensure();
	} else {
		document.addEventListener( 'DOMContentLoaded', ensure );
	}
}

/**
 * Drives the recorded page at a watchable pace and keeps a timeline of the recording:
 * named marks and the off-camera intervals to cut out.
 */
class Demo {
	constructor( page ) {
		this.page = page;
		this.start = Date.now();
		this.marks = {};
		this.cuts = [];
		this.text = '';
	}

	now() {
		return ( Date.now() - this.start ) / 1000;
	}

	mark( name ) {
		this.marks[ name ] = this.now();
	}

	pause( ms = 900 ) {
		return this.page.waitForTimeout( ms );
	}

	async caption( text, hold = 2200 ) {
		this.text = text;
		await this.page.evaluate( ( t ) => window.__demo.caption( t ), text );
		await this.pause( hold );
	}

	// Puts the current caption back after a navigation, without a fade.
	async restore() {
		await this.page.waitForFunction( () => window.__demo );
		await this.page.evaluate(
			( t ) => window.__demo.caption( t, true ),
			this.text
		);
	}

	async goto( url ) {
		await this.page.goto( url );
		await this.restore();
	}

	async moveTo( locator, steps = 24 ) {
		await locator.scrollIntoViewIfNeeded();
		const box = await locator.boundingBox();
		await this.page.mouse.move(
			box.x + box.width / 2,
			box.y + box.height / 2,
			{ steps }
		);
		await this.pause( 200 );
	}

	async click( locator, after = 700 ) {
		await this.moveTo( locator );
		await locator.click();
		await this.pause( after );
	}

	async type( text, delay = 40 ) {
		await this.page.keyboard.type( text, { delay } );
		await this.pause( 500 );
	}

	// Runs work that should not be in the video; the interval is cut out when encoding.
	async offCamera( work ) {
		// eslint-disable-next-line @wordpress/no-unused-vars-before-return -- used in finally.
		const from = this.now();
		try {
			return await work();
		} finally {
			this.cuts.push( [ from, this.now() ] );
		}
	}

	// Takes screenshots with the cursor and caption hidden, off camera.
	async shoot( work ) {
		await this.offCamera( async () => {
			await this.page.evaluate( () => {
				window.__demo.shoot( true );
				// eslint-disable-next-line @wordpress/no-global-active-element -- no node ref in page.evaluate.
				document.activeElement?.blur();
			} );
			await this.pause( 150 );
			try {
				await work();
			} finally {
				await this.page.evaluate( () => window.__demo.shoot( false ) );
				await this.pause( 150 );
			}
		} );
	}

	async showJsonLd() {
		await this.page.evaluate( () => window.__demo.jsonLd() );
		await this.pause( 600 );
	}

	async scrollPanel( duration ) {
		await this.page.evaluate(
			( ms ) => window.__demo.scrollPanel( ms ),
			duration
		);
	}

	async endCard( title, subtitle, hold = 4000 ) {
		await this.page.evaluate( ( t ) => window.__demo.caption( t ), '' );
		await this.page.evaluate(
			( [ t, s ] ) => window.__demo.endCard( t, s ),
			[ title, subtitle ]
		);
		await this.pause( hold );
	}

	/**
	 * The parts of the recording to keep, from the "start" mark to the "end" mark minus
	 * the off-camera intervals, with a small margin around each cut.
	 *
	 * @return {Array} [ from, to ] pairs in seconds of the recording.
	 */
	segments() {
		const margin = 0.25;
		const keep = [];
		let from = this.marks.start;
		const cuts = this.cuts
			.map( ( [ a, b ] ) => [ a - margin, b + margin ] )
			.filter( ( [ , b ] ) => b > from )
			.sort( ( x, y ) => x[ 0 ] - y[ 0 ] );
		for ( const [ a, b ] of cuts ) {
			if ( a > from ) {
				keep.push( [ from, Math.min( a, this.marks.end ) ] );
			}
			from = Math.max( from, b );
		}
		if ( from < this.marks.end ) {
			keep.push( [ from, this.marks.end ] );
		}
		return keep;
	}

	// Maps a time in the recording to the time in the cut video.
	outputTime( t ) {
		let total = 0;
		for ( const [ a, b ] of this.segments() ) {
			if ( t <= a ) {
				break;
			}
			total += Math.min( t, b ) - a;
		}
		return total;
	}
}

function ffmpeg( args ) {
	const result = spawnSync(
		'ffmpeg',
		[ '-y', '-loglevel', 'error', ...args ],
		{
			encoding: 'utf8',
		}
	);
	if ( result.error || result.status !== 0 ) {
		throw new Error(
			`ffmpeg failed: ${ result.error?.message || result.stderr }`
		);
	}
}

/**
 * Cuts the recording to the kept segments and writes demo.mp4, then makes demo.gif from
 * parts of it, each sped up by its own factor.
 *
 * @param {Demo}   demo     The demo, with its timeline.
 * @param {string} webm     Path of the recording.
 * @param {string} outDir   Directory for demo.mp4 and demo.gif.
 * @param {Array}  gifParts [ from mark, to mark, speed ] for each part of the GIF.
 */
function encode( demo, webm, outDir, gifParts ) {
	fs.mkdirSync( outDir, { recursive: true } );
	const between = demo
		.segments()
		.map(
			( [ a, b ] ) => `between(t,${ a.toFixed( 3 ) },${ b.toFixed( 3 ) })`
		)
		.join( '+' );
	const mp4 = path.join( outDir, 'demo.mp4' );
	ffmpeg( [
		'-i',
		webm,
		'-vf',
		`select='${ between }',setpts=N/FRAME_RATE/TB`,
		'-r',
		'25',
		'-an',
		'-c:v',
		'libx264',
		'-preset',
		'slow',
		'-crf',
		'26',
		'-pix_fmt',
		'yuv420p',
		'-movflags',
		'+faststart',
		mp4,
	] );

	const labels = gifParts.map( ( part, index ) => `p${ index }` );
	const parts = gifParts.map( ( [ from, to, speed ], index ) => {
		const a = demo.outputTime( demo.marks[ from ] ).toFixed( 2 );
		const b = demo.outputTime( demo.marks[ to ] ).toFixed( 2 );
		return `[s${ index }]trim=start=${ a }:end=${ b },setpts=(PTS-STARTPTS)/${ speed }[${ labels[ index ] }]`;
	} );
	const filter = [
		`[0:v]split=${ gifParts.length }${ labels
			.map( ( label, index ) => `[s${ index }]` )
			.join( '' ) }`,
		...parts,
		`${ labels
			.map( ( label ) => `[${ label }]` )
			.join(
				''
			) }concat=n=${ gifParts.length }:v=1:a=0,fps=12,scale=800:-1:flags=lanczos,split[a][b]`,
		'[a]palettegen=max_colors=128:stats_mode=diff[p]',
		'[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
	].join( ';' );
	ffmpeg( [
		'-i',
		mp4,
		'-filter_complex',
		filter,
		'-loop',
		'0',
		path.join( outDir, 'demo.gif' ),
	] );
}

module.exports = { overlayScript, Demo, encode };
