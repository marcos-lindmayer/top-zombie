// sketch.js (Refactored P5.js Client)

// --- Colors & Game Config Constants ---
// (Keep all const definitions here at the top)
const COLOR_PLAYER = [0, 150, 255];
const COLOR_OTHER_PLAYER = [150, 150, 200, 150];
const COLOR_BULLET = [255, 255, 0];
const COLOR_ENEMY_BULLET = [255, 100, 100];
const COLOR_ZOMBIE = [0, 180, 0];
const COLOR_ZOMBIE_HEAD = [0, 140, 0];
const COLOR_SHOOTER_ZOMBIE_TINT = [200, 200, 0, 100];
const COLOR_DOT_EFFECT = [100, 255, 100, 150];
const COLOR_MINIBOSS_BODY = [80, 0, 80];
const COLOR_MINIBOSS_HEAD = [120, 0, 120];
const COLOR_GIGABOSS_BODY = [60, 60, 60];
const COLOR_GIGABOSS_ACCENT = [255, 0, 0];
const COLOR_BLOOD = [200, 0, 0];
const COLOR_XP_BALL = [255, 165, 0];
const COLOR_BACKGROUND = [50, 50, 50];
const COLOR_TEXT = [255, 255, 255];
const COLOR_HUD_BG = [0, 0, 0, 150];
const COLOR_XP_BAR = [255, 165, 0];
const COLOR_SHIELD = [100, 180, 255, 100];
const COLOR_MODAL_BG = [40, 40, 60, 230];
const COLOR_BUTTON_BG = [80, 80, 120];
const COLOR_BUTTON_HOVER_BG = [110, 110, 160];
const COLOR_BUTTON_TEXT = [255, 255, 255];
const COLOR_JOYSTICK_BASE = [100, 100, 100, 100];
const COLOR_JOYSTICK_STICK = [150, 150, 150, 150];
const PLAYER_BASE_FIRE_RATE_COOLDOWN = 20;
const PLAYER_SIZE = 25;
const ZOMBIE_DEFAULT_SIZE = 20;
const MINIBOSS_SIZE = 45;
const GIGABOSS_SIZE = 70;
const BASE_XP_TO_LEVEL = 50;
const XP_LEVEL_SCALING_FACTOR = 1.25;

// --- Class Definitions (Moved Up) ---
class Player { // Client-side representation for local effects/display
  constructor(x, y) {
    // Use createVector ONLY inside methods or after setup guarantee
    this.pos = createVector(x, y); // createVector is available inside setup/draw
    this.size = PLAYER_SIZE;
    this.angle = -PI / 2;
    this.color = COLOR_PLAYER;
    // Local effect timers
    this.damageTakenCooldown = 0;
    this.levelUpEffectTimer = 0;
    this.adrenalineTimer = 0;
    this.lastStandTimer = 0;
    this.waveClearBonusTimer = 0;
    // Stats synced from server (used for display)
    this.health = 100;
    this.maxHealth = 100;
    this.shieldHealth = 0;
    this.maxShieldHealth = 0;
    this.currentXP = 0;
    this.xpToNextLevel = BASE_XP_TO_LEVEL;
    this.level = 1;
    // Other stats needed for effects if any (most are server-side)
    this.lastStandDuration = 120; // Needed for visual effect mapping
    this.id = null; // Will be set by server
     // Add base stats needed for HUD calculation if not directly sent
    this.maxFireRateCooldown = PLAYER_BASE_FIRE_RATE_COOLDOWN; // Store base locally
    // Add other base stats if needed for HUD display calculations
    this.speed = 4.0; // Store base speed locally
    this.bulletDamage = 10;
    this.maxPierceCount = 1;
    this.shotCount = 1;
    this.critChance = 0;
    this.critMultiplier = 1.5;
    this.healthRegenRate = 0;
    this.damageReduction = 0;

  }

