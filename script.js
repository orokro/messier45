/*
	script.js
	---------

	We'll write the application logic all in this single script.js file.

	This will run the animations as well as the scratcher system.
*/

/**
 * Define Configuration Constants
 */
const CONFIG = {

	// sound asset paths
	sounds: {
		door: 'sfx/door.mp3',
		footsteps: 'sfx/footsteps.mp3',
		woosh: 'sfx/woosh.mp3',
		yay: 'sfx/yay.mp3'
	},

	// the images we need to load
	images: {

		// main scene
		bg: 'img/bg.png',
		girls: 'img/girls.png',
		glowing: 'img/glowing_tickets.png',
		ticketBase: 'img/ticket_base.png',
		ticketCover: 'img/ticket_covered.png',

		// Dialogue Assets
		bubble1: 'img/speech_bubble_1.png',
		bubble2: 'img/speech_bubble_2.png',
		bubble3: 'img/speech_bubble_3.png',
		bubble4: 'img/speech_bubble_4.png',
		bubble5: 'img/speech_bubble_5.png',
		bubble6: 'img/speech_bubble_6.png',
		bubbleWin1: 'img/speech_bubble_win_1.png',
		bubbleWin2: 'img/speech_bubble_win_2.png'
	},

	// icon name slugs and positions
	icons: [
		'BONE', 'FOOT', 'JAW', 'RIB', 'SKULL', 'SPIKE', 'SPINE'
	],

	// layout coordinates
	coords: {

		// for the icon spawning
		rows: [467, 589, 711],
		cols: [91, 251, 411, 571],
		iconW: 160,
		iconH: 122,

		// for the prize generation text
		textBox: { x: 91, y: 862, w: 637, h: 98 } 
	}
};


// --- State Management ---
const State = {

	// which game are we on. We'll use this to determine when to give out prizes
	count: 0,

	// when is the next target game
	nextTargetIndex: 2 + Math.floor(Math.random() * 3), 

	// prize data, including index to loop thru prizes
	prizes: [],
	prizeIndex: 0,

	// store our loaded assets
	audio: {},
	assets: {},

	// Audio Settings
	masterVolume: 1.0,
	isMuted: false,
	audioCtx: null,
	scratchGain: null,
	bgmObj: null,

	// Dialogue State, including which pair of speech bubbles to show
	cycleIndex: 0, 
	loserPairs: [
		['img/speech_bubble_1.png', 'img/speech_bubble_2.png'],
		['img/speech_bubble_3.png', 'img/speech_bubble_4.png'],
		['img/speech_bubble_5.png', 'img/speech_bubble_6.png']
	],
	winnerPair: ['img/speech_bubble_win_1.png', 'img/speech_bubble_win_2.png'],
	dialogueTimers: [],
};


/**
 * Audio Control Setup
 */
function setupAudioControls() {

	// Get DOM Elements
	const slider = document.getElementById('volume-slider');
	const muteBtn = document.getElementById('mute-btn');
	const iconOn = document.getElementById('icon-sound-on');
	const iconOff = document.getElementById('icon-sound-off');

	// Slider Interaction
	slider.addEventListener('input', (e) => {
		State.masterVolume = parseFloat(e.target.value);
		if (State.masterVolume > 0 && State.isMuted) {
			toggleMute(false);
		}
		updateAllVolumes();
	});

	// Mute Interaction
	muteBtn.addEventListener('click', () => {
		toggleMute(!State.isMuted);
	});

	// Mute Toggle Function
	function toggleMute(mute) {

		State.isMuted = mute;
		if (mute) {
			iconOn.style.display = 'none';
			iconOff.style.display = 'block';
		} else {
			iconOn.style.display = 'block';
			iconOff.style.display = 'none';
		}
		updateAllVolumes();
	}
}


/**
 * Update all audio volumes based on current settings
 */
function updateAllVolumes() {

	const vol = State.isMuted ? 0 : State.masterVolume;

	if (State.bgmObj)
		State.bgmObj.volume = 0.6 * vol; 
}


