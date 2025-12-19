/**
 * Merry Christmas Ticket Scratcher - v4 (Polished Logic)
 */

// --- Configuration ---
const CONFIG = {
	sounds: {
		door: 'sfx/door.mp3',
		footsteps: 'sfx/footsteps.mp3',
		woosh: 'sfx/woosh.mp3',
		yay: 'sfx/yay.mp3'
	},
	images: {
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
	icons: [
		'BONE', 'FOOT', 'JAW', 'RIB', 'SKULL', 'SPIKE', 'SPINE'
	],
	coords: {
		rows: [467, 589, 711],
		cols: [91, 251, 411, 571],
		iconW: 160,
		iconH: 122,
		keyBox: { x: 91, y: 862, w: 637, h: 98 } 
	}
};

// --- State Management ---
const State = {
	gameCount: 0,
	nextWinIndex: 2 + Math.floor(Math.random() * 3), 
	prizeCode: "LOADING...",
	audio: {},
	assets: {},
	// Dialogue State
	loserPairIndex: 0, 
	loserPairs: [
		['img/speech_bubble_1.png', 'img/speech_bubble_2.png'],
		['img/speech_bubble_3.png', 'img/speech_bubble_4.png'],
		['img/speech_bubble_5.png', 'img/speech_bubble_6.png']
	],
	winnerPair: ['img/speech_bubble_win_1.png', 'img/speech_bubble_win_2.png'],
	dialogueTimers: [] // To store timeouts so we can cancel them on click
};

/**
 * Utility: Load Image
 */
function loadImage(key, src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			State.assets[key] = img;
			resolve(img);
		};
		img.onerror = reject;
		img.src = src;
	});
}

/**
 * Utility: Load Audio
 */
function loadAudio(name, src) {
	return new Promise((resolve) => {
		const aud = new Audio(src);
		aud.preload = 'auto';
		aud.addEventListener('canplaythrough', () => {
			State.assets[name] = aud; 
			resolve();
		}, { once: true });
		aud.onerror = () => resolve();
		setTimeout(() => resolve(), 2000); 
	});
}

async function loadData() {
	try {
		const req = await fetch('data.json');
		const json = await req.json();
		State.prizeCode = json.prizeKey || "ERROR-NO-KEY";
	} catch (e) {
		console.error("Failed to load data.json", e);
		State.prizeCode = "OFFLINE-KEY";
	}
}

/**
 * Initialization Sequence
 */
async function init() {
	console.log("Starting Initialization...");
	
	const imagePromises = Object.entries(CONFIG.images).map(([key, src]) => loadImage(key, src));
	const iconPromises = CONFIG.icons.map(name => loadImage(name, `img/icons/${name}.png`));
	const audioPromises = Object.entries(CONFIG.sounds).map(([key, src]) => loadAudio(key, src));
	const dataPromise = loadData();
	const fontPromise = document.fonts.load('40px "VT323"');

	await Promise.all([...imagePromises, ...iconPromises, ...audioPromises, dataPromise, fontPromise]);

	setupStartScreen();
}

function setupStartScreen() {
	const loaderContent = document.getElementById('loader-content');
	loaderContent.innerHTML = ''; 

	const btn = document.createElement('button');
	btn.id = 'start-btn';
	btn.innerText = 'Click to Open';
	btn.onclick = () => {
		playSfx('door', 0.01); 
		startIntro();
	};
	loaderContent.appendChild(btn);
}

/**
 * Intro Animation Sequence
 */
function startIntro() {
	const loader = document.getElementById('loader');
	const scene = document.getElementById('scene');
	const girls = document.getElementById('girls-component');

	loader.style.opacity = '0';
	setTimeout(() => {
		loader.remove();
		scene.style.opacity = '1';
		
		playSfx('door');
		const steps = playSfx('footsteps');
		if(steps) steps.loop = true;

		setTimeout(() => {
			girls.classList.add('animate-enter');
			
			// 4s Walk Animation
			setTimeout(() => {
				if(steps) {
					steps.pause();
					steps.currentTime = 0;
				}

				girls.style.animation = 'none'; 
				girls.classList.remove('animate-enter');
				girls.classList.add('girls-final-pos');

				// Start Initial Dialogue
				triggerDialogueSequence();

			}, 4000); 
		}, 500);
	}, 1000);
}