  // Only update local visual effect timers
  updateLocalEffects() {
       if (this.damageTakenCooldown > 0) { this.damageTakenCooldown--; }
       if (this.levelUpEffectTimer > 0) { this.levelUpEffectTimer--; }
       if (this.adrenalineTimer > 0) { this.adrenalineTimer--; }
       if (this.lastStandTimer > 0) { this.lastStandTimer--; }
       if (this.waveClearBonusTimer > 0) { this.waveClearBonusTimer--; }
       // Update local stats based on received shared state for effects
       if (serverState && serverState.shared) {
           this.health = serverState.shared.health;
           this.maxHealth = serverState.shared.maxHealth;
           this.shieldHealth = serverState.shared.shieldHealth;
           this.maxShieldHealth = serverState.shared.maxShieldHealth;
           this.currentXP = serverState.shared.currentXP;
           this.xpToNextLevel = serverState.shared.xpToNextLevel;
           this.level = serverState.shared.level;
           // Update other stats if needed for visuals, like maxFireRateCooldown for ASPD calc
           // This requires server to send these modified stats OR client to recalculate based on perks
           // For simplicity, HUD calculation might use base values + perk list, or rely on server sending calculated stats
           // Example: Update local maxFireRateCooldown if server sends it (or calculate based on perks)
           // this.maxFireRateCooldown = serverState.shared.maxFireRateCooldown || PLAYER_BASE_FIRE_RATE_COOLDOWN;
       }
  }

  // Display logic remains the same
  display() {
    push();
    translate(this.pos.x, this.pos.y);

    // Shield Visual
    if (this.maxShieldHealth > 0 && this.shieldHealth > 0) {
        let shieldAlpha = map(this.shieldHealth, 0, this.maxShieldHealth, 50, 150);
        fill(COLOR_SHIELD[0], COLOR_SHIELD[1], COLOR_SHIELD[2], shieldAlpha);
        noStroke();
        ellipse(0, 0, this.size * 1.8, this.size * 1.8);
    }

    // Adrenaline / Wave Bonus Visual?
    if (this.adrenalineTimer > 0 || this.waveClearBonusTimer > 0) {
        fill(255, 255, 0, 50); // Yellow glow
        noStroke();
        ellipse(0, 0, this.size * 1.5, this.size * 1.5);
    }

    // Player Body
    rotate(this.angle);
    fill(this.color);
    stroke(0);
    strokeWeight(1);
    triangle(this.size / 2, 0, -this.size / 2, -this.size / 3, -this.size / 2, this.size / 3);
    pop();

    // Damage Flash
    if (this.damageTakenCooldown > 0 && this.lastStandTimer <= 0 && frameCount % 10 < 5) {
        fill(255, 0, 0, 150);
        noStroke();
        ellipse(this.pos.x, this.pos.y, this.size * 1.5, this.size * 1.5);
    }
    // Last Stand Invincibility Visual
    if (this.lastStandTimer > 0) {
        let alpha = map(this.lastStandTimer, this.lastStandDuration, 0, 150, 50);
        stroke(255, 255, 255, alpha);
        strokeWeight(map(this.lastStandTimer, this.lastStandDuration, 0, 4, 1));
        noFill();
        ellipse(this.pos.x, this.pos.y, this.size * 2.0, this.size * 2.0);
    }
    // Level Up Flash
     if (this.levelUpEffectTimer > 0) {
        let alpha = map(this.levelUpEffectTimer, 60, 0, 200, 0);
        let ringSize = map(this.levelUpEffectTimer, 60, 0, this.size * 1.5, this.size * 3);
        noFill();
        stroke(255, 215, 0, alpha);
        strokeWeight(3);
        ellipse(this.pos.x, this.pos.y, ringSize, ringSize);
    }
   }
   // Other methods (takeDamage, heal, gainXP) are server-side now
}

class Particle { // Keep particles client-side
    constructor(x, y, pColor = COLOR_BLOOD, baseSpeed = 1, speedRange = 3) {
        this.pos = createVector(x, y); // OK here, called after setup
        this.vel = p5.Vector.random2D();
        this.vel.mult(random(baseSpeed, baseSpeed + speedRange));
        this.lifespan = random(15, 40);
        let baseC = (pColor instanceof p5.Color) ? pColor : color(pColor[0], pColor[1], pColor[2]);
        this.color = color(red(baseC), green(baseC), blue(baseC), 200);
        this.size = random(2, 5);
    }
    update() { this.pos.add(this.vel); this.lifespan -= 1; this.vel.mult(0.95); this.color.setAlpha(map(this.lifespan, 0, 40, 0, 200)); }
    display() { noStroke(); fill(this.color); ellipse(this.pos.x, this.pos.y, this.size, this.size); }
    isDead() { return this.lifespan <= 0; }
}
// Other classes (Bullet, EnemyBullet, Zombie, etc.) are not needed on client


// --- Global Variables (Declared BEFORE setup) ---
let socket;
let myPlayerId = null;
let serverState = { // Default structure
    players: {}, bullets: {}, enemyBullets: {}, zombies: {}, xpBalls: {},
    shared: { health: 100, maxHealth: 100, currentXP: 0, xpToNextLevel: BASE_XP_TO_LEVEL, level: 1, acquiredPerks: [], firstPlayerId: null, wave: 0, score: 0, maxShieldHealth: 0, shieldHealth: 0 },
    gameState: 'start'
};