/**
 * Audio System Initialization
 * 
 * We'll also use procedural audio generation for the scratch sound effect.
 */
function initAudioSystem() {

	// find and cache AudioContext
	const AudioContext = window.AudioContext || window.webkitAudioContext;
	State.audioCtx = new AudioContext();

	// create buffer for white noise based scratch sound
	const bufferSize = State.audioCtx.sampleRate * 2; 
	const buffer = State.audioCtx.createBuffer(1, bufferSize, State.audioCtx.sampleRate);
	const data = buffer.getChannelData(0);

	// Generate pink noise using Paul Kellet's method
	let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
	for (let i = 0; i < bufferSize; i++) {
		const white = Math.random() * 2 - 1;
		b0 = 0.99886 * b0 + white * 0.0555179;
		b1 = 0.99332 * b1 + white * 0.0750759;
		b2 = 0.96900 * b2 + white * 0.1538520;
		b3 = 0.86650 * b3 + white * 0.3104856;
		b4 = 0.55000 * b4 + white * 0.5329522;
		b5 = -0.7616 * b5 - white * 0.0168980;
		data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
		data[i] *= 0.11; 
		b6 = white * 0.115926;
	}

	// Create buffer source
	const noise = State.audioCtx.createBufferSource();
	noise.buffer = buffer;
	noise.loop = true;

	State.scratchGain = State.audioCtx.createGain();
	State.scratchGain.gain.value = 0; 

	// Create bandpass filter to shape the noise
	const filter = State.audioCtx.createBiquadFilter();
	filter.type = 'bandpass';
	filter.frequency.value = 800;

	noise.connect(filter);
	filter.connect(State.scratchGain);
	State.scratchGain.connect(State.audioCtx.destination);
	
	// Start the noise source as soon as possible
	noise.start(0);
}

// Scratch Sound Playback Control
let scratchTimeout = null;

/**
 * Play the scratch sound effect
 * 
 * @returns void
 */
function playScratchSound() {

	// GTFO if audio system not ready
	if (!State.audioCtx || !State.scratchGain)
		return;
	
	// get our volume settings
	const globalVol = State.isMuted ? 0 : State.masterVolume;
	const targetVol = 0.4 * globalVol; 

	// ramp up quickly with the gain node
	State.scratchGain.gain.setTargetAtTime(targetVol, State.audioCtx.currentTime, 0.05);

	// set a timeout to ramp down after a short delay
	if (scratchTimeout)
		clearTimeout(scratchTimeout);

	scratchTimeout = setTimeout(() => {
		State.scratchGain.gain.setTargetAtTime(0, State.audioCtx.currentTime, 0.1);
	}, 100); 
}


/**
 * Play a sound effect by name
 * 
 * @param {String} name - audio asset name
 * @param {Number} vol - volume multiplier (0.0 - 1.0)
 * @returns {Audio|null} - the audio object played or null if not found
 */
function playSfx(name, vol=1.0) {

	// get the cached asset & volume settings
	const aud = State.assets[name];
	const globalVol = State.isMuted ? 0 : State.masterVolume;

	// play it at the desired volume
	if (aud) {
		aud.volume = vol * globalVol;
		aud.currentTime = 0;
		aud.play().catch(e => console.log("Audio play error", e));
		return aud;
	}
	return null;
}


/**
 * Load Prize Data from JSON file
 */
async function loadData() {

	try {
		const req = await fetch('data.json');
		const json = await req.json();
		
		if (json.xmas && Array.isArray(json.xmas))
			State.prizes = json.xmas.map(str => atob(str));
		else
			State.prizes = ["ERROR-NO-DATA"];
		
	} catch (e) {
		console.error(e);
		State.prizes = ["OFFLINE-MODE"];
	}
}


/**
 * Initialization Function
 * 
 * We'll load all assets here before starting the main experience.
 */
