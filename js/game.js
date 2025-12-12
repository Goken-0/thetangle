// === CONFIGURATION ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const SETTINGS = {
    grid: 40,
    baseSize: 16, // Taille des modules du corps
    glow: true
};

const GAME_SPEED = 2; // Vitesse constante

// État Global
let state = {
    running: false,
    score: 0,
    muted: false,
    volume: 0.5,
    frames: 0,
    width: 800,
    height: 600,
    cols: 20,
    rows: 15
};

// Entités
let snake = { x: 0, y: 0, vx: 0, vy: 0, inputQueue: [], trail: [] };
let energy = { x: 0, y: 0, angle: 0 };
let particles = [];
let circuitLines = []; 

// === MOTEUR AUDIO (AMBIANCE DARK SYNTHWAVE) ===
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioContext();
let musicInterval = null;
let musicStep = 0;

const Sound = {
    // Générateur de sons (Oscillateur)
    playTone: (freq, type, duration, vol = 0.1, slideTo = null) => {
        if (state.muted) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const globalVol = state.volume;
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + duration);
        }

        gain.gain.setValueAtTime(vol * globalVol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    
    // Générateur de Bruit Blanc (Pour les percussions rétro)
    playNoise: (duration, vol = 0.1) => {
        if (state.muted) return;
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        const globalVol = state.volume;

        // Enveloppe percussive (Fort au début, coupe net)
        gain.gain.setValueAtTime(vol * globalVol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        
        noise.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
    },
    
    // --- BRUITAGES ---
    
    move: () => {
        // Petit "blip" sec
        Sound.playTone(800, 'triangle', 0.02, 0.02);
    },
    
    eat: () => {
        // Le "Bling" classique
        Sound.playTone(1200, 'square', 0.08, 0.1); 
        setTimeout(() => Sound.playTone(1800, 'square', 0.1, 0.1), 60); 
    },
    
    crash: () => {
        // Shutdown grave
        Sound.playTone(150, 'sawtooth', 1.0, 0.4, 10); 
    },

    // --- MUSIQUE (Chiptune GameBoy Style) ---
    startMusic: () => {
        if (musicInterval) clearInterval(musicInterval);
        musicStep = 0;
        // Tempo entrainant (150ms)
        musicInterval = setInterval(Sound.sequencer, 150); 
    },
    
    stopMusic: () => {
        if (musicInterval) clearInterval(musicInterval);
    },
    
    sequencer: () => {
        if (state.muted || !state.running) return;
        
        // Boucle de 16 temps
        const s = musicStep % 16;
        
        // --- PERCUSSIONS (Noise) ---
        // Kick (Temps 0, 4, 8, 12) et Snare (Temps 4, 12)
        if (s % 4 === 0) Sound.playNoise(0.1, 0.2); // Kick
        if (s % 8 === 4) Sound.playNoise(0.15, 0.15); // Snare accentué
        
        // --- BASSE (Triangle) ---
        // Ligne de basse qui "marche"
        const root = 110; // La
        if (s === 0 || s === 2) Sound.playTone(root, 'triangle', 0.1, 0.3);
        if (s === 8 || s === 10) Sound.playTone(root * 1.5, 'triangle', 0.1, 0.3); // Mi
        
        // --- MÉLODIE (Square - La voix "Nintendo") ---
        // Petite mélodie répétitive et joyeuse
        if (s === 0) Sound.playTone(440, 'square', 0.1, 0.05); // La
        if (s === 2) Sound.playTone(554, 'square', 0.1, 0.05); // Do#
        if (s === 4) Sound.playTone(659, 'square', 0.1, 0.05); // Mi
        
        // Petit arpège rapide à la fin de la mesure
        if (s === 14) Sound.playTone(880, 'square', 0.05, 0.05);
        if (s === 15) Sound.playTone(659, 'square', 0.05, 0.05);

        musicStep++;
    }
};

// === INITIALISATION ===
function init() {
    initBackground();
    
    // Listeners
    window.addEventListener('keydown', handleInput);
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', startGame);
    
    document.getElementById('muteBtn').addEventListener('click', toggleMute);
    document.getElementById('volumeSlider').addEventListener('input', updateVolume);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    
    requestAnimationFrame(loop);
}

function initBackground() {
    circuitLines = [];
    for(let i=0; i<25; i++) {
        circuitLines.push({
            x: Math.random() * state.width,
            y: Math.random() * state.height,
            length: Math.random() * 100 + 50,
            dir: Math.random() > 0.5 ? 0 : 1,
            speed: (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1),
            opacity: Math.random() * 0.2
        });
    }
}

function startGame() {
    state.running = true;
    state.score = 0;
    
    document.getElementById('score').innerText = '000';
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    
    const startCol = Math.floor(state.cols / 2);
    const startRow = Math.floor(state.rows / 2);
    
    snake.x = startCol * SETTINGS.grid;
    snake.y = startRow * SETTINGS.grid;
    snake.vx = GAME_SPEED;
    snake.vy = 0;
    
    snake.inputQueue = [{x: 1, y: 0}];
    snake.trail = [];
    // Queue de démarrage courte (3 segments environ)
    for(let i=0; i<12; i++) {
        snake.trail.push({ x: snake.x - i*GAME_SPEED, y: snake.y });
    }
    
    particles = [];
    spawnEnergy();
    Sound.startMusic();
}

// === LOGIQUE ===
function loop() {
    if (state.running) {
        updateSnake();
        checkCollisions();
    }
    updateParticles();
    updateBackground();
    draw();
    state.frames++;
    requestAnimationFrame(loop);
}

function updateSnake() {
    const atIntersection = (snake.x % SETTINGS.grid === 0) && (snake.y % SETTINGS.grid === 0);
    
    if (atIntersection) {
        if (snake.inputQueue.length > 0) {
            const next = snake.inputQueue.shift();
            snake.vx = next.x * GAME_SPEED;
            snake.vy = next.y * GAME_SPEED;
        } else {
            if(snake.vx !== 0) snake.vx = Math.sign(snake.vx) * GAME_SPEED;
            if(snake.vy !== 0) snake.vy = Math.sign(snake.vy) * GAME_SPEED;
        }
    }
    
    snake.x += snake.vx;
    snake.y += snake.vy;
    snake.trail.unshift({ x: snake.x, y: snake.y });
    
    // Longueur : Base + Score
    const targetLength = (3 + state.score) * (SETTINGS.grid / GAME_SPEED); 
    if (snake.trail.length > targetLength) snake.trail.pop();
}

function handleInput(e) {
    if (!state.running) return;
    
    const up = e.code === 'ArrowUp' || e.code === 'KeyW' || e.key === 'z' || e.key === 'Z';
    const down = e.code === 'ArrowDown' || e.code === 'KeyS' || e.key === 's' || e.key === 'S';
    const left = e.code === 'ArrowLeft' || e.code === 'KeyA' || e.key === 'q' || e.key === 'Q';
    const right = e.code === 'ArrowRight' || e.code === 'KeyD' || e.key === 'd' || e.key === 'D';

    if (!up && !down && !left && !right) return;

    let lastDir = snake.inputQueue.length > 0 
        ? snake.inputQueue[snake.inputQueue.length - 1] 
        : { x: Math.sign(snake.vx), y: Math.sign(snake.vy) };

    if (snake.inputQueue.length >= 2) return;

    let next = null;
    if (up && lastDir.y === 0) next = { x: 0, y: -1 };
    if (down && lastDir.y === 0) next = { x: 0, y: 1 };
    if (left && lastDir.x === 0) next = { x: -1, y: 0 };
    if (right && lastDir.x === 0) next = { x: 1, y: 0 };

    if (next) {
        snake.inputQueue.push(next);
        Sound.move();
    }
}

function checkCollisions() {
    if (snake.x < 0 || snake.x >= state.width || snake.y < 0 || snake.y >= state.height) return gameOver();
    
    const safeZone = 40; 
    const step = 4;
    for (let i = safeZone; i < snake.trail.length; i += step) {
        const p = snake.trail[i];
        if (Math.abs(snake.x - p.x) < 5 && Math.abs(snake.y - p.y) < 5) return gameOver();
    }
    
    const dist = Math.hypot(
        (snake.x + SETTINGS.grid/2) - (energy.x + SETTINGS.grid/2),
        (snake.y + SETTINGS.grid/2) - (energy.y + SETTINGS.grid/2)
    );
    if (dist < SETTINGS.grid * 0.8) eatEnergy();
}

function eatEnergy() {
    state.score++;
    document.getElementById('score').innerText = state.score.toString().padStart(3, '0');
    Sound.eat();
    for(let i=0; i<15; i++) spawnParticle(energy.x + SETTINGS.grid/2, energy.y + SETTINGS.grid/2, '#ff0055');
    spawnEnergy();
}

function spawnEnergy() {
    const cols = Math.floor(state.width / SETTINGS.grid);
    const rows = Math.floor(state.height / SETTINGS.grid);
    energy.x = (Math.floor(Math.random() * (cols - 2)) + 1) * SETTINGS.grid;
    energy.y = (Math.floor(Math.random() * (rows - 2)) + 1) * SETTINGS.grid;
}

function gameOver() {
    state.running = false;
    Sound.stopMusic();
    Sound.crash();
    document.getElementById('finalScore').innerText = state.score;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function spawnParticle(x, y, color) {
    particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0, color: color,
        size: Math.random() * 4 + 1
    });
}