/**
 * Dialogue System
 */
function triggerDialogueSequence(isWinner = false) {
	clearDialogueTimers(); // Safety clear

	const b1 = document.getElementById('bubble-1');
	const b2 = document.getElementById('bubble-2');
	const tickets = document.getElementById('glowing-tickets-img');
	const hitbox = document.getElementById('glowing-tickets-hitbox');

	// Determine sources
	let src1, src2;

	if (isWinner) {
		src1 = State.winnerPair[0];
		src2 = State.winnerPair[1];
	} else {
		// Loser Cycle
		const pair = State.loserPairs[State.loserPairIndex];
		src1 = pair[0];
		src2 = pair[1];
		State.loserPairIndex = (State.loserPairIndex + 1) % State.loserPairs.length;
	}

	b1.src = src1;
	b2.src = src2;

	// Animation Sequence using tracked timers
	// 1. Show Bubble 1
	State.dialogueTimers.push(setTimeout(() => {
		b1.classList.add('visible');
		
		// 2. Show Bubble 2
		State.dialogueTimers.push(setTimeout(() => {
			b2.classList.add('visible');

			// 3. Ensure Tickets are Visible (Only strictly needed for first run, but good for safety)
			State.dialogueTimers.push(setTimeout(() => {
				tickets.style.opacity = '1';
				tickets.classList.add('tickets-active');
				// Note: We don't block clicks waiting for this anymore
			}, 800));
		}, 1000));
	}, 500));
	
	// Ensure interaction is enabled immediately (don't wait for bubbles)
	// Users can skip bubbles by clicking
	hitbox.style.pointerEvents = 'auto';
	hitbox.onclick = spawnTicket;
}

function clearDialogueTimers() {
	State.dialogueTimers.forEach(t => clearTimeout(t));
	State.dialogueTimers = [];
}

function hideDialogue() {
	clearDialogueTimers(); // Cancel any pending bubbles trying to appear
	
	document.getElementById('bubble-1').classList.remove('visible');
	document.getElementById('bubble-2').classList.remove('visible');
	
	// IMPORTANT: We do NOT hide the glowing tickets anymore
	// We only disable clicking them so you don't double spawn
	document.getElementById('glowing-tickets-hitbox').style.pointerEvents = 'none';
}

function playSfx(name, vol=1.0) {
	const aud = State.assets[name];
	if (aud) {
		aud.volume = vol;
		aud.currentTime = 0;
		aud.play().catch(e => console.log("Audio play error", e));
		return aud;
	}
	return null;
}

/**
 * Game Loop: Spawning Tickets
 */
function spawnTicket() {
	playSfx('woosh');
	hideDialogue(); 

	const isWinner = (State.gameCount === State.nextWinIndex);
	
	// Create Ticket
	new ScratcherTicket(isWinner);

	// Update Game State
	if (isWinner) {
		State.nextWinIndex = State.gameCount + 2 + Math.floor(Math.random() * 4);
		console.log(`User won! Next win scheduled for game #${State.nextWinIndex}`);
	}
	
	State.gameCount++;
}

/**
 * Scratcher Ticket Component Class
 */
class ScratcherTicket {
	constructor(isWinner) {
		this.isWinner = isWinner;
		this.container = document.getElementById('ticket-overlay-container');
		this.gridData = this.generateGrid(isWinner);
		this.element = this.createDOM();
		this.container.appendChild(this.element);
		
		requestAnimationFrame(() => {
			this.element.style.transform = 'translateY(0)';
		});

		this.scratchedQuadrants = new Array(12).fill(0).map(() => [false, false, false, false]); 
		this.winnerRevealed = false;
	}