async function init() {
	console.log("Starting Initialization...");
	
	// load all images, audio, data, and fonts
	const imagePromises = Object.entries(CONFIG.images).map(([key, src]) => loadImage(key, src));
	const iconPromises = CONFIG.icons.map(name => loadImage(name, `img/icons/${name}.png`));
	const audioPromises = Object.entries(CONFIG.sounds).map(([key, src]) => loadAudio(key, src));
	const dataPromise = loadData();
	const fontPromise = document.fonts.load('40px "VT323"');

	// wait for everything to be ready
	await Promise.all([...imagePromises, ...iconPromises, ...audioPromises, dataPromise, fontPromise]);

	// start BGM music playback
	State.bgmObj = new Audio('sfx/bgm.mp3');
	State.bgmObj.volume = 0.6; 
	State.bgmObj.loop = true;

	// rest of setup, incl. audio controls and start screen
	setupAudioControls(); 
	setupStartScreen();
}


/**
 * Setup the Start Screen Button
 */
function setupStartScreen() {

	// get the container for our loading text
	const loaderContent = document.getElementById('loader-content');
	loaderContent.innerHTML = ''; 

	// set up the begin game button
	const btn = document.createElement('button');
	btn.id = 'start-btn';
	btn.innerText = 'Click to Open';
	btn.onclick = () => {
		initAudioSystem();
		updateAllVolumes();
		State.bgmObj.play().catch(e => console.log("BGM Blocked", e));
		playSfx('door', 0.01); 
		startIntro();
	};
	loaderContent.appendChild(btn);
}


/**
 * Kicks off the intro animation sequence
 */
function startIntro() {

	// get relevant DOM elements
	const loader = document.getElementById('loader');
	const scene = document.getElementById('scene');
	const girls = document.getElementById('girls-component');

	// fade out loader, CSS transition will handle the rest
	loader.style.opacity = '0';
	
	// show audio controls after a delay
	setTimeout(() => {
		document.getElementById('audio-controls').classList.add('visible');
	}, 1000);

	// after fade out, remove loader and start scene animation
	setTimeout(() => {

		// destroy loader element & show the scene
		loader.remove();
		scene.style.opacity = '1';
		
		// play the convenience store door opening sound & food steps
		playSfx('door');
		const steps = playSfx('footsteps');
		if(steps) steps.loop = true;

		// start animation sequence after a short delay
		setTimeout(() => {

			// this will trigger the CSS animation
			girls.classList.add('animate-enter');

			// after animation duration, finalize position and start dialogue
			setTimeout(() => {

				// stop footsteps sound
				if(steps){
					steps.pause();
					steps.currentTime = 0;
				}

				// finish up girls animation with final position
				girls.style.animation = 'none'; 
				girls.classList.remove('animate-enter');
				girls.classList.add('girls-final-pos');

				// start the dialogue sequence
				triggerDialogueSequence();

			}, 4000); 
		}, 500);
	}, 1000);

}


/**
 * Start the dialogue sequence animating speech bubbles and enabling ticket spawn
 * 
 * @param {boolean} isSuccess - whether to show the winning dialogue, optional, default false
 */
function triggerDialogueSequence(isSuccess = false) {

	// reset any existing timers and get relevant DOM elements
	clearDialogueTimers(); 

	// get DOM elements
	const b1 = document.getElementById('bubble-1');
	const b2 = document.getElementById('bubble-2');
	const hitbox = document.getElementById('glowing-tickets-hitbox');

	// get the image sources for the dialog, based on if the ticket was a winner or a loser
	let src1, src2;
	if (isSuccess) {
		src1 = State.winnerPair[0];
		src2 = State.winnerPair[1];
	} else {
		const pair = State.loserPairs[State.cycleIndex];
		src1 = pair[0];
		src2 = pair[1];
		State.cycleIndex = (State.cycleIndex + 1) % State.loserPairs.length;
	}

	// update the speech bubble images
	b1.src = src1;
	b2.src = src2;

	// use some timing to animate the dialogue bubbles in sequence
	State.dialogueTimers.push(setTimeout(() => {

		// show first bubble
		b1.classList.add('visible');
		State.dialogueTimers.push(setTimeout(() => {

			// show second bubble
			b2.classList.add('visible');

			// if first run this will fade in the glowing tickets
			const tickets = document.getElementById('glowing-tickets-img');
			tickets.style.opacity = '1';
			tickets.classList.add('tickets-active');

		}, 1000));
	}, 500));
	
	// enable the hitbox for spawning tickets
	hitbox.style.pointerEvents = 'auto';

	// set the click handler to spawn tickets
	hitbox.onclick = spawnTicket;
}