// Local player instance for effects & structure (position/angle updated from serverState)
let localPlayerInstance; // DECLARED only, initialized in setup
let lastSentInput = {};

// UI State
let showLevelUpModal = false;
let levelUpOptions = [];
let levelUpButtons = [];

// Mobile Controls State
let touchMoveId = -1;
let touchMoveBaseX, touchMoveBaseY;
let touchMoveStickX, touchMoveStickY;
let joystickBaseSize = 120; // Defined BEFORE setup uses it
let joystickStickSize = 60;
let joystickActive = false;
let isShootingTouch = false;

// Particles Array
let particles = [];

// Local Perk Definitions (for UI)
let upgradePool = [];


// === P5.js Functions ===

function setup() {
  createCanvas(windowWidth * 0.9, windowHeight * 0.8);
  angleMode(RADIANS);
  textAlign(CENTER, CENTER);
  textSize(16);

  // Initialize local player INSTANCE here, AFTER p5 is ready
  localPlayerInstance = new Player(width / 2, height / 2);

  // Initialize Joystick position (uses joystickBaseSize)
  touchMoveBaseX = joystickBaseSize * 0.8;
  touchMoveBaseY = height - joystickBaseSize * 0.8;
  touchMoveStickX = touchMoveBaseX;
  touchMoveStickY = touchMoveBaseY;

  // Define upgrades locally for descriptions
  defineUpgrades(); // Must be called after upgradePool is declared

  // --- Connect to Server ---
  const serverUrl = 'https://top-zombie-33heqh8lq-marcoslindmayers-projects.vercel.app/'; // Ensure this matches server port
  console.log("Attempting to connect to:", serverUrl); // DEBUG LOG
  socket = io(serverUrl, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
  });

  // --- Socket Event Listeners ---
  socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    startNewGameClient();
    // gameState will be updated by server shortly
  });

  socket.on('assignId', (id) => {
      console.log("Assigned ID:", id);
      myPlayerId = id;
      localPlayerInstance.id = id; // Assign ID to local instance
  });

  socket.on('gameStateUpdate', (newState) => {
    // console.log("Received state:", JSON.stringify(newState)); // DEBUG LOG (can be verbose)
    serverState = newState;
    // Use the gameState from the SHARED part of the state update
    gameState = serverState.shared.gameState; // Sync from shared state

    if (myPlayerId && serverState.players[myPlayerId]) {
        localPlayerInstance.pos.x = serverState.players[myPlayerId].x;
        localPlayerInstance.pos.y = serverState.players[myPlayerId].y;
        localPlayerInstance.angle = serverState.players[myPlayerId].angle;
    }
    if (serverState.shared) {
        localPlayerInstance.health = serverState.shared.health;
        localPlayerInstance.maxHealth = serverState.shared.maxHealth;
        localPlayerInstance.shieldHealth = serverState.shared.shieldHealth;
        localPlayerInstance.maxShieldHealth = serverState.shared.maxShieldHealth;
        localPlayerInstance.currentXP = serverState.shared.currentXP;
        localPlayerInstance.xpToNextLevel = serverState.shared.xpToNextLevel;
        localPlayerInstance.level = serverState.shared.level;
    }
  });

   socket.on('promptPerkSelection', (optionsFromServer) => {
        console.log("Received perk options:", optionsFromServer);
        if (myPlayerId === serverState.shared.firstPlayerId) {
            levelUpOptions = optionsFromServer;
            showLevelUpModal = true;
            // gameState 'levelUp' is set via gameStateUpdate
        } else {
            console.log("Waiting for first player to choose perk.");
             showLevelUpModal = false;
        }
    });

    socket.on('gameOver', () => {
        console.log("Game Over signal received.");
        gameState = 'gameOver';
    });

   socket.on('serverFull', (message) => {
        console.warn(message);
        alert(message);
        socket.disconnect();
   });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    gameState = 'start';
    myPlayerId = null;
    alert("Disconnected from server: " + reason);
  });

  socket.on('connect_error', (err) => {
      console.error("Connection Error:", err.message, err);
      gameState = 'start';
      alert("Failed to connect to server.");
  });

}

