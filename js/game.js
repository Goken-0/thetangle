// === CONFIGURATION ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// On met en cache l'élément score pour ne pas le rechercher à chaque fois
const scoreElement = document.getElementById('score');

// Réglages (Grille 32px pour fluidité parfaite)
const SETTINGS = {
    grid: 32,
    baseSize: 14, 
    glow: true
};

const BASE_SPEED = 2; // Vitesse normale
const DASH_SPEED = 4; // Vitesse turbo (Doit être un diviseur de 32 : 4, 8, 16)

// État Global
let state = {
    running: false,
    score: 0,
    muted: false,
    volume: 0.5,
    frames: 0,
    width: 800,
    height: 576, 
    cols: 25,
    rows: 18
};

// Entités
let snake = { 
    x: 0, y: 0, 
    vx: 0, vy: 0, 
    inputQueue: [], 
    trail: [],
    // Nouveautés Dash
    dashing: false,
    stamina: 100,      // 0 à 100
    canDash: true
};

let energy = { x: 0, y: 0, angle: 0 };
let particles = [];
let circuitLines = []; 

// === MOTEUR AUDIO ===
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioContext();
let musicInterval = null;
let musicStep = 0;

const Sound = {
    // AJOUT du paramètre 'delay' à la fin
    playTone: (freq, type, duration, vol = 0.1, slideTo = null, delay = 0) => {
        if (state.muted) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const globalVol = state.volume;
        
        // On calcule le temps exact de départ (maintenant + délai)
        const startTime = audioCtx.currentTime + delay;
        const endTime = startTime + duration;
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, endTime);
        }

        gain.gain.setValueAtTime(vol * globalVol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, endTime);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(startTime);
        osc.stop(endTime);
    },
    
    playNoise: (duration, vol = 0.1) => {
        if (state.muted) return;
        // Création optimisée du buffer (seulement si nécessaire)
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        const globalVol = state.volume;

        gain.gain.setValueAtTime(vol * globalVol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        
        noise.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
    },
    
    move: () => { Sound.playTone(800, 'triangle', 0.02, 0.02); },
    dash: () => { Sound.playNoise(0.1, 0.05); Sound.playTone(200, 'sawtooth', 0.2, 0.1, 600); },
    
    // CORRECTION ICI : Plus de setTimeout ! On programme la 2ème note 60ms (0.06s) plus tard via l'API Audio
    eat: () => { 
        Sound.playTone(1200, 'square', 0.08, 0.1); 
        Sound.playTone(1800, 'square', 0.1, 0.1, null, 0.06); 
    },
    
    crash: () => { Sound.playTone(150, 'sawtooth', 1.0, 0.4, 10); },

    startMusic: () => {
        if (musicInterval) clearInterval(musicInterval);
        musicStep = 0;
        musicInterval = setInterval(Sound.sequencer, 150); 
    },
    
    stopMusic: () => {
        if (musicInterval) clearInterval(musicInterval);
    },
    
    sequencer: () => {
        if (state.muted || !state.running) return;
        
        const s = musicStep % 16;
        if (snake.dashing && s % 2 === 0) Sound.playNoise(0.05, 0.1);

        if (s % 4 === 0) Sound.playNoise(0.1, 0.2); 
        if (s % 8 === 4) Sound.playNoise(0.15, 0.15); 
        
        const root = 110; 
        if (s === 0 || s === 2) Sound.playTone(root, 'triangle', 0.1, 0.3);
        if (s === 8 || s === 10) Sound.playTone(root * 1.5, 'triangle', 0.1, 0.3); 
        
        if (s === 0) Sound.playTone(440, 'square', 0.1, 0.05); 
        if (s === 2) Sound.playTone(554, 'square', 0.1, 0.05); 
        if (s === 4) Sound.playTone(659, 'square', 0.1, 0.05); 
        
        if (s === 14) Sound.playTone(880, 'square', 0.05, 0.05);
        if (s === 15) Sound.playTone(659, 'square', 0.05, 0.05);

        musicStep++;
    }
};