/**
 * Clear any existing dialogue timers
 */
function clearDialogueTimers() {
	State.dialogueTimers.forEach(t => clearTimeout(t));
	State.dialogueTimers = [];
}


/**
 * Hide the dialogue bubbles
 */
function hideDialogue() {

	// stop any existing timers and hide the bubbles
	clearDialogueTimers(); 

	// hide the speech bubbles and disable ticket hitbox
	document.getElementById('bubble-1').classList.remove('visible');
	document.getElementById('bubble-2').classList.remove('visible');
	document.getElementById('glowing-tickets-hitbox').style.pointerEvents = 'none';
}


/**
 * Helpers to load image assets
 * 
 * @param {String} key - asset key
 * @param {String} src - image source path
 * @returns {Promise<Image>} - promise that resolves with the loaded image
 */
function loadImage(key, src) {

	// return promise so we can promise.all later
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => { State.assets[key] = img; resolve(img); };
		img.onerror = reject;
		img.src = src;
	});
}

/**
 * Helpers to load audio assets
 * 
 * @param {String} name - asset name
 * @param {String} src - audio source path
 * @returns {Promise<Audio>} - promise that resolves when audio is loaded
 */
function loadAudio(name, src) {

	// return promise so we can promise.all later
	return new Promise((resolve) => {
		const aud = new Audio(src);
		aud.preload = 'auto';
		aud.addEventListener('canplaythrough', () => { State.assets[name] = aud; resolve(); }, { once: true });
		aud.onerror = () => resolve();
		setTimeout(() => resolve(), 2000); 
	});
}


/**
 * Spawn a new scratcher ticket on screen
 */
function spawnTicket() {

	// play sound and hide dialogue if any
	playSfx('woosh');
	hideDialogue(); 

	// determine if this ticket is a target ticket (i.e. a winner)
	const isTarget = (State.count === State.nextTargetIndex);
	let prizeStr = null;

	// if target, get the prize string
	if (isTarget) {

		// Get current prize based on index
		if (State.prizes.length > 0) {

			// get the prize & increment for next time (to loop thru prizes)
			prizeStr = State.prizes[State.prizeIndex];
			State.prizeIndex = (State.prizeIndex + 1) % State.prizes.length;

		} else {
			prizeStr = "ERROR";
		}
	}

	// create the scratcher ticket with the target status and prize string
	new ScratcherTicket(isTarget, prizeStr);

	// if target ticket, set the next target index
	if (isTarget) {
		State.nextTargetIndex = State.count + 2 + Math.floor(Math.random() * 4);
		console.log(`Target met. Next target at #${State.nextTargetIndex}`);
	}
	State.count++;
}


/**
 * Scratcher Ticket Component Class
 */
class ScratcherTicket {

