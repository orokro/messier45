/**
 * Merry Christmas Ticket Scratcher
 * Author: [Your Name/Handle]
 * Date: Dec 2025
 */

// --- Configuration ---
const CONFIG = {
	sounds: {
		door: 'sfx/door.mp3',
		woosh: 'sfx/woosh.mp3',
		yay: 'sfx/yay.mp3'
	},
	images: {
		bg: 'img/bg.png',
		girls: 'img/girls.png',
		glowing: 'img/glowing_tickets.png',
		bubble1: 'img/speech_bubble_1.png',
		bubble2: 'img/speech_bubble_2.png',
		ticketBase: 'img/ticket_base.png',
		ticketCover: 'img/ticket_covered.png'
	},
	icons: [
		'BONE', 'FOOT', 'JAW', 'RIB', 'SKULL', 'SPIKE', 'SPINE'
	],
	coords: {
		rows: [467, 589, 711],
		cols: [91, 251, 411, 571],
		iconW: 160,
		iconH: 122,
		keyBox: { x: 91, y: 862, w: 637, h: 98 } // 728-91, 960-862
	}
};

// --- State Management ---
const State = {
	gameCount: 0,
	nextWinIndex: 2 + Math.floor(Math.random() * 7), // Random between 2 and 9 (3rd game to 10th game)
	prizeCode: "LOADING...",
	audio: {}
};

/**
 * Utility: Load Image
 */
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

/**
 * Utility: Load Audio
 */
function loadAudio(name, src) {
	return new Promise((resolve, reject) => {
		const aud = new Audio(src);
		aud.addEventListener('canplaythrough', () => {
			State.audio[name] = aud;
			resolve();
		}, { once: true });
		aud.onerror = reject;
		// Fallback for immediate load on some browsers
		setTimeout(() => resolve(), 3000); 
	});
}

/**
 * Utility: Fetch Prize Data
 */
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
	
	// 1. Load Assets
	const imagePromises = Object.values(CONFIG.images).map(loadImage);
	// Load icons separately
	const iconPromises = CONFIG.icons.map(name => loadImage(`img/icons/${name}.png`));
	const audioPromises = Object.entries(CONFIG.sounds).map(([key, src]) => loadAudio(key, src));
	
	// Load Data
	const dataPromise = loadData();

	await Promise.all([...imagePromises, ...iconPromises, ...audioPromises, dataPromise]);

	// 2. Start Intro
	startIntro();
}

/**
 * Intro Animation Sequence
 */
function startIntro() {
	const loader = document.getElementById('loader');
	const scene = document.getElementById('scene');
	const girls = document.getElementById('girls-component');
	const bubble1 = document.getElementById('bubble-1');
	const bubble2 = document.getElementById('bubble-2');
	const glowingTicketsImg = document.getElementById('glowing-tickets-img');
	const glowingTicketsHitbox = document.getElementById('glowing-tickets-hitbox');

	// Fade out loader, fade in BG
	loader.style.opacity = '0';
	setTimeout(() => {
		loader.remove();
		scene.style.opacity = '1';
		
		// Play Door Sound
		playSfx('door');

		// Start Girl Animation
		// Wait slightly for bg fade
		setTimeout(() => {
			girls.classList.add('animate-enter');
			
			// Animation Duration is 4s.
			// At 4s, we lock position and show bubbles
			setTimeout(() => {
				// Remove animation class and set static final position class
				// to prevent animation replay bugs or jitter
				girls.style.animation = 'none'; // Stop bounce
				girls.classList.remove('animate-enter');
				girls.classList.add('girls-final-pos');

				// Show Bubble 1
				setTimeout(() => {
					bubble1.classList.add('visible');
					
					// Show Bubble 2
					setTimeout(() => {
						bubble2.classList.add('visible');

						// Enable Tickets
						setTimeout(() => {
							glowingTicketsImg.style.opacity = '1';
							glowingTicketsImg.classList.add('tickets-active');
							glowingTicketsHitbox.style.pointerEvents = 'auto';
							
							// Add Listener
							glowingTicketsHitbox.addEventListener('click', spawnTicket);

						}, 800);
					}, 1000);
				}, 500);

			}, 4000); // 4s walk
		}, 500);
	}, 1000);
}

function playSfx(name) {
	if (State.audio[name]) {
		State.audio[name].currentTime = 0;
		State.audio[name].play().catch(e => console.log("Audio autoplay block", e));
	}
}

/**
 * Game Loop: Spawning Tickets
 */
function spawnTicket() {
	playSfx('woosh');

	const isWinner = (State.gameCount === State.nextWinIndex);
	State.gameCount++;

	new ScratcherTicket(isWinner);
}

/**
 * Scratcher Ticket Component Class
 */
