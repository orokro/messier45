/**
 * Merry Christmas Ticket Scratcher - v2
 */

// --- Configuration ---
const CONFIG = {
	sounds: {
		door: 'sfx/door.mp3',
		footsteps: 'sfx/footsteps.mp3', // New
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
		keyBox: { x: 91, y: 862, w: 637, h: 98 } 
	}
};

// --- State Management ---
const State = {
	gameCount: 0,
	nextWinIndex: 2 + Math.floor(Math.random() * 7), // 3rd to 10th ticket is winner
	prizeCode: "LOADING...",
	audio: {},
	assets: {} // Stores actual Image objects
};

/**
 * Utility: Load Image and Store it
 */
function loadImage(key, src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			State.assets[key] = img; // Store valid reference
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
		// Preload settings
		aud.preload = 'auto';
		aud.addEventListener('canplaythrough', () => {
			State.assets[name] = aud; // Store audio in same assets dict for simplicity
			resolve();
		}, { once: true });
		aud.onerror = () => {
			console.warn("Failed to load audio:", src);
			resolve(); // Resolve anyway to not block app
		};
		// Timeout fallback
		setTimeout(() => resolve(), 2000); 
	});
}

async function loadData() {
	try {
		const req = await fetch('data.json');
		const json = await req.json();
		State.prizeCode = json.prizeKey || "ERROR-NO-KEY";
		console.log("Prize loaded.");
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
	
	// 1. Load Images (with keys)
	const imagePromises = Object.entries(CONFIG.images).map(([key, src]) => loadImage(key, src));
	
	// 2. Load Icons (key = icon name)
	const iconPromises = CONFIG.icons.map(name => loadImage(name, `img/icons/${name}.png`));
	
	// 3. Load Audio
	const audioPromises = Object.entries(CONFIG.sounds).map(([key, src]) => loadAudio(key, src));
	
	// 4. Load Data
	const dataPromise = loadData();

	await Promise.all([...imagePromises, ...iconPromises, ...audioPromises, dataPromise]);

	// Assets Ready - Show Start Button
	setupStartScreen();
}

function setupStartScreen() {
	const loaderContent = document.getElementById('loader-content');
	loaderContent.innerHTML = ''; // Clear "Loading..."

	const btn = document.createElement('button');
	btn.id = 'start-btn';
	btn.innerText = 'Click to Open';
	btn.onclick = () => {
		// Unlock Audio Context immediately on click
		playSfx('door', 0.01); // Play silent sound to unlock
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
	const bubble1 = document.getElementById('bubble-1');
	const bubble2 = document.getElementById('bubble-2');
	const glowingTicketsImg = document.getElementById('glowing-tickets-img');
	const glowingTicketsHitbox = document.getElementById('glowing-tickets-hitbox');

	// Fade out loader
	loader.style.opacity = '0';
	setTimeout(() => {
		loader.remove();
		scene.style.opacity = '1';
		
		// Play Door & Footsteps
		playSfx('door');
		const steps = playSfx('footsteps');
		if(steps) steps.loop = true;

		// Start Girl Animation
		setTimeout(() => {
			girls.classList.add('animate-enter');
			
			// Animation Duration is 4s.
			setTimeout(() => {
				// STOP FOOTSTEPS
				if(steps) {
					steps.pause();
					steps.currentTime = 0;
				}

				// Lock Position
				girls.style.animation = 'none'; 
				girls.classList.remove('animate-enter');
				girls.classList.add('girls-final-pos');

				// Sequence Bubbles
				setTimeout(() => {
					bubble1.classList.add('visible');
					
					setTimeout(() => {
						bubble2.classList.add('visible');

						// Enable Tickets
						setTimeout(() => {
							glowingTicketsImg.style.opacity = '1';
							glowingTicketsImg.classList.add('tickets-active');
							glowingTicketsHitbox.style.pointerEvents = 'auto';
							glowingTicketsHitbox.addEventListener('click', spawnTicket);
						}, 800);
					}, 1000);
				}, 500);

			}, 4000); // 4s walk
		}, 500);
	}, 1000);
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

	const isWinner = (State.gameCount === State.nextWinIndex);
	State.gameCount++;

	console.log(`Spawning Ticket #${State.gameCount}. Winner? ${isWinner}`);
	
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

		this.scratchedQuadrants = new Array(12).fill(0).map(() => [false, false, false, false]); 
		this.winnerRevealed = false;
	}

	generateGrid(isWinner) {
		let icons = [];
		const iconNames = CONFIG.icons;

		if (isWinner) {
			// Winner Logic: 3 Matching + Random others
			const winIcon = iconNames[Math.floor(Math.random() * iconNames.length)];
			
			// Create a base array of 12 items
			let grid = new Array(12).fill(null);
			
			// Pick 3 unique positions for the winner
			let places = [];
			while(places.length < 3) {
				let r = Math.floor(Math.random() * 12);
				if(!places.includes(r)) places.push(r);
			}
			this.winningIndices = places; // Save for hit detection

			// Fill winners
			places.forEach(p => grid[p] = winIcon);

			// Fill rest with random junk (checking to ensure we don't accidentally make 3 of a kind)
			// But for simplicity, if we have 3 winners, extra matches don't "break" the game logic, 
			// though it might look confusing. 
			// To be safe, we just fill randoms.
			for(let i=0; i<12; i++) {
				if(grid[i] === null) {
					// Just pick random
					grid[i] = iconNames[Math.floor(Math.random() * iconNames.length)];
				}
			}
			return grid;

		} else {
			// Loser Logic: GUARANTEE NO 3-OF-A-KIND
			// Strategy: Create a deck with 2 of every icon (14 items total).
			// Shuffle deck. Pick first 12. 
			// It is mathematically impossible to have 3 of a kind.
			
			let deck = [];
			iconNames.forEach(name => {
				deck.push(name);
				deck.push(name);
			});

			// Fisher-Yates Shuffle
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

		// 1. Offscreen Generator (Base + Icons + Text)
		const bgCanvas = document.createElement('canvas');
		bgCanvas.width = 817;
		bgCanvas.height = 1024;
		const ctx = bgCanvas.getContext('2d');

		// Draw Base - Using PRELOADED asset
		if (State.assets.ticketBase) {
			ctx.drawImage(State.assets.ticketBase, 0, 0);
		}

		// Draw Icons - Using PRELOADED assets
		this.gridData.forEach((iconName, index) => {
			const row = Math.floor(index / 4); 
			const col = index % 4;
			
			const x = CONFIG.coords.cols[col];
			const y = CONFIG.coords.rows[row];

			const imgObj = State.assets[iconName];
			if (imgObj) {
				ctx.drawImage(imgObj, x, y, CONFIG.coords.iconW, CONFIG.coords.iconH);
			}
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

		// Apply as background
		const finalDataUrl = bgCanvas.toDataURL();
		const layerBg = document.createElement('div');
		layerBg.className = 'ticket-layer ticket-bg';
		layerBg.style.backgroundImage = `url(${finalDataUrl})`;
		wrapper.appendChild(layerBg);

		// 2. Scratch Canvas
		const scratchCanvas = document.createElement('canvas');
		scratchCanvas.className = 'ticket-layer ticket-canvas';
		scratchCanvas.width = 817;
		scratchCanvas.height = 1024;
		
		const sCtx = scratchCanvas.getContext('2d');
		// Draw Cover - Using PRELOADED asset
		if (State.assets.ticketCover) {
			sCtx.drawImage(State.assets.ticketCover, 0, 0);
		}

		this.setupScratchInteraction(scratchCanvas, sCtx);
		wrapper.appendChild(scratchCanvas);

		return wrapper;
	}

	setupScratchInteraction(canvas, ctx) {
		let isDrawing = false;

		const scratch = (e) => {
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
	const particleCount = 100;

	for(let i=0; i<particleCount; i++) {
		const div = document.createElement('div');
		div.className = 'confetti-piece';
		div.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
		container.appendChild(div);

		particles.push({
			element: div,
			x: Math.random() * 100, 
			y: -20,
			vx: (Math.random() - 0.5) * 0.5, // Slower horizontal
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

			// Use Translate3D for best performance
			// x is in vw units approx, y in px.
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