	/**
	 * Constructs a new Scratcher Ticket
	 * 
	 * @param {Boolean} isTarget - whether this ticket is a target (winner)
	 * @param {String} prizeStr - the prize string for this ticket
	 */
	constructor(isTarget, prizeStr) {

		// save our properties
		this.isTarget = isTarget;
		this.prizeStr = prizeStr;

		// generate the state for our grid of icons and prize text
		this.gridData = this.generateGrid(isTarget);

		// build our DOM element & add to container
		this.element = this.createDOM();
		this.container = document.getElementById('ticket-overlay-container');
		this.container.appendChild(this.element);
		
		// on next frame, slide it into view via CSS transition
		requestAnimationFrame(() => {
			this.element.style.transform = 'translateY(0)';
		});

		// in order to trigger if the target icons are fully scratched, we need to track which quadrants have been scratched
		// each winner icon is divided into 4 quadrants, and we track them in a 2D array
		// when the mouse scratches over an icon, we mark the relevant quadrant as scratched
		this.scratchedQuadrants = new Array(12).fill(0).map(() => [false, false, false, false]); 

		// true after we detect all target icon quadrants scratched
		this.targetRevealed = false;
	}


	/**
	 * Spawns the grid of icons for this ticket, either as a winner or loser
	 * 
	 * @param {Boolean} isTarget - whether this ticket is a target (winner)
	 * @returns {Array} - array of icon names for the 12 grid positions
	 */
	generateGrid(isTarget) {

		// get our icon names and prepare grid array
		const iconNames = CONFIG.icons;
		let grid = new Array(12).fill(null);

		// if it's a winner, place 3 matching icons randomly
		if (isTarget) {

			// pick an icon to win
			const winIcon = iconNames[Math.floor(Math.random() * iconNames.length)];

			// pick 3 unique random positions for the winning icons to be placed
			let places = [];
			while(places.length < 3) {
				let r = Math.floor(Math.random() * 12);
				if(!places.includes(r)) places.push(r);
			}
			this.targetIndices = places;
			places.forEach(p => grid[p] = winIcon);

			// fill the rest of the array with random icons, but not the winning icon
			const otherIcons = iconNames.filter(n => n !== winIcon);
			let deck = [];
			otherIcons.forEach(n => { deck.push(n); deck.push(n); });

			// shuffle the deck
			for (let i = deck.length - 1; i > 0; i--) {
				
				const j = Math.floor(Math.random() * (i + 1));
				[deck[i], deck[j]] = [deck[j], deck[i]];

			}// next i

			// fill in the grid with remaining icons
			for(let i=0; i<12; i++) {

				if(grid[i] === null)
					grid[i] = deck.pop(); 

			}// next i

			return grid;

		// otherwise, if it's a loser, just fill with random pairs
		} else {

			// create and shuffle a deck of icon pairs, making 6 pairs total (no triples)
			let deck = [];
			iconNames.forEach(name => { deck.push(name); deck.push(name); });
			
			for (let i = deck.length - 1; i > 0; i--) {
			
				const j = Math.floor(Math.random() * (i + 1));
				[deck[i], deck[j]] = [deck[j], deck[i]];
			
			}// next i

			this.targetIndices = [];
			return deck.slice(0, 12);
		}
	}