function draw() {
  background(COLOR_BACKGROUND);
  // console.log("Client Drawing State:", gameState); // DEBUG LOG

  // --- Game State Rendering ---
  // Use client's gameState synced from server
  switch (gameState) {
    case 'start':
      displayStartScreen();
      break;
    case 'playing':
    case 'levelUp':
        drawGameFromServerState();
        if (joystickActive) drawJoystick();
        displayHUD();

        if (gameState === 'levelUp' && myPlayerId === serverState.shared.firstPlayerId && showLevelUpModal) {
             displayLevelUpModal(levelUpOptions);
        } else if (gameState === 'levelUp' && myPlayerId !== serverState.shared.firstPlayerId) {
            fill(255, 255, 255, 150); textSize(24); textAlign(CENTER, CENTER);
            text("Waiting for perk selection...", width / 2, height / 2);
        }
      break;
    case 'gameOver':
      displayGameOverScreen();
      break;
    default:
        // Draw something if state is unexpected?
        fill(255); textSize(20); textAlign(CENTER, CENTER);
        text("Loading / Connecting...", width/2, height/2);
  }

  // --- Send Inputs (only when playing) ---
  if (gameState === 'playing' && myPlayerId && socket.connected) {
      sendInputs();
  }

  // Update local player effects (like timers for visuals)
  if(localPlayerInstance) { // Ensure instance exists before updating
      localPlayerInstance.updateLocalEffects();
  }
}

// Handle Touch Start/Move/End (Unchanged)
function touchStarted() {
  joystickActive = true;
  if (touchMoveId === -1) {
    for (let i = 0; i < touches.length; i++) {
        let touch = touches[i];
        let d = dist(touch.x, touch.y, touchMoveBaseX, touchMoveBaseY);
        if (d < joystickBaseSize * 0.75) {
            touchMoveId = touch.id;
            updateJoystickStick(touch.x, touch.y);
            return false;
        }
    }
  }
   if (gameState === 'start' || gameState === 'gameOver') {
        if (socket && socket.connected) {
             // Optionally send a 'requestRestart' event if needed by server logic
             // socket.emit('requestRestart');
        }
        // Let server dictate state change on connect/reconnect
        return false;
   }
   if (gameState === 'levelUp' && showLevelUpModal) {
       for (let i = 0; i < levelUpButtons.length; i++) { // Use renamed variable
            let btn = levelUpButtons[i];
            if (touches[0] && touches[0].x > btn.x && touches[0].x < btn.x + btn.w && touches[0].y > btn.y && touches[0].y < btn.y + btn.h) {
                if (socket && socket.connected) { // Check connection before emitting
                    socket.emit('perkSelected', btn.perk); // Send stored perk identifier
                }
                showLevelUpModal = false;
                levelUpOptions = [];
                levelUpButtons = [];
                // gameState = 'playing'; // Let server dictate state via gameStateUpdate
                resetJoystick();
                return false;
            }
        }
   }
  return true;
}
function touchMoved() {
  joystickActive = true;
  for (let i = 0; i < touches.length; i++) {
    let touch = touches[i];
    if (touch.id === touchMoveId) {
      updateJoystickStick(touch.x, touch.y);
      return false;
    }
  }
  return true;
}
function touchEnded() {
  joystickActive = true;
  let touchStillDown = false;
  for (let i = 0; i < touches.length; i++) {
      if (touches[i].id === touchMoveId) {
          touchStillDown = true;
          break;
      }
  }
  if (!touchStillDown && touchMoveId !== -1) {
       resetJoystick();
  }
   if (touches.length === 0) {
        resetJoystick();
   }
  return false;
}
function updateJoystickStick(x, y) {
    let vec = createVector(x - touchMoveBaseX, y - touchMoveBaseY);
    let maxDist = joystickBaseSize / 2;
    if (vec.magSq() > maxDist * maxDist) { vec.setMag(maxDist); }
    touchMoveStickX = touchMoveBaseX + vec.x;
    touchMoveStickY = touchMoveBaseY + vec.y;
}
function resetJoystick() {
    touchMoveId = -1;
    touchMoveStickX = touchMoveBaseX;
    touchMoveStickY = touchMoveBaseY;
    isShootingTouch = false;
}
function drawJoystick() {
    push();
    fill(COLOR_JOYSTICK_BASE); noStroke();
    ellipse(touchMoveBaseX, touchMoveBaseY, joystickBaseSize, joystickBaseSize);
    fill(COLOR_JOYSTICK_STICK);
    ellipse(touchMoveStickX, touchMoveStickY, joystickStickSize, joystickStickSize);
    pop();
}