	generateGrid(isWinner) {
		const iconNames = CONFIG.icons;
		let grid = new Array(12).fill(null);

		if (isWinner) {
			// 1. Pick Winner Icon
			const winIcon = iconNames[Math.floor(Math.random() * iconNames.length)];
			
			// 2. Pick 3 places for Winner
			let places = [];
			while(places.length < 3) {
				let r = Math.floor(Math.random() * 12);
				if(!places.includes(r)) places.push(r);
			}
			this.winningIndices = places;
			places.forEach(p => grid[p] = winIcon);

			// 3. Fill the other 9 spots STRICTLY without creating a triplet or matching winner
			// Create a deck of all OTHER icons (2 of each)
			const loserIcons = iconNames.filter(n => n !== winIcon);
			let deck = [];
			loserIcons.forEach(n => { deck.push(n); deck.push(n); });
			
			// Shuffle Deck
			for (let i = deck.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[deck[i], deck[j]] = [deck[j], deck[i]];
			}

			// Fill empty slots from deck
			for(let i=0; i<12; i++) {
				if(grid[i] === null) {
					grid[i] = deck.pop(); // Take from deck
				}
			}

			return grid;

		} else {
			// Loser: Deck Shuffle (No 3 of a kind)
			let deck = [];
			iconNames.forEach(name => {
				deck.push(name);
				deck.push(name);
			});
			for (let i = deck.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[deck[i], deck[j]] = [deck[j], deck[i]];
			}
			this.winningIndices = [];
			return deck.slice(0, 12);
		}
	}

	createDOM() {
		const wrapper = document.createElement('div');
		wrapper.className = 'scratcher-ticket';

		const closeBtn = document.createElement('div');
		closeBtn.className = 'close-btn';
		closeBtn.innerHTML = '✖';
		closeBtn.onclick = () => this.close();
		wrapper.appendChild(closeBtn);

		const bgCanvas = document.createElement('canvas');
		bgCanvas.width = 817;
		bgCanvas.height = 1024;
		const ctx = bgCanvas.getContext('2d');

		if (State.assets.ticketBase) ctx.drawImage(State.assets.ticketBase, 0, 0);

		this.gridData.forEach((iconName, index) => {
			const row = Math.floor(index / 4); 
			const col = index % 4;
			const x = CONFIG.coords.cols[col];
			const y = CONFIG.coords.rows[row];
			const imgObj = State.assets[iconName];
			if (imgObj) ctx.drawImage(imgObj, x, y, CONFIG.coords.iconW, CONFIG.coords.iconH);
		});

		ctx.font = "40px 'VT323'";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#333";
		
		const txt = this.isWinner ? State.prizeCode : generateFakeKey();
		const cx = CONFIG.coords.keyBox.x + (CONFIG.coords.keyBox.w / 2);
		const cy = CONFIG.coords.keyBox.y + (CONFIG.coords.keyBox.h / 2);
		ctx.fillText(txt, cx, cy);

		const finalDataUrl = bgCanvas.toDataURL();
		const layerBg = document.createElement('div');
		layerBg.className = 'ticket-layer ticket-bg';
		layerBg.style.backgroundImage = `url(${finalDataUrl})`;
		wrapper.appendChild(layerBg);

		const scratchCanvas = document.createElement('canvas');
		scratchCanvas.className = 'ticket-layer ticket-canvas';
		scratchCanvas.width = 817;
		scratchCanvas.height = 1024;
		
		const sCtx = scratchCanvas.getContext('2d');
		if (State.assets.ticketCover) sCtx.drawImage(State.assets.ticketCover, 0, 0);

		this.setupScratchInteraction(scratchCanvas, sCtx);
		wrapper.appendChild(scratchCanvas);

		return wrapper;
	}

