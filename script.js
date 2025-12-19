/**
 * Merry Christmas Ticket Scratcher - Final Gold Version
 * Features: Security, Logic Fixes, Dialogue Polish, BGM, Procedural Scratch Audio, UI Polish
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
		textBox: { x: 91, y: 862, w: 637, h: 98 } 
	}
};

// --- State Management ---
const State = {
	count: 0,
	nextTargetIndex: 2 + Math.floor(Math.random() * 3), 
	secretText: "LOADING...", 
	audio: {},
	assets: {},
	// Audio Settings
	masterVolume: 1.0,
	isMuted: false,
	// Dialogue State
	cycleIndex: 0, 
	loserPairs: [
		['img/speech_bubble_1.png', 'img/speech_bubble_2.png'],
		['img/speech_bubble_3.png', 'img/speech_bubble_4.png'],
		['img/speech_bubble_5.png', 'img/speech_bubble_6.png']
	],
	winnerPair: ['img/speech_bubble_win_1.png', 'img/speech_bubble_win_2.png'],
	dialogueTimers: [],
	// Audio Context for Scratch Synthesis
	audioCtx: null,
	scratchGain: null,
	bgmObj: null
};

// --- Audio Volume Logic ---
function setupAudioControls() {
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

function updateAllVolumes() {
	const vol = State.isMuted ? 0 : State.masterVolume;

	// 1. Update BGM
	if (State.bgmObj) {
		State.bgmObj.volume = 0.6 * vol; 
	}
}

// --- Audio Synthesis (Procedural Sound) ---
function initAudioSystem() {
	const AudioContext = window.AudioContext || window.webkitAudioContext;
	State.audioCtx = new AudioContext();

	const bufferSize = State.audioCtx.sampleRate * 2; 
	const buffer = State.audioCtx.createBuffer(1, bufferSize, State.audioCtx.sampleRate);
	const data = buffer.getChannelData(0);
	
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

	const noise = State.audioCtx.createBufferSource();
	noise.buffer = buffer;
	noise.loop = true;

	State.scratchGain = State.audioCtx.createGain();
	State.scratchGain.gain.value = 0; 

	const filter = State.audioCtx.createBiquadFilter();
	filter.type = 'bandpass';
	filter.frequency.value = 800;

	noise.connect(filter);
	filter.connect(State.scratchGain);
	State.scratchGain.connect(State.audioCtx.destination);
	
	noise.start(0);
}

let scratchTimeout = null;
function playScratchSound() {
	if (!State.audioCtx || !State.scratchGain) return;
	
	const globalVol = State.isMuted ? 0 : State.masterVolume;
	const targetVol = 0.4 * globalVol; 

	State.scratchGain.gain.setTargetAtTime(targetVol, State.audioCtx.currentTime, 0.05);

	if (scratchTimeout) clearTimeout(scratchTimeout);
	scratchTimeout = setTimeout(() => {
		State.scratchGain.gain.setTargetAtTime(0, State.audioCtx.currentTime, 0.1);
	}, 100); 
}

// --- Modified playSfx to use Master Volume ---
function playSfx(name, vol=1.0) {
	const aud = State.assets[name];
	const globalVol = State.isMuted ? 0 : State.masterVolume;

	if (aud) {
		aud.volume = vol * globalVol;
		aud.currentTime = 0;
		aud.play().catch(e => console.log("Audio play error", e));
		return aud;
	}
	return null;
}

// --- Modified init ---
async function init() {
	console.log("Starting Initialization...");
	
	const imagePromises = Object.entries(CONFIG.images).map(([key, src]) => loadImage(key, src));
	const iconPromises = CONFIG.icons.map(name => loadImage(name, `img/icons/${name}.png`));
	const audioPromises = Object.entries(CONFIG.sounds).map(([key, src]) => loadAudio(key, src));
	const dataPromise = loadData();
	const fontPromise = document.fonts.load('40px "VT323"');

	await Promise.all([...imagePromises, ...iconPromises, ...audioPromises, dataPromise, fontPromise]);

	State.bgmObj = new Audio('sfx/bgm.mp3');
	State.bgmObj.volume = 0.6; 
	State.bgmObj.loop = true;

	setupAudioControls(); 
	setupStartScreen();
}

function setupStartScreen() {
	const loaderContent = document.getElementById('loader-content');
	loaderContent.innerHTML = ''; 

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

function startIntro() {
	const loader = document.getElementById('loader');
	const scene = document.getElementById('scene');
	const girls = document.getElementById('girls-component');

	loader.style.opacity = '0';
	
	// Show Audio Controls Logic
	setTimeout(() => {
		document.getElementById('audio-controls').classList.add('visible');
	}, 1000);

	setTimeout(() => {
		loader.remove();
		scene.style.opacity = '1';
		
		playSfx('door');
		const steps = playSfx('footsteps');
		if(steps) steps.loop = true;

		setTimeout(() => {
			girls.classList.add('animate-enter');
			setTimeout(() => {
				if(steps) { steps.pause(); steps.currentTime = 0; }
				girls.style.animation = 'none'; 
				girls.classList.remove('animate-enter');
				girls.classList.add('girls-final-pos');
				triggerDialogueSequence();
			}, 4000); 
		}, 500);
	}, 1000);
}

function triggerDialogueSequence(isSuccess = false) {
	clearDialogueTimers(); 
	const b1 = document.getElementById('bubble-1');
	const b2 = document.getElementById('bubble-2');
	const hitbox = document.getElementById('glowing-tickets-hitbox');

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

	b1.src = src1;
	b2.src = src2;

	State.dialogueTimers.push(setTimeout(() => {
		b1.classList.add('visible');
		State.dialogueTimers.push(setTimeout(() => {
			b2.classList.add('visible');
			const tickets = document.getElementById('glowing-tickets-img');
			tickets.style.opacity = '1';
			tickets.classList.add('tickets-active');
		}, 1000));
	}, 500));
	
	hitbox.style.pointerEvents = 'auto';
	hitbox.onclick = spawnTicket;
}

function clearDialogueTimers() {
	State.dialogueTimers.forEach(t => clearTimeout(t));
	State.dialogueTimers = [];
}

function hideDialogue() {
	clearDialogueTimers(); 
	document.getElementById('bubble-1').classList.remove('visible');
	document.getElementById('bubble-2').classList.remove('visible');
	document.getElementById('glowing-tickets-hitbox').style.pointerEvents = 'none';
}

function loadImage(key, src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => { State.assets[key] = img; resolve(img); };
		img.onerror = reject;
		img.src = src;
	});
}

function loadAudio(name, src) {
	return new Promise((resolve) => {
		const aud = new Audio(src);
		aud.preload = 'auto';
		aud.addEventListener('canplaythrough', () => { State.assets[name] = aud; resolve(); }, { once: true });
		aud.onerror = () => resolve();
		setTimeout(() => resolve(), 2000); 
	});
}

async function loadData() {
	try {
		const req = await fetch('data.json');
		const json = await req.json();
		if (json.xmas) State.secretText = atob(json.xmas);
		else State.secretText = "ERROR-NO-DATA";
	} catch (e) {
		console.error(e);
		State.secretText = "OFFLINE-MODE";
	}
}

function spawnTicket() {
	playSfx('woosh');
	hideDialogue(); 

	const isTarget = (State.count === State.nextTargetIndex);
	new ScratcherTicket(isTarget);

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
	constructor(isTarget) {
		this.isTarget = isTarget;
		this.container = document.getElementById('ticket-overlay-container');
		this.gridData = this.generateGrid(isTarget);
		this.element = this.createDOM();
		this.container.appendChild(this.element);
		
		requestAnimationFrame(() => {
			this.element.style.transform = 'translateY(0)';
		});

		this.scratchedQuadrants = new Array(12).fill(0).map(() => [false, false, false, false]); 
		this.targetRevealed = false;
	}

	generateGrid(isTarget) {
		const iconNames = CONFIG.icons;
		let grid = new Array(12).fill(null);

		if (isTarget) {
			const winIcon = iconNames[Math.floor(Math.random() * iconNames.length)];
			let places = [];
			while(places.length < 3) {
				let r = Math.floor(Math.random() * 12);
				if(!places.includes(r)) places.push(r);
			}
			this.targetIndices = places;
			places.forEach(p => grid[p] = winIcon);

			const otherIcons = iconNames.filter(n => n !== winIcon);
			let deck = [];
			otherIcons.forEach(n => { deck.push(n); deck.push(n); });
			for (let i = deck.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[deck[i], deck[j]] = [deck[j], deck[i]];
			}

			for(let i=0; i<12; i++) {
				if(grid[i] === null) grid[i] = deck.pop(); 
			}
			return grid;
		} else {
			let deck = [];
			iconNames.forEach(name => { deck.push(name); deck.push(name); });
			for (let i = deck.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[deck[i], deck[j]] = [deck[j], deck[i]];
			}
			this.targetIndices = [];
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
		
		const txt = this.isTarget ? State.secretText : generateRandomCode();
		const cx = CONFIG.coords.textBox.x + (CONFIG.coords.textBox.w / 2);
		const cy = CONFIG.coords.textBox.y + (CONFIG.coords.textBox.h / 2);
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
			if (!isDrawing) return; 
			
			// Play Procedural Sound
			playScratchSound();

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
		if (this.targetRevealed || !this.isTarget) return;

		this.targetIndices.forEach(idx => {
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

		const allScratched = this.targetIndices.every(idx => {
			return this.scratchedQuadrants[idx].every(q => q === true);
		});

		if (allScratched) {
			this.triggerEffect();
		}
	}

	triggerEffect() {
		this.targetRevealed = true;
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
			triggerDialogueSequence(this.isTarget);
		}, 700); 
	}
}

function generateRandomCode() {
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