// Mouse Pressed function only handles desktop clicks for modal/start/restart
function mousePressed() {
   if (touches.length === 0) { // Only handle mouse clicks if NOT using touch
        if (gameState === 'start' || gameState === 'gameOver') {
             if (socket && socket.connected) {
                 // Optionally send a 'requestRestart' event if needed by server logic
                 // socket.emit('requestRestart');
             }
             // Let server dictate state change
        } else if (gameState === 'levelUp' && showLevelUpModal) {
            for (let i = 0; i < levelUpButtons.length; i++) { // Use renamed variable
                let btn = levelUpButtons[i];
                if (mouseX > btn.x && mouseX < btn.x + btn.w && mouseY > btn.y && mouseY < btn.y + btn.h) {
                     if (socket && socket.connected) { // Check connection before emitting
                        socket.emit('perkSelected', btn.perk); // Send stored perk identifier
                     }
                    showLevelUpModal = false;
                    levelUpOptions = [];
                    levelUpButtons = [];
                    // gameState = 'playing'; // Let server dictate state
                    break;
                }
            }
        }
   }
}


// Handle window resize
function windowResized() {
  resizeCanvas(windowWidth * 0.9, windowHeight * 0.8);
  touchMoveBaseX = joystickBaseSize * 0.8;
  touchMoveBaseY = height - joystickBaseSize * 0.8;
  if (touchMoveId === -1) {
      touchMoveStickX = touchMoveBaseX;
      touchMoveStickY = touchMoveBaseY;
  }
}

// === Game Logic Functions === (Client-side simulation removed)

function runGame() {
  // Main game update logic is now on the server.
  // Client focuses on rendering the state received from the server.
  // Input sending happens in draw() loop.
  // Particle updates happen here or in drawGameFromServerState.

   // Update local particles
   for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      // Particles are drawn in drawGameFromServerState
      if (particles[i].isDead()) {
          particles.splice(i, 1);
      }
  }
}

function startNewGameClient() {
    // Reset local UI state if needed, server handles authoritative state reset
    localPlayerInstance = new Player(width / 2, height / 2); // Reset local instance representation
    if(myPlayerId) localPlayerInstance.id = myPlayerId; // Keep ID if we have it
    showLevelUpModal = false;
    levelUpOptions = [];
    levelUpButtons = [];
    resetJoystick();
    particles = []; // Clear local particles
    // Reset serverState defaults locally for smoother transition before first update
     serverState = { players: {}, bullets: {}, enemyBullets: {}, zombies: {}, xpBalls: {}, shared: { health: 100, maxHealth: 100, currentXP: 0, xpToNextLevel: BASE_XP_TO_LEVEL, level: 1, acquiredPerks: [], firstPlayerId: null, wave: 0, score: 0, maxShieldHealth: 0, shieldHealth: 0 }, gameState: 'playing' };
}

// Function to spawn blood particles (Client-side effect)
function spawnBloodParticles(x, y, isCrit = false) {
    let numParticles = isCrit ? 15 : 5 + floor(random(3));
    let particleColor = isCrit ? COLOR_BULLET : COLOR_BLOOD;
    let baseSpeed = isCrit ? 2 : 1; let speedRange = isCrit ? 4 : 3;
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle(x, y, particleColor, baseSpeed, speedRange));
    }
}