	setupScratchInteraction(canvas, ctx) {
		let isDrawing = false;
		const scratch = (e) => {
			// Fix: Removed "this.winnerRevealed" check here. 
			// User can now scratch even after winning.
			if (!isDrawing) return; 
			
			const rect = canvas.getBoundingClientRect();
			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const clientY = e.touches ? e.touches[0].clientY : e.clientY;
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;
			const x = (clientX - rect.left) * scaleX;
			const y = (clientY - rect.top) * scaleY;

			ctx.globalCompositeOperation = 'destination-out';
			ctx.beginPath();
			ctx.arc(x, y, 30, 0, Math.PI * 2);
			ctx.fill();
			const jX = x + (Math.random() * 40 - 20);
			const jY = y + (Math.random() * 40 - 20);
			ctx.beginPath();
			ctx.arc(jX, jY, 20, 0, Math.PI * 2);
			ctx.fill();

			this.checkHotspots(x, y);
		};

		canvas.addEventListener('mousedown', (e) => { isDrawing = true; scratch(e); });
		canvas.addEventListener('mousemove', scratch);
		window.addEventListener('mouseup', () => { isDrawing = false; });
		canvas.addEventListener('touchstart', (e) => { isDrawing = true; scratch(e); }, {passive: false});
		canvas.addEventListener('touchmove', (e) => { e.preventDefault(); scratch(e); }, {passive: false});
		window.addEventListener('touchend', () => { isDrawing = false; });
	}

	checkHotspots(x, y) {
		if (this.winnerRevealed || !this.isWinner) return;

		this.winningIndices.forEach(idx => {
			const row = Math.floor(idx / 4);
			const col = idx % 4;
			const iconX = CONFIG.coords.cols[col];
			const iconY = CONFIG.coords.rows[row];
			const w = CONFIG.coords.iconW;
			const h = CONFIG.coords.iconH;

			if (x >= iconX && x <= iconX + w && y >= iconY && y <= iconY + h) {
				const localX = x - iconX;
				const localY = y - iconY;
				let q = 0;
				if (localX > w/2) q += 1;
				if (localY > h/2) q += 2;
				this.scratchedQuadrants[idx][q] = true;
			}
		});

		const allScratched = this.winningIndices.every(idx => {
			return this.scratchedQuadrants[idx].every(q => q === true);
		});

		if (allScratched) {
			this.triggerWin();
		}
	}

	triggerWin() {
		this.winnerRevealed = true;
		
		// 1 Second Delay for effect
		setTimeout(() => {
			playSfx('yay');
			startConfetti();
		}, 1000);
	}

	close() {
		playSfx('woosh');
		this.element.style.transform = 'translateY(150vh)';
		setTimeout(() => {
			this.element.remove();
			
			// Resume Scene Dialogue (Optional, tickets are already active)
			triggerDialogueSequence(this.isWinner);

		}, 700); 
	}
}

function generateFakeKey() {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let str = "";
	for(let i=0; i<15; i++) {
		if(i>0 && i%5===0) str += "-";
		str += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return str;
}

function startConfetti() {
	const container = document.getElementById('confetti-container');
	const colors = ['#ff0000', '#00ff00', '#ffffff', '#ffd700']; 
	const particles = [];
	const particleCount = 200; 

	for(let i=0; i<particleCount; i++) {
		const div = document.createElement('div');
		div.className = 'confetti-piece';
		div.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
		container.appendChild(div);

		particles.push({
			element: div,
			x: Math.random() * 100, 
			y: -20,
			vx: (Math.random() - 0.5) * 0.5,
			vy: Math.random() * 2 + 2,
			r: 0,
			vr: (Math.random() - 0.5) * 10
		});
	}

	function update() {
		let stillActive = false;
		particles.forEach(p => {
			p.y += p.vy;
			p.x += p.vx;
			p.r += p.vr;
			p.element.style.transform = `translate3d(${p.x}vw, ${p.y}px, 0) rotate(${p.r}deg)`;
			if (p.y < window.innerHeight) stillActive = true;
		});

		if (stillActive) {
			requestAnimationFrame(update);
		} else {
			container.innerHTML = ''; 
		}
	}
	requestAnimationFrame(update);
}

window.addEventListener('DOMContentLoaded', init);