// === INITIALISATION ===
function init() {
    initBackground();
    
    window.addEventListener('keydown', handleInput);
    window.addEventListener('keyup', handleInputRelease); // Pour relâcher le Dash
    
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', startGame);
    
    document.getElementById('muteBtn').addEventListener('click', toggleMute);
    document.getElementById('volumeSlider').addEventListener('input', updateVolume);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            Sound.stopMusic();
        } else {
            if (state.running && (snake.vx !== 0 || snake.vy !== 0)) {
                Sound.startMusic();
            }
        }
    });

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
    snake.vx = 0;
    snake.vy = 0;
    
    snake.inputQueue = []; 
    snake.trail = [];
    
    // Reset Dash
    snake.dashing = false;
    snake.stamina = 100;
    updateStaminaUI();
    
    for(let i=0; i<3; i++) {
        snake.trail.push({ x: snake.x, y: snake.y });
    }
    
    particles = [];
    spawnEnergy();
    Sound.stopMusic();
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
    // Gestion de l'énergie (Stamina)
    if (snake.dashing) {
        snake.stamina -= 2; // Ça descend vite
        if (snake.stamina <= 0) {
            snake.stamina = 0;
            snake.dashing = false;
        }
        if (state.frames % 5 === 0) spawnParticle(snake.x + 16, snake.y + 16, '#00ffff'); // Particules bleues
    } else {
        snake.stamina += 0.5; // Recharge lente
        if (snake.stamina > 100) snake.stamina = 100;
    }
    updateStaminaUI();

    // Vitesse actuelle (2 ou 4)
    const currentSpeed = snake.dashing ? DASH_SPEED : BASE_SPEED;

    if (snake.vx === 0 && snake.vy === 0) return;

    // Détection intersection pour tourner
    const atIntersection = (snake.x % SETTINGS.grid === 0) && (snake.y % SETTINGS.grid === 0);
    
    if (atIntersection) {
        if (snake.inputQueue.length > 0) {
            const next = snake.inputQueue.shift();
            snake.vx = next.x * currentSpeed;
            snake.vy = next.y * currentSpeed;
        } else {
            // Si pas de nouvelle commande, on ajuste juste la vitesse actuelle
            // pour être sûr qu'on ne reste pas bloqué sur une vitesse incompatible
            if (snake.vx !== 0) snake.vx = Math.sign(snake.vx) * currentSpeed;
            if (snake.vy !== 0) snake.vy = Math.sign(snake.vy) * currentSpeed;
        }
    } else {
        // Si on est au milieu d'une case et qu'on dash, on met à jour la vitesse instantanément
        // MAIS seulement si on reste aligné (horizontal/vertical)
        if (snake.vx !== 0) snake.vx = Math.sign(snake.vx) * currentSpeed;
        if (snake.vy !== 0) snake.vy = Math.sign(snake.vy) * currentSpeed;
    }
    
    snake.x += snake.vx;
    snake.y += snake.vy;
    snake.trail.unshift({ x: snake.x, y: snake.y });
    
    const targetLength = (3 + state.score) * (SETTINGS.grid / currentSpeed); 
    if (snake.trail.length > targetLength) snake.trail.pop();
}

function updateStaminaUI() {
    const bar = document.getElementById('staminaBar');
    bar.style.width = snake.stamina + '%';
    if (snake.stamina < 20) bar.classList.add('stamina-low');
    else bar.classList.remove('stamina-low');
}