function updateParticles() {
    for(let i=particles.length-1; i>=0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.04;
        if(p.life <= 0) particles.splice(i, 1);
    }
}

function updateBackground() {
    circuitLines.forEach(line => {
        if(line.dir === 0) line.x += line.speed; else line.y += line.speed;
        if(line.x > state.width) line.x = 0; if(line.x < 0) line.x = state.width;
        if(line.y > state.height) line.y = 0; if(line.y < 0) line.y = state.height;
    });
}

// === DESSIN VISUEL ===
function draw() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, state.width, state.height);
    
    // Grille
    ctx.strokeStyle = 'rgba(0, 255, 157, 0.04)'; ctx.lineWidth = 1;
    for(let x=0; x<=state.width; x+=SETTINGS.grid) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,state.height); ctx.stroke(); }
    for(let y=0; y<=state.height; y+=SETTINGS.grid) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(state.width,y); ctx.stroke(); }

    // Fond Animé
    ctx.strokeStyle = 'rgba(31, 121, 36, 0.15)'; ctx.lineWidth = 2;
    circuitLines.forEach(line => {
        ctx.beginPath(); ctx.moveTo(line.x, line.y);
        if(line.dir === 0) ctx.lineTo(line.x + line.length, line.y); else ctx.lineTo(line.x, line.y + line.length);
        ctx.stroke();
    });

    if (state.running) {
        const cx = SETTINGS.grid / 2;
        
        // NOURRITURE (Hexagone)
        const fx = energy.x + cx;
        const fy = energy.y + cx;
        energy.angle += 0.05;
        
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(energy.angle);
        ctx.shadowBlur = 20; ctx.shadowColor = '#ff0055';
        ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) ctx.lineTo(12 * Math.cos(i * Math.PI / 3), 12 * Math.sin(i * Math.PI / 3));
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        // SERPENT
        if(snake.trail.length > 1) {
            const offset = SETTINGS.grid / 2;
            
            // Corps (Modules)
            const step = Math.ceil(8 / GAME_SPEED * 2); 
            
            for(let i=step; i<snake.trail.length; i+=step) {
                const p = snake.trail[i];
                const ratio = i / snake.trail.length;
                const size = SETTINGS.baseSize * (1 - ratio * 0.6); 
                
                ctx.shadowBlur = 15; ctx.shadowColor = '#00ffaaff';
                ctx.fillStyle = '#00ffaaff'; 
                ctx.beginPath(); ctx.arc(p.x + offset, p.y + offset, size/2, 0, Math.PI*2); ctx.fill();
                
                ctx.shadowBlur = 0; ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(p.x + offset, p.y + offset, size/4, 0, Math.PI*2); ctx.fill();
            }

            // Tête
            ctx.save();
            ctx.translate(snake.x + offset, snake.y + offset);
            let angle = snake.vx > 0 ? 0 : snake.vx < 0 ? Math.PI : snake.vy > 0 ? Math.PI/2 : -Math.PI/2;
            ctx.rotate(angle);
            
            ctx.shadowBlur = 20; ctx.shadowColor = '#00ffaaff';
            ctx.fillStyle = '#002233'; ctx.strokeStyle = '#00ffaaff'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(18, 0); ctx.lineTo(-8, 14); ctx.lineTo(-4, 0); ctx.lineTo(-8, -14);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(4, -5, 2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(4, 5, 2, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }

        particles.forEach(p => {
            ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, p.size || 3, p.size || 3);
        });
        ctx.globalAlpha = 1;
    }
}

// === INTERFACE ===
function updateVolume(e) {
    state.volume = parseFloat(e.target.value);
    if (state.volume > 0 && state.muted) toggleMute();
    if (state.volume === 0 && !state.muted) toggleMute();
}

function toggleMute() {
    state.muted = !state.muted;
    const btn = document.getElementById('muteBtn');
    const slider = document.getElementById('volumeSlider');

    if (state.muted) {
        btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        btn.style.color = '#ff2a2a';
    } else {
        if (state.volume > 0.5) btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        else if (state.volume > 0) btn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
        else btn.innerHTML = '<i class="fa-solid fa-volume-off"></i>';
        
        btn.style.color = '';
        if (state.volume === 0) { state.volume = 0.5; slider.value = 0.5; }
    }
}

function toggleFullscreen() {
    const root = document.getElementById('fullscreenRoot');
    if (!document.fullscreenElement) root.requestFullscreen().catch(err => {});
    else document.exitFullscreen();
}

init();