	/**
	 * Procedurally creates the DOM element for this ticket
	 * 
	 * @returns {HTMLElement} - the DOM element for this ticket
	 */
	createDOM() {

		// first make the outermost wrapper div & apply styles
		const wrapper = document.createElement('div');
		wrapper.className = 'scratcher-ticket';

		// make the close button
		const closeBtn = document.createElement('div');
		closeBtn.className = 'close-btn';
		closeBtn.innerHTML = '✖';
		closeBtn.onclick = () => this.close();
		wrapper.appendChild(closeBtn);

		// we'll use a canvas in memory to compose the ticket background
		const bgCanvas = document.createElement('canvas');
		bgCanvas.width = 817;
		bgCanvas.height = 1024;
		const ctx = bgCanvas.getContext('2d');

		// draw the base image directly onto the canvas
		if (State.assets.ticketBase) 
			ctx.drawImage(State.assets.ticketBase, 0, 0);

		// loop to draw our prize icons on the canvas
		this.gridData.forEach((iconName, index) => {
			const row = Math.floor(index / 4); 
			const col = index % 4;
			const x = CONFIG.coords.cols[col];
			const y = CONFIG.coords.rows[row];
			const imgObj = State.assets[iconName];
			if (imgObj)
				ctx.drawImage(imgObj, x, y, CONFIG.coords.iconW, CONFIG.coords.iconH);
		});

		// set up text styles and draw the prize text
		ctx.font = "40px 'VT323'";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#333";
		
		// Use this.prizeStr for winner, or random junk for loser
		const txt = this.isTarget ? this.prizeStr : generateRandomCode();
		const cx = CONFIG.coords.textBox.x + (CONFIG.coords.textBox.w / 2);
		const cy = CONFIG.coords.textBox.y + (CONFIG.coords.textBox.h / 2);
		ctx.fillText(txt, cx, cy);

		// convert the canvas to a data URL and set as background image
		const finalDataUrl = bgCanvas.toDataURL();
		const layerBg = document.createElement('div');
		layerBg.className = 'ticket-layer ticket-bg';
		layerBg.style.backgroundImage = `url(${finalDataUrl})`;
		wrapper.appendChild(layerBg);

		// make another canvas, that will be in DOM that the user scratches off
		const scratchCanvas = document.createElement('canvas');
		scratchCanvas.className = 'ticket-layer ticket-canvas';
		scratchCanvas.width = 817;
		scratchCanvas.height = 1024;
		
		// save our context and draw the cover image
		const sCtx = scratchCanvas.getContext('2d');

		// draw the unscratched cover image
		if (State.assets.ticketCover) 
			sCtx.drawImage(State.assets.ticketCover, 0, 0);

		// set up the scratch interaction handlers
		this.setupScratchInteraction(scratchCanvas, sCtx);

		// add the scratch canvas to our outer wrapper DOM
		wrapper.appendChild(scratchCanvas);

		return wrapper;
	}


	/**
	 * Sets up the scratch interaction handlers on the canvas
	 * 
	 * @param {DOMElement} canvas - the scratch canvas element
	 * @param {CanvasRenderingContext2D} ctx - the 2D context of the canvas
	 */
	setupScratchInteraction(canvas, ctx) {

		// track if we're currently drawing
		let isDrawing = false;
		const scratch = (e) => {
			
			// GTFO if not drawing
			if (!isDrawing)
				return; 
			
			// play scratch sound
			playScratchSound();

			// get the mouse/touch position relative to canvas
			const rect = canvas.getBoundingClientRect();
			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const clientY = e.touches ? e.touches[0].clientY : e.clientY;
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;
			const x = (clientX - rect.left) * scaleX;
			const y = (clientY - rect.top) * scaleY;

			// draw random the scratch circles to erase parts of the cover
			ctx.globalCompositeOperation = 'destination-out';
			ctx.beginPath();
			ctx.arc(x, y, 30, 0, Math.PI * 2);
			ctx.fill();
			const jX = x + (Math.random() * 40 - 20);
			const jY = y + (Math.random() * 40 - 20);
			ctx.beginPath();
			ctx.arc(jX, jY, 20, 0, Math.PI * 2);
			ctx.fill();

			// check if we scratched any target icons quadrants
			this.checkHotspots(x, y);
		};

		// bind event listeners for mouse and touch
		canvas.addEventListener('mousedown', (e) => { isDrawing = true; scratch(e); });
		canvas.addEventListener('mousemove', scratch);
		window.addEventListener('mouseup', () => { isDrawing = false; });
		canvas.addEventListener('touchstart', (e) => { isDrawing = true; scratch(e); }, {passive: false});
		canvas.addEventListener('touchmove', (e) => { e.preventDefault(); scratch(e); }, {passive: false});
		window.addEventListener('touchend', () => { isDrawing = false; });
	}