function handleInput(e) {
    if (!state.running) return;

    // --- GESTION DU DASH (ESPACE) ---
    if (e.code === 'Space') {
        if (snake.stamina > 10) { // Il faut un minimum d'énergie pour lancer
            if (!snake.dashing) Sound.dash();
            snake.dashing = true;
        }
    }
    
    const up = e.code === 'ArrowUp' || e.code === 'KeyW' || e.key === 'z' || e.key === 'Z';
    const down = e.code === 'ArrowDown' || e.code === 'KeyS' || e.key === 's' || e.key === 'S';
    const left = e.code === 'ArrowLeft' || e.code === 'KeyA' || e.key === 'q' || e.key === 'Q';
    const right = e.code === 'ArrowRight' || e.code === 'KeyD' || e.key === 'd' || e.key === 'D';

    if (!up && !down && !left && !right) return;

    // DÉMARRAGE
    if (snake.vx === 0 && snake.vy === 0) {
        if (up) { snake.vx = 0; snake.vy = -BASE_SPEED; }
        if (down) { snake.vx = 0; snake.vy = BASE_SPEED; }
        if (left) { snake.vx = -BASE_SPEED; snake.vy = 0; }
        if (right) { snake.vx = BASE_SPEED; snake.vy = 0; }
        Sound.startMusic();
        return;
    }

    let lastDir = snake.inputQueue.length > 0 
        ? snake.inputQueue[snake.inputQueue.length - 1] 
        : { x: Math.sign(snake.vx), y: Math.sign(snake.vy) };

    if (snake.inputQueue.length >= 3) return;

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

function handleInputRelease(e) {
    if (e.code === 'Space') {
        snake.dashing = false;
    }
}

function checkCollisions() {
    if (snake.vx === 0 && snake.vy === 0) return;

    // Murs
    if (snake.x < 0 || snake.x >= state.width || snake.y < 0 || snake.y >= state.height) return gameOver();
    
    // Soi-même (INVINCIBLE SI DASH)
    if (!snake.dashing) {
        const safeZone = 40; 
        // On augmente le pas de vérification car le serpent peut aller vite
        const step = snake.dashing ? 8 : 4; 
        for (let i = safeZone; i < snake.trail.length; i += step) {
            const p = snake.trail[i];
            if (Math.abs(snake.x - p.x) < 5 && Math.abs(snake.y - p.y) < 5) return gameOver();
        }
    }
    
    // Manger
    const dist = Math.hypot(
        (snake.x + SETTINGS.grid/2) - (energy.x + SETTINGS.grid/2),
        (snake.y + SETTINGS.grid/2) - (energy.y + SETTINGS.grid/2)
    );
    if (dist < SETTINGS.grid * 0.8) eatEnergy();
}

function eatEnergy() {
    state.score++;
    snake.stamina = Math.min(100, snake.stamina + 20); 
    
    scoreElement.innerText = state.score.toString().padStart(3, '0');
    
    Sound.eat();
    
    for(let i=0; i<10; i++) spawnParticle(energy.x + SETTINGS.grid/2, energy.y + SETTINGS.grid/2, '#ff0055');
    
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

    ctx.strokeStyle = 'rgba(31, 121, 36, 0.15)'; ctx.lineWidth = 2;
    circuitLines.forEach(line => {
        ctx.beginPath(); ctx.moveTo(line.x, line.y);
        if(line.dir === 0) ctx.lineTo(line.x + line.length, line.y); else ctx.lineTo(line.x, line.y + line.length);
        ctx.stroke();
    });

    if (state.running) {
        const cx = SETTINGS.grid / 2;
        
        // NOURRITURE
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
        const offset = SETTINGS.grid / 2;
        
        // Couleur dynamique (Vert normal, Cyan si Dash)
        const mainColor = snake.dashing ? '#00ffff' : '#00ffaa';
        const shadowColor = snake.dashing ? '#00ffff' : '#00ffaaff';
        
        if(snake.trail.length > 0) {
            // Si on dash, on espace moins les points pour pas faire de trous
            const currentSpeed = snake.dashing ? DASH_SPEED : BASE_SPEED;
            const step = Math.max(1, Math.floor(SETTINGS.baseSize / currentSpeed));
            
            for(let i=0; i<snake.trail.length; i+=step) {
                const p = snake.trail[i];
                const ratio = i / snake.trail.length;
                const size = SETTINGS.baseSize * (1 - ratio * 0.6); 
                
                ctx.shadowBlur = snake.dashing ? 25 : 15; // Plus de glow si dash
                ctx.shadowColor = shadowColor;
                ctx.fillStyle = shadowColor; 
                ctx.beginPath(); ctx.arc(p.x + offset, p.y + offset, size/2, 0, Math.PI*2); ctx.fill();
                
                // Centre blanc
                ctx.shadowBlur = 0; ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(p.x + offset, p.y + offset, size/4, 0, Math.PI*2); ctx.fill();
            }
        }

        // Tête
        ctx.save();
        ctx.translate(snake.x + offset, snake.y + offset);
        let angle = -Math.PI/2; 
        if (snake.vx > 0) angle = 0; else if (snake.vx < 0) angle = Math.PI; else if (snake.vy > 0) angle = Math.PI/2;
        ctx.rotate(angle);
        
        ctx.shadowBlur = 20; ctx.shadowColor = shadowColor;
        ctx.fillStyle = '#002233'; ctx.strokeStyle = shadowColor; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(18, 0); ctx.lineTo(-8, 14); ctx.lineTo(-4, 0); ctx.lineTo(-8, -14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();

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