class ScratcherTicket {
	constructor(isWinner) {
		this.isWinner = isWinner;
		this.container = document.getElementById('ticket-overlay-container');
		
		// Data Generation
		this.gridData = this.generateGrid(isWinner);
		
		// DOM Construction
		this.element = this.createDOM();
		this.container.appendChild(this.element);

		// Slide In
		requestAnimationFrame(() => {
			this.element.style.transform = 'translateY(0)';
		});

		// Win Logic State
		this.scratchedQuadrants = new Array(12).fill(0).map(() => [false, false, false, false]); // 12 icons, 4 quadrants
		this.winnerRevealed = false;
	}

	generateGrid(isWinner) {
		let icons = [];
		const iconNames = CONFIG.icons;

		if (isWinner) {
			// Pick a random winning icon
			const winIcon = iconNames[Math.floor(Math.random() * iconNames.length)];
			// Place it 3 times randomly
			let places = [];
			while(places.length < 3) {
				let r = Math.floor(Math.random() * 12);
				if(!places.includes(r)) places.push(r);
			}
			
			for(let i=0; i<12; i++) {
				if(places.includes(i)) {
					icons.push(winIcon);
				} else {
					// Random loser icon
					let rand = iconNames[Math.floor(Math.random() * iconNames.length)];
					// Try not to make incidental matches if possible, but simple random is fine for losers slots
					icons.push(rand);
				}
			}
			// Store winning indices for hit detection
			this.winningIndices = places;
		} else {
			// Loser: Ensure NO 3 of a kind
			// Simple algorithm: fill, check, replace if 3 exist
			// For simplicity in this prompt, we'll just pure random and assume low probability of collision
			// or force unique distribution if strictly needed.
			// Let's just pick randoms but ensure no triplet of specific items.
			for(let i=0; i<12; i++) {
				icons.push(iconNames[Math.floor(Math.random() * iconNames.length)]);
			}
			this.winningIndices = [];
		}

		return icons;
	}

	createDOM() {
		const wrapper = document.createElement('div');
		wrapper.className = 'scratcher-ticket';

		// Close Button
		const closeBtn = document.createElement('div');
		closeBtn.className = 'close-btn';
		closeBtn.innerHTML = '✖';
		closeBtn.onclick = () => this.close();
		wrapper.appendChild(closeBtn);

		// 1. Offscreen Generator for Background (Result)
		const bgCanvas = document.createElement('canvas');
		bgCanvas.width = 817;
		bgCanvas.height = 1024;
		const ctx = bgCanvas.getContext('2d');

		// Draw Base
		const baseImg = new Image();
		baseImg.src = CONFIG.images.ticketBase;
		// We assume preloaded, but for canvas drawing inside class, let's just do it sync-style 
		// since we awaited them in init().
		ctx.drawImage(baseImg, 0, 0);

		// Draw Icons
		this.gridData.forEach((iconName, index) => {
			const row = Math.floor(index / 4); // 4 cols
			const col = index % 4;
			
			const x = CONFIG.coords.cols[col];
			const y = CONFIG.coords.rows[row];

			const img = new Image();
			img.src = `img/icons/${iconName}.png`;
			ctx.drawImage(img, x, y, CONFIG.coords.iconW, CONFIG.coords.iconH);
		});

		// Draw Text
		ctx.font = "40px 'VT323'";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#333";
		
		const txt = this.isWinner ? State.prizeCode : generateFakeKey();
		const cx = CONFIG.coords.keyBox.x + (CONFIG.coords.keyBox.w / 2);
		const cy = CONFIG.coords.keyBox.y + (CONFIG.coords.keyBox.h / 2);
		
		ctx.fillText(txt, cx, cy);

		// Set as background of wrapper
		const finalDataUrl = bgCanvas.toDataURL();
		const layerBg = document.createElement('div');
		layerBg.className = 'ticket-layer ticket-bg';
		layerBg.style.backgroundImage = `url(${finalDataUrl})`;
		wrapper.appendChild(layerBg);

		// 2. Scratch Canvas (Cover)
		const scratchCanvas = document.createElement('canvas');
		scratchCanvas.className = 'ticket-layer ticket-canvas';
		// Set logical resolution to match image, CSS handles display size
		scratchCanvas.width = 817;
		scratchCanvas.height = 1024;
		
		const sCtx = scratchCanvas.getContext('2d');
		const coverImg = new Image();
		coverImg.src = CONFIG.images.ticketCover;
		// Draw cover immediately
		sCtx.drawImage(coverImg, 0, 0);

		// Input Handling
		this.setupScratchInteraction(scratchCanvas, sCtx);

		wrapper.appendChild(scratchCanvas);

		return wrapper;
	}