// --- Rendering ---
function drawGameFromServerState() {
    // Draw other players
    for (const id in serverState.players) {
        if (id !== myPlayerId) {
            let pData = serverState.players[id];
            push(); translate(pData.x, pData.y); rotate(pData.angle); fill(COLOR_OTHER_PLAYER); noStroke();
            triangle(PLAYER_SIZE / 2, 0, -PLAYER_SIZE / 2, -PLAYER_SIZE / 3, -PLAYER_SIZE / 2, PLAYER_SIZE / 3); pop();
        }
    }
     // Draw local player
     if (localPlayerInstance) { localPlayerInstance.display(); }
    // Draw zombies
    for (const id in serverState.zombies) { drawZombieFromServer(serverState.zombies[id]); }
    // Draw player bullets
    for (const id in serverState.bullets) { drawBulletFromServer(serverState.bullets[id], COLOR_BULLET); }
    // Draw enemy bullets
    for (const id in serverState.enemyBullets) { drawBulletFromServer(serverState.enemyBullets[id], COLOR_ENEMY_BULLET); }
    // Draw XP balls
    for (const id in serverState.xpBalls) { drawXpBallFromServer(serverState.xpBalls[id]); }
    // Draw particles
    for(let p of particles) { p.display(); } // Draw updated particles
}
function drawZombieFromServer(zData) {
    push(); translate(zData.x, zData.y);
    let size = zData.size || ZOMBIE_DEFAULT_SIZE; let hpPercent = zData.healthPercent !== undefined ? zData.healthPercent : 1;
    let baseBodyColor, baseHeadColor; let bodyWidthScale = 0.6, bodyHeightScale = 0.8, headScale = 0.5; let strokeWeightVal = 1;
    if (zData.type === 'miniboss') { baseBodyColor = color(COLOR_MINIBOSS_BODY); baseHeadColor = color(COLOR_MINIBOSS_HEAD); size = zData.size || MINIBOSS_SIZE; bodyWidthScale = 0.8; bodyHeightScale = 1.0; headScale = 0.6; strokeWeightVal = 2; }
    else if (zData.type === 'gigaboss') { baseBodyColor = color(COLOR_GIGABOSS_BODY); baseHeadColor = color(COLOR_GIGABOSS_ACCENT); size = zData.size || GIGABOSS_SIZE; let damagedColor = color(red(baseBodyColor)*0.5, green(baseBodyColor)*0.5, blue(baseBodyColor)*0.5); let currentBodyColor = lerpColor(damagedColor, baseBodyColor, hpPercent); stroke(0); strokeWeight(3); fill(currentBodyColor); ellipse(0, 0, size, size); let numAccents = 6; let accentColor = color(COLOR_GIGABOSS_ACCENT); rotate(frameCount * 0.01); for (let i = 0; i < numAccents; i++) { rotate(TWO_PI / numAccents); fill(accentColor); triangle(0, -size * 0.4, -size * 0.1, -size * 0.6, size * 0.1, -size * 0.6); } if (zData.dotTimer > 0) { fill(COLOR_DOT_EFFECT); noStroke(); ellipse(0, 0, size * 0.4, size * 0.4); } pop(); return; }
    else { baseBodyColor = color(COLOR_ZOMBIE); baseHeadColor = color(COLOR_ZOMBIE_HEAD); }
    let bodyColor = lerpColor(color(255,0,0), baseBodyColor, hpPercent); let currentHeadColor = lerpColor(color(150,0,0), baseHeadColor, hpPercent);
    stroke(0); strokeWeight(strokeWeightVal); fill(bodyColor); rect(-size * bodyWidthScale * 0.5, -size * bodyHeightScale * 0.5, size * bodyWidthScale, size * bodyHeightScale, 2);
    fill(currentHeadColor); ellipse(0, -size * bodyHeightScale * 0.5, size * headScale, size * headScale);
    if (zData.canShoot) { fill(COLOR_SHOOTER_ZOMBIE_TINT); noStroke(); ellipse(0, 0, size * 0.4, size * 0.4); }
    if (zData.dotTimer > 0) { fill(COLOR_DOT_EFFECT); noStroke(); ellipse(0, size * 0.1, size * 0.5, size * 0.5); }
    pop();
}
function drawBulletFromServer(bData, bColor) { push(); fill(bColor); noStroke(); ellipse(bData.x, bData.y, bData.size || 6, bData.size || 6); pop(); }
function drawXpBallFromServer(xpData) { push(); fill(COLOR_XP_BALL); stroke(255, 200); strokeWeight(1); ellipse(xpData.x, xpData.y, 10, 10); pop(); }

// --- Input Sending ---
function sendInputs() {
    let dx = 0; let dy = 0; let shooting = false; let aimAngle = null;
    if (touchMoveId !== -1) {
        let stickVec = createVector(touchMoveStickX - touchMoveBaseX, touchMoveStickY - touchMoveBaseY);
        let stickMag = stickVec.mag(); let maxDist = joystickBaseSize / 2;
        if (stickMag > maxDist * 0.1) { let moveDir = stickVec.copy().normalize(); dx = moveDir.x; dy = moveDir.y; shooting = true; }
    } else {
        if (keyIsDown(87) || keyIsDown(UP_ARROW)) { dy = -1; } if (keyIsDown(83) || keyIsDown(DOWN_ARROW)) { dy = 1; }
        if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) { dx = -1; } if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) { dx = 1; }
        if (dx !== 0 && dy !== 0) { let v = createVector(dx, dy).normalize(); dx = v.x; dy = v.y; }
        aimAngle = atan2(mouseY - localPlayerInstance.pos.y, mouseX - localPlayerInstance.pos.x);
        if (keyIsDown(32)) { shooting = true; }
    }
    const currentInput = { dx, dy, shooting, angle: aimAngle };
    if (currentInput.dx !== lastSentInput.dx || currentInput.dy !== lastSentInput.dy || currentInput.shooting !== lastSentInput.shooting || currentInput.angle !== lastSentInput.angle) {
        if (socket && socket.connected) { socket.emit('playerInput', currentInput); lastSentInput = currentInput; }
    }
}