	/**
	 * Helper to check if any target icon quadrants have been scratched
	 * 
	 * @param {Number} x - x coordinate of scratch
	 * @param {Number} y - y coordinate of scratch
	 * @returns {void}
	 */
	checkHotspots(x, y) {

		// GTFO if already revealed or not a target ticket
		if (this.targetRevealed || !this.isTarget) 
			return;

		// check each target icon to see if the scratch is within its bounds
		this.targetIndices.forEach(idx => {

			// calculate icon position
			const row = Math.floor(idx / 4);
			const col = idx % 4;
			const iconX = CONFIG.coords.cols[col];
			const iconY = CONFIG.coords.rows[row];
			const w = CONFIG.coords.iconW;
			const h = CONFIG.coords.iconH;

			// check if scratch is within icon bounds
			if (x >= iconX && x <= iconX + w && y >= iconY && y <= iconY + h) {
				const localX = x - iconX;
				const localY = y - iconY;
				let q = 0;
				if (localX > w/2) q += 1;
				if (localY > h/2) q += 2;
				this.scratchedQuadrants[idx][q] = true;
			}
		});

		// if every quadrant of every target icon is scratched, trigger the effect
		const allScratched = this.targetIndices.every(idx => {
			return this.scratchedQuadrants[idx].every(q => q === true);
		});

		// play sound effect & show confetti if all scratched
		if (allScratched)
			this.triggerEffect();
	}


	/**
	 * Triggers the winning effect (confetti, sound)
	 */
	triggerEffect() {

		// true to prevent retriggering
		this.targetRevealed = true;

		// play sound and start confetti after a short delay
		setTimeout(() => {
			playSfx('yay');
			startConfetti();
		}, 3000);
	}


	/**
	 * Closes and removes this ticket from the DOM
	 */
	close() {

		// play the same woosh sound and slide it out via CSS
		playSfx('woosh');
		this.element.style.transform = 'translateY(150vh)';
		setTimeout(() => {

			// destroy the element and re-trigger dialogue
			this.element.remove();
			triggerDialogueSequence(this.isTarget);
		}, 700); 
	}
}


/**
 * Generates a random alphanumeric code in the format XXXXX-XXXXX-XXXXX
 * 
 * @returns {String} - a random alphanumeric code in the format XXXXX-XXXXX-XXXXX
 */
function generateRandomCode() {
	
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let str = "";
	
	for(let i=0; i<15; i++) {
		if(i>0 && i%5===0) str += "-";
		str += chars.charAt(Math.floor(Math.random() * chars.length));
	}// next i

	return str;
}


/**
 * Starts the confetti animation
 */
function startConfetti() {

	// get the container
	const container = document.getElementById('confetti-container');

	// set up our particles
	const colors = ['#ff0000', '#00ff00', '#ffffff', '#ffd700']; 
	const particles = [];
	const particleCount = 200; 

	// loop to spawn particles
	for(let i=0; i<particleCount; i++) {

		// each particle will be a DIV added to the container
		const div = document.createElement('div');
		div.className = 'confetti-piece';
		div.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
		container.appendChild(div);

		// store particle state with random properties
		particles.push({
			element: div,
			x: Math.random() * 100, 
			y: -20,
			vx: (Math.random() - 0.5) * 0.5,
			vy: Math.random() * 2 + 2,
			r: 0,
			vr: (Math.random() - 0.5) * 10
		});

	}// next i


	// animation loop for particles
	function update() {

		// we're active as long as particles continue to exist
		let stillActive = false;

		// update the position of each particle, including some 3d rotation via CSS
		particles.forEach(p => {
			p.y += p.vy;
			p.x += p.vx;
			p.r += p.vr;
			p.element.style.transform = `translate3d(${p.x}vw, ${p.y}px, 0) rotate(${p.r}deg)`;
			if (p.y < window.innerHeight) stillActive = true;
		});

		// if no more active particles, clean up
		if (stillActive)
			requestAnimationFrame(update);
		else
			container.innerHTML = ''; 
	}

	// start the animation loop
	requestAnimationFrame(update);
}

// Start initialization on DOMContentLoaded
window.addEventListener('DOMContentLoaded', init);