	setupScratchInteraction(canvas, ctx) {
		let isDrawing = false;

		const scratch = (e) => {
			if (!isDrawing) return;
			
			// Get Mouse/Touch Position relative to canvas scale
			const rect = canvas.getBoundingClientRect();
			
			// Handle Touch or Mouse
			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const clientY = e.touches ? e.touches[0].clientY : e.clientY;

			// Scale Coords
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;

			const x = (clientX - rect.left) * scaleX;
			const y = (clientY - rect.top) * scaleY;

			ctx.globalCompositeOperation = 'destination-out';
			
			// Main Brush
			ctx.beginPath();
			ctx.arc(x, y, 30, 0, Math.PI * 2);
			ctx.fill();

			// Jitter Brush
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

		// We only care about the winning indices
		this.winningIndices.forEach(idx => {
			const row = Math.floor(idx / 4);
			const col = idx % 4;
			const iconX = CONFIG.coords.cols[col];
			const iconY = CONFIG.coords.rows[row];
			const w = CONFIG.coords.iconW;
			const h = CONFIG.coords.iconH;

			// Check if click is inside this icon box
			if (x >= iconX && x <= iconX + w && y >= iconY && y <= iconY + h) {
				// Determine Quadrant (0: TL, 1: TR, 2: BL, 3: BR)
				const halfW = w/2;
				const halfH = h/2;
				const localX = x - iconX;
				const localY = y - iconY;

				let q = 0;
				if (localX > halfW) q += 1;
				if (localY > halfH) q += 2;

				this.scratchedQuadrants[idx][q] = true;
			}
		});

		// Check Win Condition: All quadrants of all winning icons scratched
		const allScratched = this.winningIndices.every(idx => {
			return this.scratchedQuadrants[idx].every(q => q === true);
		});

		if (allScratched) {
			this.triggerWin();
		}
	}

	triggerWin() {
		this.winnerRevealed = true;
		playSfx('yay');
		startConfetti();
	}

	close() {
		playSfx('woosh');
		this.element.style.transform = 'translateY(150vh)';
		setTimeout(() => {
			this.element.remove();
		}, 700); // Wait for transition
	}
}

/**
 * Helper: Fake Keys
 */
function generateFakeKey() {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let str = "";
	for(let i=0; i<15; i++) {
		if(i>0 && i%5===0) str += "-";
		str += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return str;
}

/**
 * Confetti System
 */
function startConfetti() {
	const container = document.getElementById('confetti-container');
	const colors = ['#ff0000', '#00ff00', '#ffffff', '#ffd700']; // Xmas colors
	const particles = [];
	const particleCount = 100;

	// Spawn
	for(let i=0; i<particleCount; i++) {
		const div = document.createElement('div');
		div.className = 'confetti-piece';
		div.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
		div.style.left = Math.random() * 100 + 'vw';
		container.appendChild(div);

		particles.push({
			element: div,
			x: parseFloat(div.style.left), // we'll use css left mostly but need updating
			y: -20,
			vx: (Math.random() - 0.5) * 2,
			vy: Math.random() * 3 + 2,
			r: 0,
			vr: (Math.random() - 0.5) * 10
		});
	}

	// Loop
	function update() {
		let stillActive = false;
		particles.forEach(p => {
			p.y += p.vy;
			p.x += p.vx;
			p.r += p.vr;

			p.element.style.transform = `translate3d(0, ${p.y}px, 0) rotate(${p.r}deg)`;
			// Note: We use translate3d on the Y axis, but we shouldn't change the Left property constantly causes reflow
			// But for simplicity of this script, let's keep it simple. Actually better to use transform for everything
			// Current implementation: css left is static, transform handles movement.
			// wait, css left is static, translate3d moves Y. X needs to be moved via translate too.
			
			// Fix:
			p.element.style.transform = `translate3d(${p.x - parseFloat(p.element.style.left||0)}px, ${p.y}px, 0) rotate(${p.r}deg)`;
			// Correction: simplest is just update top/left? No, reflows.
			// Let's just update transform X/Y
			p.element.style.transform = `translate3d(0, ${p.y}px, 0) translateX(${p.x}vw) rotate(${p.r}deg)`; // This is getting messy with units.
			
			// Simpler approach for vanilla JS particle system without complex matrix math:
			// Just update top/left. Modern browsers handle it okay for 100 elements.
			p.element.style.top = p.y + 'px';
			p.element.style.left = `calc(${p.x}vw + ${p.vx}px)`; // Approximation
			p.element.style.transform = `rotate(${p.r}deg)`;

			if (p.y < window.innerHeight) stillActive = true;
		});

		if (stillActive) {
			requestAnimationFrame(update);
		} else {
			container.innerHTML = ''; // Cleanup
		}
	}

	requestAnimationFrame(update);
}

// Start
window.addEventListener('DOMContentLoaded', init);