// --- HUD & UI Screens --- (displayHUD, displayStartScreen, displayGameOverScreen, displayLevelUpModal, defineUpgrades)
function displayHUD() {
    let hudHeight = 90; fill(COLOR_HUD_BG); noStroke(); rect(0, 0, width, hudHeight);
    fill(COLOR_TEXT); textSize(18); textAlign(LEFT, CENTER);
    let healthText = `HP: ${floor(serverState.shared.health)}/${serverState.shared.maxHealth}`;
    if (serverState.shared.maxShieldHealth > 0) { healthText += ` (S: ${floor(serverState.shared.shieldHealth)})`; }
    text(healthText, 20, 20);
    textAlign(CENTER, CENTER); text(`Wave: ${serverState.shared.wave}`, width / 2, 20);
    textAlign(RIGHT, CENTER); text(`Score: ${serverState.shared.score}`, width - 20, 20);
    textAlign(LEFT, CENTER); text(`Lvl: ${serverState.shared.level}`, 20, 45);
    let xpBarWidth = width - 140; let xpBarHeight = 15; let xpBarX = 70; let xpBarY = 37;
    fill(50); rect(xpBarX, xpBarY, xpBarWidth, xpBarHeight, 5);
    let xpPercent = (serverState.shared.xpToNextLevel > 0) ? serverState.shared.currentXP / serverState.shared.xpToNextLevel : 0;
    fill(COLOR_XP_BAR); noStroke(); rect(xpBarX, xpBarY, max(0, xpBarWidth * xpPercent), xpBarHeight, 5);
    fill(COLOR_TEXT); textSize(12); textAlign(CENTER, CENTER); text(`${serverState.shared.currentXP}/${serverState.shared.xpToNextLevel}`, xpBarX + xpBarWidth / 2, xpBarY + xpBarHeight / 2);
    textSize(14); textAlign(LEFT, CENTER);
    // Display acquired perks list from server state
    let perksText = "Perks: " + (serverState.shared.acquiredPerks.length > 0 ? serverState.shared.acquiredPerks.join(', ') : "None");
    text(perksText, 20, 70, width - 40);
    textAlign(CENTER, CENTER); textSize(16);
}
function displayStartScreen() { fill(COLOR_TEXT); textSize(48); text("Zombie Annihilator", width / 2, height / 2 - 100); textSize(24); text("Use WASD or Joystick to Move", width / 2, height / 2 - 20); text("Aim with Mouse (Desktop)", width / 2, height / 2 + 20); text("Aim at Nearest Enemy (Mobile)", width / 2, height / 2 + 60); text("Hold SPACE or Move Joystick to Shoot", width / 2, height / 2 + 100); text("Collect XP orbs to Level Up!", width / 2, height/2 + 140); text("Click / Tap to Start", width / 2, height / 2 + 180); }
function displayGameOverScreen() { fill(0, 0, 0, 180); rect(0, 0, width, height); fill(255, 0, 0); textSize(64); text("GAME OVER", width / 2, height / 2 - 80); fill(COLOR_TEXT); textSize(32); text(`Final Score: ${serverState.shared.score}`, width / 2, height / 2); text(`You reached Level ${serverState.shared.level}`, width/2, height/2 + 50); text(`You survived ${serverState.shared.wave > 0 ? serverState.shared.wave -1 : 0} waves!`, width / 2, height / 2 + 100); textSize(24); text("Click / Tap to Play Again", width / 2, height / 2 + 150); }
function displayLevelUpModal(options) {
    let modalW = width * 0.6; let modalH = height * 0.5; let modalX = (width - modalW) / 2; let modalY = (height - modalH) / 2;
    fill(COLOR_MODAL_BG); stroke(COLOR_TEXT); strokeWeight(2); rect(modalX, modalY, modalW, modalH, 15);
    fill(COLOR_TEXT); noStroke(); textSize(32); text("Level Up!", modalX + modalW / 2, modalY + 40);
    textSize(20); text("Choose an Upgrade:", modalX + modalW / 2, modalY + 80);
    levelUpButtons = []; let buttonW = modalW * 0.8; let buttonH = 60; let buttonSpacing = 25; let startY = modalY + 120;
    let numOptions = options ? options.length : 0; startY += ( (3 - numOptions) * (buttonH + buttonSpacing) ) / 2;
    for (let i = 0; i < numOptions; i++) {
        let optionData = options[i]; let upgradeName = ""; let upgradeDesc = ""; let perkIdToSend = "";
        let localPerkDef = upgradePool.find(p => p.id === optionData || p.name === optionData || (typeof optionData === 'object' && (p.id === optionData.id || p.name === optionData.name)));
        if (localPerkDef) { upgradeName = localPerkDef.name; upgradeDesc = localPerkDef.description; perkIdToSend = localPerkDef.id; }
        else if (typeof optionData === 'string') { upgradeName = optionData; upgradeDesc = "Select this perk!"; perkIdToSend = optionData; }
        else { upgradeName = "Unknown Perk"; upgradeDesc = "Error loading perk data."; perkIdToSend = "error"; }
        let btnX = modalX + (modalW - buttonW) / 2; let btnY = startY + i * (buttonH + buttonSpacing);
        levelUpButtons.push({ x: btnX, y: btnY, w: buttonW, h: buttonH, perk: perkIdToSend });
        let isHovering = mouseX > btnX && mouseX < btnX + buttonW && mouseY > btnY && mouseY < btnY + buttonH;
        fill(isHovering ? COLOR_BUTTON_HOVER_BG : COLOR_BUTTON_BG); stroke(COLOR_TEXT); strokeWeight(1); rect(btnX, btnY, buttonW, buttonH, 10);
        fill(COLOR_BUTTON_TEXT); noStroke(); textSize(18); textAlign(CENTER, CENTER); text(upgradeName, btnX + buttonW / 2, btnY + buttonH / 2 - 10);
        textSize(12); text(upgradeDesc, btnX + buttonW / 2, btnY + buttonH / 2 + 10);
    }
    textAlign(CENTER, CENTER); textSize(16);
}
function defineUpgrades() { upgradePool = [ { id: 'speed_up', name: "Fleet Footed", description: "Increases movement speed significantly.", }, { id: 'health_boost', name: "Extra Vitality", description: "Increases Max Health by 50 and fully heals.", }, { id: 'damage_boost', name: "Sharper Rounds", description: "Increases bullet damage by 10.", }, { id: 'fire_rate_up', name: "Rapid Fire", description: "Increases fire rate substantially.", }, { id: 'xp_gain_up', name: "Quick Learner", description: "Increases XP gained from orbs by 50%.", }, { id: 'regen_boost', name: "Enhanced Regeneration", description: "Slowly regenerate 0.5 health per second.", }, { id: 'piercing_shots', name: "Piercing Rounds+", description: "Bullets hit +2 additional enemies.", }, { id: 'multi_shot', name: "Double Barrel", description: "Fire +2 projectiles per shot.", }, { id: 'energy_shield', name: "Energy Shield", description: "Gain/Improve a shield that absorbs damage (Max +50).", }, { id: 'xp_magnet', name: "XP Magnet+", description: "Greatly increases the XP orb attraction range.", }, { id: 'xp_vacuum', name: "XP Vacuum", description: "Automatically collect all XP orbs every 20 seconds.", }, { id: 'crit_chance', name: "Critical Precision", description: "Gain a 10% chance to deal 2x bullet damage.", }, { id: 'crit_damage', name: "Devastating Blows", description: "Increases critical hit damage multiplier by 1x.", }, { id: 'faster_bullets', name: "High Velocity", description: "Increases bullet speed by 25%.", }, { id: 'dot_chance', name: "Toxic Coating", description: "Bullets have a 15% chance to poison enemies.", }, { id: 'dot_damage', name: "Virulent Venom", description: "Increases poison damage per second.", }, { id: 'ricochet', name: "Ricochet Rounds", description: "Bullets bounce off edges +1 time.", }, { id: 'giant_bullets', name: "Giant Bullets", description: "Increases bullet size by 25%.", }, { id: 'thorns', name: "Thorns Aura", description: "Deal 5 damage back to enemies that hit you.", }, { id: 'adrenaline', name: "Adrenaline Rush", description: "Gain temporary speed/fire rate after taking damage.", }, { id: 'last_stand', name: "Last Stand", description: "Become invincible for 2s when health drops below 20%. (Once per wave)", }, { id: 'health_on_kill', name: "Vampirism", description: "Restore 1 health for every kill.", }, { id: 'damage_reduction', name: "Tough Skin", description: "Reduce all incoming damage by 10%. (Max 50%)", }, { id: 'greed', name: "Greed is Good", description: "Increases score gained from kills by 25%.", }, { id: 'orb_doubler', name: "Orb Doubler", description: "Gain a 10% chance for enemies to drop 2 XP orbs.", }, { id: 'wave_clear_bonus', name: "Wave Clear Bonus", description: "Gain a short speed boost after clearing a wave.", }, ]; }

