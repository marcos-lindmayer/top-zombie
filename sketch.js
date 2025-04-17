// === Game Configuration ===
let player;
let bullets = [];
let enemyBullets = []; // Array for zombie projectiles
let zombies = []; // Will contain regular zombies and bosses
let xpBalls = []; // Array to hold experience balls
let particles = []; // Array for visual effects like blood splatter

let score = 0;
let wave = 0; // Start at wave 0, first wave is 1
let zombiesToSpawn = 5;
let zombiesRemaining = 0; // Includes regular zombies and bosses

let gameState = 'start'; // 'start', 'playing', 'levelUp', 'gameOver'

// Upgrade System
let upgradePool = [];
let currentUpgradeOptions = [];
let levelUpModalButtons = []; // To store button bounds for clicking

// Mobile Controls State
let touchMoveId = -1; // ID of the touch controlling movement
let touchMoveBaseX, touchMoveBaseY; // Center of the joystick base
let touchMoveStickX, touchMoveStickY; // Current position of the stick relative to base center
let joystickBaseSize = 120;
let joystickStickSize = 60;
let joystickActive = false; // Flag to know if touch controls are potentially active
let isShootingTouch = false; // Flag for auto-shoot via touch

// Colors
const COLOR_PLAYER = [0, 150, 255]; // Blue
const COLOR_BULLET = [255, 255, 0]; // Yellow
const COLOR_ENEMY_BULLET = [255, 100, 100]; // Reddish for enemy bullets
const COLOR_ZOMBIE = [0, 180, 0];   // Green
const COLOR_ZOMBIE_HEAD = [0, 140, 0]; // Slightly darker green for head
const COLOR_SHOOTER_ZOMBIE_TINT = [200, 200, 0, 100]; // Yellow tint for shooters
const COLOR_DOT_EFFECT = [100, 255, 100, 150]; // Greenish tint for DOT
const COLOR_MINIBOSS_BODY = [80, 0, 80]; // Dark Purple
const COLOR_MINIBOSS_HEAD = [120, 0, 120]; // Lighter Purple
const COLOR_GIGABOSS_BODY = [60, 60, 60]; // Dark Gray
const COLOR_GIGABOSS_ACCENT = [255, 0, 0]; // Red Accent
const COLOR_BLOOD = [200, 0, 0];    // Red for blood particles
const COLOR_XP_BALL = [255, 165, 0]; // Orange for XP
const COLOR_BACKGROUND = [50, 50, 50]; // Dark Gray
const COLOR_TEXT = [255, 255, 255]; // White
const COLOR_HUD_BG = [0, 0, 0, 150]; // Semi-transparent black
const COLOR_XP_BAR = [255, 165, 0]; // Orange for XP bar fill
const COLOR_SHIELD = [100, 180, 255, 100]; // Light blue semi-transparent for shield visual
const COLOR_MODAL_BG = [40, 40, 60, 230]; // Dark blueish semi-transparent
const COLOR_BUTTON_BG = [80, 80, 120];
const COLOR_BUTTON_HOVER_BG = [110, 110, 160];
const COLOR_BUTTON_TEXT = [255, 255, 255];
const COLOR_JOYSTICK_BASE = [100, 100, 100, 100]; // Semi-transparent gray
const COLOR_JOYSTICK_STICK = [150, 150, 150, 150];

// Game Balance / Config
const SHOOTER_ZOMBIE_CHANCE = 0.15; // 15% chance for a zombie to be a shooter
const ZOMBIE_SHOOT_COOLDOWN = 120; // Frames between shots (2 seconds)
const ENEMY_BULLET_SPEED = 4;
const ENEMY_BULLET_DAMAGE = 5;
const MINIBOSS_HEALTH_BASE = 200;
const MINIBOSS_HEALTH_SCALE = 50; // Extra health per wave it appears
const MINIBOSS_XP_DROP_MULTIPLIER = 10; // How many regular XP drops the mini-boss is worth
const GIGABOSS_HEALTH_BASE = 800;
const GIGABOSS_HEALTH_SCALE = 200; // Extra health per wave it appears
const GIGABOSS_XP_DROP_MULTIPLIER = 30; // How many regular XP drops the giga-boss is worth
const BASE_XP_PER_ORB = 100; // << INCREASED XP per orb (was 50)
const BASE_XP_TO_LEVEL = 50; // Lowered initial XP requirement
const XP_LEVEL_SCALING_FACTOR = 1.25; // Lowered scaling factor
const PLAYER_BASE_SPEED = 4.0; // Slightly increased base speed

// === P5.js Functions ===

function setup() {
  createCanvas(windowWidth * 0.9, windowHeight * 0.8); // Responsive canvas
  player = new Player(width / 2, height / 2);
  defineUpgrades(); // Define the pool of available upgrades
  angleMode(RADIANS); // Use radians for angles
  textAlign(CENTER, CENTER);
  textSize(16); // Default text size

  // Initialize Joystick position
  touchMoveBaseX = joystickBaseSize * 0.8;
  touchMoveBaseY = height - joystickBaseSize * 0.8;
  touchMoveStickX = touchMoveBaseX;
  touchMoveStickY = touchMoveBaseY;
}

function draw() {
  // --- Game State Logic ---
  switch (gameState) {
    case 'start':
      background(COLOR_BACKGROUND);
      displayStartScreen();
      break;
    case 'playing':
      background(COLOR_BACKGROUND);
      runGame();
      if (joystickActive) drawJoystick(); // Draw joystick if touch detected
      break;
    case 'levelUp':
      // Draw paused game state
      player.display();
      for(let b of bullets) b.display();
      for(let eb of enemyBullets) eb.display();
      for(let z of zombies) z.display();
      for(let x of xpBalls) x.display();
      for(let p of particles) p.display();
      displayHUD();
      if (joystickActive) drawJoystick(); // Also draw joystick when paused
      // Draw modal on top
      displayLevelUpModal();
      break;
    case 'gameOver':
      background(COLOR_BACKGROUND);
      displayGameOverScreen();
      break;
  }
}

// Handle Touch Start
function touchStarted() {
  joystickActive = true; // Assume touch device if touch event occurs
  // Check if starting touch is within the joystick base area
  if (touchMoveId === -1) { // Only capture if joystick isn't already controlled
    for (let i = 0; i < touches.length; i++) {
        let touch = touches[i];
        let d = dist(touch.x, touch.y, touchMoveBaseX, touchMoveBaseY);
        // Allow starting touch slightly outside base for easier activation
        if (d < joystickBaseSize * 0.75) {
            touchMoveId = touch.id;
            // Update stick position immediately, clamped
            updateJoystickStick(touch.x, touch.y);
            return false; // Prevent default browser actions
        }
    }
  }

  // Handle clicks for starting/restarting game on mobile
   if (gameState === 'start' || gameState === 'gameOver') {
        startNewGame();
        gameState = 'playing';
        return false; // Prevent default
   }
   // Handle clicks for level up modal on mobile
   if (gameState === 'levelUp') {
       for (let i = 0; i < levelUpModalButtons.length; i++) {
            let btn = levelUpModalButtons[i];
            // Use first touch for button interaction
            if (touches[0] && touches[0].x > btn.x && touches[0].x < btn.x + btn.w && touches[0].y > btn.y && touches[0].y < btn.y + btn.h) {
                currentUpgradeOptions[i].applyEffect(player);
                player.acquiredUpgrades.push(currentUpgradeOptions[i].name);
                currentUpgradeOptions = [];
                levelUpModalButtons = [];
                gameState = 'playing';
                // Reset joystick state after modal interaction
                resetJoystick();
                return false; // Prevent default
            }
        }
   }

  return true; // Allow default actions if touch wasn't handled
}

// Handle Touch Movement
function touchMoved() {
  joystickActive = true;
  // Find the touch that matches the captured ID
  for (let i = 0; i < touches.length; i++) {
    let touch = touches[i];
    if (touch.id === touchMoveId) {
      updateJoystickStick(touch.x, touch.y);
      return false; // Prevent default browser scrolling
    }
  }
  return true;
}

// Handle Touch End
function touchEnded() {
  joystickActive = true;
  // Check if the ended touch was the one controlling the joystick
  for (let i = 0; i < touches.length; i++) { // Check remaining touches
      // This logic is tricky with p5's `touches` array after end.
      // It's safer to check the ID passed implicitly by the event system if available,
      // but p5 might not provide it directly here. We reset if *any* touch ends
      // while an ID is active, or more robustly, check if the active ID is *no longer*
      // present in the `touches` array.
      // Simple approach: Reset if the touchMoveId is active.
      if (touchMoveId !== -1) {
         // A touch ended, was it ours? P5 doesn't tell us which one easily.
         // Let's check if our tracked ID is still present in the touches array.
         let stillTouching = false;
         for (let j = 0; j < touches.length; j++) {
             if (touches[j].id === touchMoveId) {
                 stillTouching = true;
                 break;
             }
         }
         if (!stillTouching) {
             resetJoystick();
         }
      }
  }
   // Also check if touches array is empty after the event
   if (touches.length === 0) {
        resetJoystick();
   }

  return false; // Prevent default actions
}

// Helper to update joystick stick position
function updateJoystickStick(x, y) {
    let vec = createVector(x - touchMoveBaseX, y - touchMoveBaseY);
    // Clamp the vector magnitude to the size of the joystick base radius
    let maxDist = joystickBaseSize / 2;
    if (vec.magSq() > maxDist * maxDist) { // Use magSq for efficiency
        vec.setMag(maxDist);
    }
    touchMoveStickX = touchMoveBaseX + vec.x;
    touchMoveStickY = touchMoveBaseY + vec.y;
}

// Helper to reset joystick state
function resetJoystick() {
    touchMoveId = -1;
    touchMoveStickX = touchMoveBaseX;
    touchMoveStickY = touchMoveBaseY;
    isShootingTouch = false; // Stop auto-shooting
}

// Draw the virtual joystick
function drawJoystick() {
    push();
    // Draw Base
    fill(COLOR_JOYSTICK_BASE);
    noStroke();
    ellipse(touchMoveBaseX, touchMoveBaseY, joystickBaseSize, joystickBaseSize);

    // Draw Stick
    fill(COLOR_JOYSTICK_STICK);
    ellipse(touchMoveStickX, touchMoveStickY, joystickStickSize, joystickStickSize);
    pop();
}


// Mouse Pressed function only handles desktop clicks for modal/start/restart
function mousePressed() {
   // Only handle mouse clicks if NOT using touch (prevents double actions)
   if (!joystickActive) {
        if (gameState === 'start') {
            startNewGame();
            gameState = 'playing';
        } else if (gameState === 'gameOver') {
            startNewGame();
            gameState = 'playing';
        } else if (gameState === 'levelUp') {
            for (let i = 0; i < levelUpModalButtons.length; i++) {
                let btn = levelUpModalButtons[i];
                if (mouseX > btn.x && mouseX < btn.x + btn.w && mouseY > btn.y && mouseY < btn.y + btn.h) {
                    currentUpgradeOptions[i].applyEffect(player);
                    player.acquiredUpgrades.push(currentUpgradeOptions[i].name);
                    currentUpgradeOptions = [];
                    levelUpModalButtons = [];
                    gameState = 'playing';
                    break;
                }
            }
        }
   }
}


// Handle window resize
function windowResized() {
  resizeCanvas(windowWidth * 0.9, windowHeight * 0.8);
  // Recalculate joystick base position
  touchMoveBaseX = joystickBaseSize * 0.8;
  touchMoveBaseY = height - joystickBaseSize * 0.8;
  // Reset stick position if not actively touched
  if (touchMoveId === -1) {
      touchMoveStickX = touchMoveBaseX;
      touchMoveStickY = touchMoveBaseY;
  }
}

// === Game Logic Functions ===

function runGame() {
  // --- Handle Player ---
  player.update(); // Includes cooldown updates, aiming, and shooting
  player.display();
  player.checkBoundaryCollision(); // Keep player on screen

  // --- Handle XP Vacuum ---
  if (player.hasXPVacuum && player.xpVacuumTimer <= 0) {
      // Collect all XP balls instantly
      for (let i = xpBalls.length - 1; i >= 0; i--) {
          player.gainXP(xpBalls[i].xpValue);
          xpBalls.splice(i, 1);
      }
      player.xpVacuumTimer = player.xpVacuumCooldown; // Reset timer
      // Optional: Add vacuum sound/visual effect
      // Check game state immediately in case gainXP triggered level up
      if (gameState !== 'playing') return;
  }

  // --- Handle Player Bullets ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    // Ensure bullet exists (might be spliced mid-loop due to piercing)
    if (!bullets[i]) continue;

    bullets[i].update(); // Update bullet position and check ricochet
    bullets[i].display();

    // Check bullet collision with zombies
    for (let j = zombies.length - 1; j >= 0; j--) {
        // Ensure bullet and zombie exist
       if (!bullets[i] || !zombies[j]) continue;

       if (bullets[i].hits(zombies[j])) {
            // Calculate damage (Check for Crit)
            let actualDamage = bullets[i].damage;
            let isCrit = false;
            if (random(1) < player.critChance) {
                actualDamage *= player.critMultiplier;
                isCrit = true;
            }

            zombies[j].takeDamage(actualDamage); // Zombie takes damage

            // Apply DOT effect
            if (player.dotChance > 0 && random(1) < player.dotChance) {
                zombies[j].applyDOT(player.dotDamage, player.dotDuration);
            }

            // Spawn blood particles on hit
            spawnBloodParticles(zombies[j].pos.x, zombies[j].pos.y, isCrit); // Pass crit status

            bullets[i].pierceCount--; // Decrement pierce count

            // Remove bullet ONLY if pierce count is zero or less
            if (bullets[i].pierceCount <= 0) {
                bullets.splice(i, 1);
                // Optional: Add hit sound effect
                break; // Exit inner loop (checking zombies) since bullet is gone
            }
            // If piercing, don't break, let bullet check other zombies
       }
    }

    // Remove bullets that go off-screen (check after collision check)
    // Ensure bullet exists before checking isOnScreen
    if (bullets[i] && !bullets[i].isOnScreen()) {
       bullets.splice(i, 1);
    }
  }

   // --- Handle Enemy Bullets ---
   for (let i = enemyBullets.length - 1; i >= 0; i--) {
       enemyBullets[i].update();
       enemyBullets[i].display();

       // Check collision with player
       if (enemyBullets[i].hits(player)) {
           player.takeDamage(enemyBullets[i].damage);
           enemyBullets.splice(i, 1); // Remove bullet on hit
           // Optional: player hit sound
       }
       // Remove if off-screen
       else if (!enemyBullets[i].isOnScreen()) {
           enemyBullets.splice(i, 1);
       }
   }


  // --- Handle Zombies (Regular and Bosses) ---
  for (let i = zombies.length - 1; i >= 0; i--) {
    // Ensure zombie exists
    if (!zombies[i]) continue;

    zombies[i].update(player.pos); // Zombies chase, shoot, take DOT
    zombies[i].display();

    // Check zombie collision with player
    if (zombies[i].hits(player)) {
      player.takeDamage(zombies[i].damage); // Player takes damage (shield absorbs first)
      // Apply Thorns damage back to zombie
      if (player.thornsDamage > 0) {
          zombies[i].takeDamage(player.thornsDamage);
          // Spawn small effect for thorns?
      }

      // Decide if zombie dies on collision (maybe boss doesn't?)
      // For now, all zombies die on collision
      zombies.splice(i, 1);
      zombiesRemaining--;
      // Optional: Add player hit sound effect
    }
    // Check if zombie is dead from shooting or DOT
    else if (zombies[i].isDead()) {
        score += floor(zombies[i].scoreValue * player.scoreMultiplier); // Apply score multiplier

        // Health on Kill
        if (player.healthOnKillAmount > 0) {
            player.heal(player.healthOnKillAmount);
        }

        // Orb Doubler Chance
        let orbDropCount = 1;
        if (player.orbDoubleChance > 0 && random(1) < player.orbDoubleChance) {
            orbDropCount = 2;
        }

        // Spawn an XP ball (bosses drop more)
        let xpDropMultiplier = 1; // Default for regular zombie
        if (zombies[i] instanceof GigaBoss) {
            xpDropMultiplier = GIGABOSS_XP_DROP_MULTIPLIER;
        } else if (zombies[i] instanceof MiniBoss) {
             xpDropMultiplier = MINIBOSS_XP_DROP_MULTIPLIER;
        }

        for(let k=0; k < xpDropMultiplier * orbDropCount; k++) {
             xpBalls.push(new ExperienceBall(zombies[i].pos.x + random(-15,15), zombies[i].pos.y + random(-15,15))); // Wider spread for bosses
        }
        zombies.splice(i, 1); // Remove the dead zombie
        zombiesRemaining--;
        // Optional: Add zombie death sound
    }
  }

  // --- Handle Experience Balls ---
  for (let i = xpBalls.length - 1; i >= 0; i--) {
      xpBalls[i].update(player); // Pass player for pickup radius check
      xpBalls[i].display();

      // Check collision with player
      if (xpBalls[i].hits(player)) {
          player.gainXP(xpBalls[i].xpValue); // Player gains XP (might trigger level up)
          xpBalls.splice(i, 1); // Remove the collected ball
          // Optional: Add XP collection sound
          // Check game state immediately in case gainXP triggered level up
          if (gameState !== 'playing') return; // Exit runGame if state changed
      }
  }

  // --- Handle Particles ---
  for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].display();
      if (particles[i].isDead()) {
          particles.splice(i, 1);
      }
  }


  // --- Handle Waves ---
  // Only start next wave if not leveling up and all zombies (+bosses) are cleared
  if (zombiesRemaining <= 0 && zombies.length === 0 && gameState === 'playing') {
    startNextWave();
  }

  // --- Check Game Over ---
  if (player.isDead()) {
    gameState = 'gameOver';
    // Optional: Add game over sound
  }

  // --- Display HUD ---
  displayHUD();
}

function startNewGame() {
    score = 0;
    wave = 0;
    zombiesToSpawn = 5;
    zombiesRemaining = 0;
    zombies = []; // Clear zombies and bosses
    bullets = [];
    enemyBullets = []; // Clear enemy bullets
    xpBalls = []; // Clear XP balls
    particles = []; // Clear particles
    player = new Player(width / 2, height / 2); // Reset player (resets level/XP/stats/perks too)
    currentUpgradeOptions = []; // Clear any lingering upgrade options
    levelUpModalButtons = [];
    resetJoystick(); // Ensure joystick is reset
    // Start first wave immediately? Or wait for runGame loop? Let's wait.
}


function startNextWave() {
    wave++;
    let baseZombiesThisWave = 5 + wave * 2; // Base number of regular zombies
    zombiesRemaining = 0; // Reset before adding

    let spawnGigaBoss = (wave > 0 && wave % 5 === 0);
    let spawnMiniBoss = (wave > 0 && wave % 2 === 0 && !spawnGigaBoss); // Don't spawn mini if giga is spawning

    let actualZombiesToSpawn = baseZombiesThisWave;

    // Spawn Giga Boss if applicable
    if (spawnGigaBoss) {
        spawnGigaBossFunc(); // New helper function
        zombiesRemaining++;
        actualZombiesToSpawn = floor(baseZombiesThisWave * 0.5); // Fewer regular zombies on Giga Boss waves
    }
    // Spawn Mini Boss if applicable (and no Giga Boss)
    else if (spawnMiniBoss) {
        spawnMiniBossFunc(); // Use existing helper
        zombiesRemaining++;
        // actualZombiesToSpawn = floor(baseZombiesThisWave * 0.8); // Optional: Fewer regular zombies
    }

    // Spawn regular zombies
    spawnZombies(actualZombiesToSpawn);
    zombiesRemaining += actualZombiesToSpawn;


    // Apply Wave Clear Bonus
    if (player.waveClearBonusDuration > 0) {
        player.activateWaveClearBonus();
    }

    // Optional: Display "Wave X Starting" message briefly
}

function spawnZombies(count) {
  for (let i = 0; i < count; i++) {
    let pos = getRandomSpawnPosition();
    // Increase zombie speed slightly with waves, cap it
    let zombieSpeed = min(1 + wave * 0.1, 3);
    // Increase zombie health slightly with waves
    let zombieHealth = 30 + wave * 5;
    // Chance to be a shooter
    let isShooter = random(1) < SHOOTER_ZOMBIE_CHANCE;
    zombies.push(new Zombie(pos.x, pos.y, zombieSpeed, zombieHealth, isShooter));
  }
}

// Extracted MiniBoss spawning logic
function spawnMiniBossFunc() {
    let pos = getRandomSpawnPosition();
    let bossHealth = MINIBOSS_HEALTH_BASE + floor(wave / 2) * MINIBOSS_HEALTH_SCALE; // Scale health properly
    let bossSpeed = 0.8; // Slower than regular zombies
    zombies.push(new MiniBoss(pos.x, pos.y, bossSpeed, bossHealth));
}

// New GigaBoss spawning logic
function spawnGigaBossFunc() {
    let pos = getRandomSpawnPosition(); // Spawn Giga Boss like others for now
    let bossHealth = GIGABOSS_HEALTH_BASE + floor(wave / 5) * GIGABOSS_HEALTH_SCALE; // Scale health properly
    let bossSpeed = 0.5; // Even slower
    zombies.push(new GigaBoss(pos.x, pos.y, bossSpeed, bossHealth));
}


// Helper function to get a random spawn position off-screen
function getRandomSpawnPosition() {
    let edge = floor(random(4)); // 0: top, 1: right, 2: bottom, 3: left
    let x, y;
    let buffer = 50; // Spawn slightly off-screen

    switch (edge) {
      case 0: x = random(width); y = -buffer; break;
      case 1: x = width + buffer; y = random(height); break;
      case 2: x = random(width); y = height + buffer; break;
      case 3: x = -buffer; y = random(height); break;
    }
    return createVector(x,y);
}


// Function to spawn blood particles
function spawnBloodParticles(x, y, isCrit = false) { // Added crit flag
    let numParticles = isCrit ? 15 : 5 + floor(random(3)); // More particles for crits
    let particleColor = isCrit ? COLOR_BULLET : COLOR_BLOOD; // Yellow flash for crit particles
    let baseSpeed = isCrit ? 2 : 1;
    let speedRange = isCrit ? 4 : 3;
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle(x, y, particleColor, baseSpeed, speedRange));
    }
}


function displayHUD() {
  // Draw a semi-transparent background for the HUD
  let hudHeight = 90; // Increased height for perks list
  fill(COLOR_HUD_BG);
  noStroke();
  rect(0, 0, width, hudHeight);

  // Display Text: Health, Wave, Score
  fill(COLOR_TEXT);
  textSize(18);
  textAlign(LEFT, CENTER);
  // Display Shield value if player has one
  let healthText = `Health: ${floor(player.health)} / ${player.maxHealth}`;
  if (player.maxShieldHealth > 0) {
      healthText += ` (Shield: ${floor(player.shieldHealth)})`;
  }
  text(healthText, 20, 20);

  textAlign(CENTER, CENTER);
  text(`Wave: ${wave}`, width / 2, 20);
  textAlign(RIGHT, CENTER);
  text(`Score: ${score}`, width - 20, 20);

  // Display Level and XP Bar
  textAlign(LEFT, CENTER);
  text(`Level: ${player.level}`, 20, 45); // Adjusted Y position

  // XP Bar Background
  let xpBarWidth = 200;
  let xpBarHeight = 15;
  let xpBarX = 100; // Position it next to "Level:" text
  let xpBarY = 37; // Adjusted Y position
  fill(50); // Dark background for the bar
  rect(xpBarX, xpBarY, xpBarWidth, xpBarHeight, 5); // Rounded corners

  // XP Bar Fill
  let xpPercent = player.currentXP / player.xpToNextLevel;
  fill(COLOR_XP_BAR);
  noStroke();
  // Ensure width is not negative if somehow currentXP > xpToNextLevel briefly
  rect(xpBarX, xpBarY, max(0, xpBarWidth * xpPercent), xpBarHeight, 5);

  // XP Text on Bar
  fill(COLOR_TEXT);
  textSize(12);
  textAlign(CENTER, CENTER);
  text(`${player.currentXP} / ${player.xpToNextLevel} XP`, xpBarX + xpBarWidth / 2, xpBarY + xpBarHeight / 2);

  // Display Acquired Perks
  textSize(14);
  textAlign(LEFT, CENTER);
  let perksText = "Perks: " + (player.acquiredUpgrades.length > 0 ? player.acquiredUpgrades.join(', ') : "None");
  // Simple text wrapping if needed (adjust width limit as necessary)
  text(perksText, 20, 70, width - 40); // Use text box for potential wrapping


   // Reset alignment for other text potentially
   textAlign(CENTER, CENTER);
   textSize(16); // Reset default text size
}

function displayStartScreen() {
  fill(COLOR_TEXT);
  textSize(48);
  text("Zombie Annihilator", width / 2, height / 2 - 100); // Moved up slightly more

  textSize(24);
  text("Use WASD or Joystick to Move", width / 2, height / 2 - 20); // Updated
  text("Aim with Mouse (Desktop)", width / 2, height / 2 + 20); // Updated
  text("Hold SPACE or Move Joystick to Shoot", width / 2, height / 2 + 60); // Updated
  text("Collect XP orbs to Level Up!", width / 2, height/2 + 100);
  text("Click / Tap to Start", width / 2, height / 2 + 160); // Updated
}


function displayGameOverScreen() {
   // Keep last frame's visuals but overlay text
   fill(0, 0, 0, 180); // Dark overlay
   rect(0, 0, width, height);

   fill(255, 0, 0); // Red text
   textSize(64);
   text("GAME OVER", width / 2, height / 2 - 80);

   fill(COLOR_TEXT);
   textSize(32);
   text(`Final Score: ${score}`, width / 2, height / 2);
   text(`You reached Level ${player.level}`, width/2, height/2 + 50)
   text(`You survived ${wave -1} waves!`, width / 2, height / 2 + 100);

   textSize(24);
   text("Click / Tap to Play Again", width / 2, height / 2 + 150); // Updated
}

// --- Upgrade System Functions ---

function defineUpgrades() {
    // Perk effectiveness increased for easier start
    upgradePool = [
        // --- Standard Upgrades ---
        {
            id: 'speed_up',
            name: "Fleet Footed",
            description: "Increases movement speed significantly.",
            applyEffect: (p) => { p.speed *= 1.3; }
        },
        {
            id: 'health_boost',
            name: "Extra Vitality",
            description: "Increases Max Health by 50 and fully heals.",
            applyEffect: (p) => { p.maxHealth += 50; p.health = p.maxHealth; }
        },
        {
            id: 'damage_boost',
            name: "Sharper Rounds",
            description: "Increases bullet damage by 10.",
            applyEffect: (p) => { p.bulletDamage += 10; }
        },
        {
            id: 'fire_rate_up',
            name: "Rapid Fire",
            description: "Increases fire rate substantially.",
            applyEffect: (p) => { p.maxFireRateCooldown = max(3, p.maxFireRateCooldown * 0.7); }
        },
        {
            id: 'xp_gain_up',
            name: "Quick Learner",
            description: "Increases XP gained from orbs by 50%.",
            applyEffect: (p) => { p.xpMultiplier += 0.5; }
        },
         {
            id: 'regen_boost',
            name: "Enhanced Regeneration",
            description: "Slowly regenerate 0.5 health per second.",
            applyEffect: (p) => { p.healthRegenRate += 0.5 / 60; }
        },
        // --- Advanced Upgrades ---
        {
            id: 'piercing_shots',
            name: "Piercing Rounds+",
            description: "Bullets hit +2 additional enemies.",
            applyEffect: (p) => { p.maxPierceCount += 2; }
        },
        {
            id: 'multi_shot',
            name: "Double Barrel",
            description: "Fire +2 projectiles per shot.",
            applyEffect: (p) => { p.shotCount += 2; }
        },
        {
            id: 'energy_shield',
            name: "Energy Shield",
            description: "Gain/Improve a shield that absorbs damage (Max +50).",
            applyEffect: (p) => {
                if (p.maxShieldHealth <= 0) {
                    p.maxShieldHealth = 50;
                    p.shieldRegenDelay = 240;
                    p.shieldRegenRate = 0.2;
                } else {
                    p.maxShieldHealth += 50;
                    p.shieldRegenRate += 0.1;
                }
                p.shieldHealth = p.maxShieldHealth;
            }
        },
        {
            id: 'xp_magnet',
            name: "XP Magnet+",
            description: "Greatly increases the XP orb attraction range.",
            applyEffect: (p) => { p.xpPickupRadius *= 1.7; }
        },
        {
            id: 'xp_vacuum',
            name: "XP Vacuum",
            description: "Automatically collect all XP orbs every 20 seconds.",
            applyEffect: (p) => {
                if (!p.hasXPVacuum) {
                   p.hasXPVacuum = true;
                   p.xpVacuumTimer = p.xpVacuumCooldown;
                }
                 p.xpVacuumCooldown = max(300, p.xpVacuumCooldown * 0.8);
            }
        },
        // --- NEWLY ADDED PERKS ---
        {
            id: 'crit_chance',
            name: "Critical Precision",
            description: "Gain a 10% chance to deal 2x bullet damage.",
            applyEffect: (p) => { p.critChance += 0.1; p.critMultiplier = max(p.critMultiplier, 2); } // Set multiplier if not set
        },
        {
            id: 'crit_damage',
            name: "Devastating Blows",
            description: "Increases critical hit damage multiplier by 1x.",
            applyEffect: (p) => { p.critMultiplier += 1; }
        },
        {
            id: 'faster_bullets',
            name: "High Velocity",
            description: "Increases bullet speed by 25%.",
            applyEffect: (p) => { p.bulletSpeedMultiplier += 0.25; }
        },
        {
            id: 'dot_chance',
            name: "Toxic Coating",
            description: "Bullets have a 15% chance to poison enemies.",
            applyEffect: (p) => { p.dotChance += 0.15; p.dotDamage = max(p.dotDamage, 2); p.dotDuration = max(p.dotDuration, 120); } // Set defaults if first time
        },
        {
            id: 'dot_damage',
            name: "Virulent Venom",
            description: "Increases poison damage per second.",
            applyEffect: (p) => { p.dotDamage += 1; } // Increase damage per tick
        },
        {
            id: 'ricochet',
            name: "Ricochet Rounds",
            description: "Bullets bounce off edges +1 time.",
            applyEffect: (p) => { p.maxRicochets += 1; }
        },
        {
            id: 'giant_bullets',
            name: "Giant Bullets",
            description: "Increases bullet size by 25%.",
            applyEffect: (p) => { p.bulletSizeMultiplier += 0.25; }
        },
        {
            id: 'thorns',
            name: "Thorns Aura",
            description: "Deal 5 damage back to enemies that hit you.",
            applyEffect: (p) => { p.thornsDamage += 5; }
        },
        {
            id: 'adrenaline',
            name: "Adrenaline Rush",
            description: "Gain temporary speed/fire rate after taking damage.",
            applyEffect: (p) => { p.hasAdrenaline = true; } // Enable the mechanic
        },
        {
            id: 'last_stand',
            name: "Last Stand",
            description: "Become invincible for 2s when health drops below 20%. (Once per wave)",
            applyEffect: (p) => { p.hasLastStand = true; } // Enable the mechanic
        },
        {
            id: 'health_on_kill',
            name: "Vampirism",
            description: "Restore 1 health for every kill.",
            applyEffect: (p) => { p.healthOnKillAmount += 1; }
        },
        {
            id: 'damage_reduction',
            name: "Tough Skin",
            description: "Reduce all incoming damage by 10%. (Max 50%)",
            applyEffect: (p) => { p.damageReduction = min(0.5, p.damageReduction + 0.1); }
        },
        {
            id: 'greed',
            name: "Greed is Good",
            description: "Increases score gained from kills by 25%.",
            applyEffect: (p) => { p.scoreMultiplier += 0.25; }
        },
        {
            id: 'orb_doubler',
            name: "Orb Doubler",
            description: "Gain a 10% chance for enemies to drop 2 XP orbs.",
            applyEffect: (p) => { p.orbDoubleChance += 0.1; }
        },
        {
            id: 'wave_clear_bonus',
            name: "Wave Clear Bonus",
            description: "Gain a short speed boost after clearing a wave.",
            applyEffect: (p) => { p.waveClearBonusDuration = max(p.waveClearBonusDuration, 180); } // Enable/extend duration
        },

    ];
}

function selectUpgrades() {
    currentUpgradeOptions = [];
    let availableUpgrades = [...upgradePool]; // Copy the pool

    // Prevent offering XP Vacuum if already acquired (it's a one-time toggle)
    if (player.hasXPVacuum) {
        availableUpgrades = availableUpgrades.filter(upg => upg.id !== 'xp_vacuum');
    }
    // Prevent offering Last Stand/Adrenaline enable perks multiple times
    if (player.hasLastStand) {
         availableUpgrades = availableUpgrades.filter(upg => upg.id !== 'last_stand');
    }
     if (player.hasAdrenaline) {
         availableUpgrades = availableUpgrades.filter(upg => upg.id !== 'adrenaline');
    }
    // Add more filtering logic here if needed (e.g., for non-stacking perks like enabling DOT)

    availableUpgrades.sort(() => 0.5 - random()); // Shuffle the array

    // Pick the first 3 unique upgrades from the filtered list
    // Ensure we have enough upgrades to pick from after filtering
    let count = min(3, availableUpgrades.length);
    for (let i = 0; i < count; i++) {
        currentUpgradeOptions.push(availableUpgrades[i]);
    }
}


function displayLevelUpModal() {
    // Modal Box
    let modalW = width * 0.6;
    let modalH = height * 0.5;
    let modalX = (width - modalW) / 2;
    let modalY = (height - modalH) / 2;
    fill(COLOR_MODAL_BG);
    stroke(COLOR_TEXT);
    strokeWeight(2);
    rect(modalX, modalY, modalW, modalH, 15); // Rounded corners

    // Title
    fill(COLOR_TEXT);
    noStroke();
    textSize(32);
    text("Level Up!", modalX + modalW / 2, modalY + 40);
    textSize(20);
    text("Choose an Upgrade:", modalX + modalW / 2, modalY + 80);

    // Display Upgrade Options as Buttons
    levelUpModalButtons = []; // Clear previous button bounds
    let buttonW = modalW * 0.8;
    let buttonH = 60;
    let buttonSpacing = 25;
    let startY = modalY + 120;

    // Handle case where fewer than 3 upgrades might be available
    let numOptions = currentUpgradeOptions.length;
    startY += ( (3 - numOptions) * (buttonH + buttonSpacing) ) / 2; // Center vertically if fewer options

    for (let i = 0; i < numOptions; i++) {
        let upgrade = currentUpgradeOptions[i];
        let btnX = modalX + (modalW - buttonW) / 2;
        let btnY = startY + i * (buttonH + buttonSpacing);

        // Store button bounds for click detection
        levelUpModalButtons.push({ x: btnX, y: btnY, w: buttonW, h: buttonH });

        // Check for hover state
        let isHovering = mouseX > btnX && mouseX < btnX + buttonW && mouseY > btnY && mouseY < btnY + buttonH;
        fill(isHovering ? COLOR_BUTTON_HOVER_BG : COLOR_BUTTON_BG);
        stroke(COLOR_TEXT);
        strokeWeight(1);
        rect(btnX, btnY, buttonW, buttonH, 10);

        // Button Text
        fill(COLOR_BUTTON_TEXT);
        noStroke();
        textSize(18);
        textAlign(CENTER, CENTER);
        text(upgrade.name, btnX + buttonW / 2, btnY + buttonH / 2 - 10);
        textSize(12);
        text(upgrade.description, btnX + buttonW / 2, btnY + buttonH / 2 + 10);
    }
    // Reset text alignment and size
    textAlign(CENTER, CENTER);
    textSize(16);
}


// === Classes ===

class Player {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.size = 25;
    this.angle = -PI / 2;
    this.speed = PLAYER_BASE_SPEED;
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.color = COLOR_PLAYER;
    this.damageTakenCooldown = 0;

    // XP and Leveling
    this.level = 1;
    this.currentXP = 0;
    this.xpToNextLevel = BASE_XP_TO_LEVEL;
    this.levelUpEffectTimer = 0;
    this.xpMultiplier = 1.0;
    this.healthRegenRate = 0;
    this.acquiredUpgrades = [];
    this.xpPickupRadius = 80;
    this.scoreMultiplier = 1.0; // For Greed perk
    this.orbDoubleChance = 0; // For Orb Doubler perk

    // Combat Stats
    this.bulletDamage = 10;
    this.maxFireRateCooldown = 20;
    this.fireRateCooldown = 0;
    this.maxPierceCount = 1;
    this.shotCount = 1;
    this.shotSpreadAngle = 0.15;
    this.critChance = 0; // For Critical Strike perk
    this.critMultiplier = 1.5; // Base crit multiplier (can be increased)
    this.bulletSpeedMultiplier = 1.0; // For Faster Bullets perk
    this.bulletSizeMultiplier = 1.0; // For Giant Bullets perk
    this.dotChance = 0; // For DOT perk
    this.dotDamage = 0; // Damage per second for DOT
    this.dotDuration = 0; // Frames duration for DOT
    this.maxRicochets = 0; // For Ricochet perk

    // Shield Stats
    this.shieldHealth = 0;
    this.maxShieldHealth = 0;
    this.shieldRegenDelay = 300;
    this.shieldRegenTimer = 0;
    this.shieldRegenRate = 0;

    // XP Vacuum Perk
    this.hasXPVacuum = false;
    this.xpVacuumCooldown = 1200; // Reduced base cooldown (20s @ 60fps)
    this.xpVacuumTimer = 0;

    // Defensive / Utility Perks
    this.thornsDamage = 0; // For Thorns perk
    this.hasAdrenaline = false; // Enable Adrenaline Rush
    this.adrenalineTimer = 0;
    this.adrenalineDuration = 120; // 2 seconds
    this.adrenalineSpeedBonus = 1.5; // 50% speed boost
    this.adrenalineFireRateBonus = 0.5; // Halve fire cooldown
    this.hasLastStand = false; // Enable Last Stand
    this.lastStandThreshold = 0.2; // 20% health
    this.lastStandDuration = 120; // 2 seconds invincibility
    this.lastStandTimer = 0;
    this.lastStandCooldown = 1800; // 30s cooldown per wave
    this.lastStandCooldownTimer = 0; // Timer for cooldown
    this.healthOnKillAmount = 0; // For Vampirism perk
    this.damageReduction = 0; // For Tough Skin perk (0 to 1)
    this.waveClearBonusDuration = 0; // For Wave Clear Bonus perk
    this.waveClearBonusTimer = 0;
    this.waveClearSpeedBonus = 1.4; // 40% speed boost
  }

  update() {
    // --- Passive Effects ---
    // Health Regen
    if (this.healthRegenRate > 0 && this.health < this.maxHealth) {
        this.health += this.healthRegenRate;
        this.health = min(this.health, this.maxHealth);
    }
    // Shield Regen
    if (this.maxShieldHealth > 0) {
        if (this.shieldRegenTimer > 0) {
            this.shieldRegenTimer--;
        } else if (this.shieldHealth < this.maxShieldHealth) {
            this.shieldHealth += this.shieldRegenRate;
            this.shieldHealth = min(this.shieldHealth, this.maxShieldHealth);
        }
    }
    // XP Vacuum Timer
    if (this.hasXPVacuum && this.xpVacuumTimer > 0) {
        this.xpVacuumTimer--;
    }
    // Adrenaline Timer
    let currentSpeed = this.speed;
    let currentFireRateCooldown = this.maxFireRateCooldown;
    if (this.adrenalineTimer > 0) {
        currentSpeed *= this.adrenalineSpeedBonus;
        currentFireRateCooldown *= this.adrenalineFireRateBonus;
        this.adrenalineTimer--;
    }
    // Last Stand Cooldown Timer
    if (this.lastStandCooldownTimer > 0) {
        this.lastStandCooldownTimer--;
    }
    // Last Stand Invincibility Timer
    if (this.lastStandTimer > 0) {
        this.lastStandTimer--;
        // Override damage cooldown to maintain invincibility
        this.damageTakenCooldown = max(this.damageTakenCooldown, this.lastStandTimer);
    }
    // Wave Clear Bonus Timer
    if (this.waveClearBonusTimer > 0) {
        currentSpeed *= this.waveClearSpeedBonus;
        this.waveClearBonusTimer--;
    }


    // --- Input Handling ---
    let isMovingWithTouch = false;
    let moveVector = createVector(0, 0);

    // Touch Controls (Joystick)
    if (touchMoveId !== -1) {
        joystickActive = true; // Keep flag active if touch is down
        let stickVec = createVector(touchMoveStickX - touchMoveBaseX, touchMoveStickY - touchMoveBaseY);
        let stickMag = stickVec.mag();
        let maxDist = joystickBaseSize / 2;

        if (stickMag > maxDist * 0.1) { // Add a small deadzone
             isMovingWithTouch = true;
             moveVector = stickVec.limit(maxDist); // Use the clamped vector for direction/speed scaling
             this.vel = moveVector.copy().normalize().mult(currentSpeed); // Use potentially boosted speed
             this.angle = moveVector.heading(); // Aim in movement direction
             isShootingTouch = true; // Auto-shoot when moving with touch
        } else {
             this.vel.set(0, 0); // Stop if stick is centered
             isShootingTouch = false;
        }
    }
    // Keyboard Controls (Only if touch is not active)
    else if (!isMovingWithTouch) {
        joystickActive = false; // No active touch controlling joystick
        isShootingTouch = false;
        // Aiming (Mouse)
        this.angle = atan2(mouseY - this.pos.y, mouseX - this.pos.x);
        // Movement (WASD)
        this.vel.set(0, 0);
        if (keyIsDown(87) || keyIsDown(UP_ARROW)) { this.vel.y = -1; }
        if (keyIsDown(83) || keyIsDown(DOWN_ARROW)) { this.vel.y = 1; }
        if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) { this.vel.x = -1; }
        if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) { this.vel.x = 1; }

        if (this.vel.mag() > 0) {
            this.vel.normalize();
            this.vel.mult(currentSpeed); // Use potentially boosted speed
        }
    }

    this.pos.add(this.vel); // Apply final velocity

    // Shooting (Spacebar OR Touch Move)
    if (keyIsDown(32) || isShootingTouch) {
        if (this.fireRateCooldown <= 0) {
            for (let i = 0; i < this.shotCount; i++) {
                let angleOffset = (i - (this.shotCount - 1) / 2) * this.shotSpreadAngle;
                let fireAngle = this.angle + angleOffset;
                bullets.push(new Bullet(
                    this.pos.x, this.pos.y, fireAngle,
                    this.bulletDamage, this.maxPierceCount,
                    this.bulletSpeedMultiplier, this.bulletSizeMultiplier,
                    this.maxRicochets
                ));
            }
            this.fireRateCooldown = currentFireRateCooldown; // Use potentially boosted fire rate
        }
    }

    // Decrease cooldown timers
    if (this.damageTakenCooldown > 0) { this.damageTakenCooldown--; }
    if (this.levelUpEffectTimer > 0) { this.levelUpEffectTimer--; }
    if (this.fireRateCooldown > 0) { this.fireRateCooldown--; }
  }

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

    // Adrenaline / Wave Bonus Visual? (e.g., trail or glow)
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
    if (this.damageTakenCooldown > 0 && this.lastStandTimer <= 0 && frameCount % 10 < 5) { // Don't flash during last stand
        fill(255, 0, 0, 150);
        noStroke();
        ellipse(this.pos.x, this.pos.y, this.size * 1.5, this.size * 1.5);
    }
    // Last Stand Invincibility Visual
    if (this.lastStandTimer > 0) {
        let alpha = map(this.lastStandTimer, this.lastStandDuration, 0, 150, 50);
        stroke(255, 255, 255, alpha); // White pulsing stroke
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

  gainXP(amount) {
      if (gameState !== 'playing') return;
      this.currentXP += floor(amount * this.xpMultiplier);
      if (this.currentXP >= this.xpToNextLevel) {
          this.level++;
          this.currentXP -= this.xpToNextLevel;
          this.xpToNextLevel = floor(this.xpToNextLevel * XP_LEVEL_SCALING_FACTOR);
          this.levelUpEffectTimer = 60;
          this.heal(this.maxHealth); // Full heal on level up

          // Reset wave-based cooldowns on level up? (e.g., Last Stand)
          this.lastStandCooldownTimer = 0;

          selectUpgrades();
          gameState = 'levelUp';
      }
  }

  heal(amount) {
      this.health = min(this.maxHealth, this.health + amount);
  }

  takeDamage(amount) {
      // Don't take damage during Last Stand invincibility
      if (this.lastStandTimer > 0) return;
      // Don't take damage during brief cooldown after hit
      if (this.damageTakenCooldown > 0) return;

      // Apply Damage Reduction first
      let reducedAmount = amount * (1 - this.damageReduction);

      let damageToHealth = reducedAmount;

      // Apply damage to shield
      if (this.shieldHealth > 0) {
          let shieldDamage = min(this.shieldHealth, reducedAmount);
          this.shieldHealth -= shieldDamage;
          damageToHealth -= shieldDamage;
          this.shieldRegenTimer = this.shieldRegenDelay;
      }

      // Apply remaining damage to health
      if (damageToHealth > 0) {
          let previousHealth = this.health; // Store health before taking damage
          this.health -= damageToHealth;
          this.health = max(0, this.health);
          this.damageTakenCooldown = 30;
          this.shieldRegenTimer = this.shieldRegenDelay;

          // Trigger Adrenaline Rush
          if (this.hasAdrenaline) {
              this.adrenalineTimer = this.adrenalineDuration;
          }

           // Trigger Last Stand
           if (this.hasLastStand && previousHealth > this.maxHealth * this.lastStandThreshold && this.health <= this.maxHealth * this.lastStandThreshold && this.lastStandCooldownTimer <= 0) {
               this.lastStandTimer = this.lastStandDuration;
               this.lastStandCooldownTimer = this.lastStandCooldown; // Start cooldown
               // Heal back slightly? Optional
               // this.heal(this.maxHealth * 0.1);
           }
      }
  }

  activateWaveClearBonus() {
      if (this.waveClearBonusDuration > 0) {
          this.waveClearBonusTimer = this.waveClearBonusDuration;
          // Optional: Heal slightly or recharge shield on wave clear
          // this.heal(5);
          // if(this.maxShieldHealth > 0) this.shieldHealth = min(this.maxShieldHealth, this.shieldHealth + 10);
      }
  }


  isDead() {
    return this.health <= 0;
  }

  checkBoundaryCollision() {
      this.pos.x = constrain(this.pos.x, this.size / 2, width - this.size / 2);
      this.pos.y = constrain(this.pos.y, this.size / 2, height - this.size / 2);
  }
}

class Bullet {
  constructor(x, y, angle, damage = 10, pierceCount = 1, speedMultiplier = 1.0, sizeMultiplier = 1.0, maxRicochets = 0) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.fromAngle(angle);
    this.speed = 8 * speedMultiplier; // Apply speed multiplier
    this.vel.mult(this.speed);
    this.size = 6 * sizeMultiplier; // Apply size multiplier
    this.color = COLOR_BULLET;
    this.damage = damage;
    this.pierceCount = pierceCount;
    this.maxRicochets = maxRicochets;
    this.ricochetCount = 0;
  }

  update() {
    this.pos.add(this.vel);

    // Ricochet Logic
    if (this.ricochetCount < this.maxRicochets) {
        let bounced = false;
        // Check horizontal bounce
        if ((this.pos.x < this.size / 2 && this.vel.x < 0) || (this.pos.x > width - this.size / 2 && this.vel.x > 0)) {
            this.vel.x *= -1;
            this.pos.x = constrain(this.pos.x, this.size / 2, width - this.size / 2); // Prevent sticking
            bounced = true;
        }
        // Check vertical bounce
        if ((this.pos.y < this.size / 2 && this.vel.y < 0) || (this.pos.y > height - this.size / 2 && this.vel.y > 0)) {
            this.vel.y *= -1;
            this.pos.y = constrain(this.pos.y, this.size / 2, height - this.size / 2); // Prevent sticking
             bounced = true;
        }
        if (bounced) {
            this.ricochetCount++;
        }
    }
  }


  display() {
    push();
    fill(this.color);
    noStroke();
    ellipse(this.pos.x, this.pos.y, this.size, this.size); // Use potentially larger size
    pop();
  }

  isOnScreen() {
      // Allow bullets slightly off screen if they can ricochet back
      let buffer = this.maxRicochets > 0 ? this.size * 2 : this.size;
    return (
      this.pos.x > -buffer &&
      this.pos.x < width + buffer &&
      this.pos.y > -buffer &&
      this.pos.y < height + buffer
    );
  }

  hits(zombie) {
    if (!zombie || !zombie.pos) return false;
    let d = dist(this.pos.x, this.pos.y, zombie.pos.x, zombie.pos.y);
    // Use bullet size and zombie size
    return d < (this.size / 2 + zombie.size / 2);
  }
}

// New Class for Enemy Bullets (unmodified by player perks)
class EnemyBullet {
    constructor(x, y, angle) {
        this.pos = createVector(x, y);
        this.vel = p5.Vector.fromAngle(angle);
        this.vel.mult(ENEMY_BULLET_SPEED);
        this.size = 8;
        this.color = COLOR_ENEMY_BULLET;
        this.damage = ENEMY_BULLET_DAMAGE;
    }

    update() {
        this.pos.add(this.vel);
    }

    display() {
        push();
        fill(this.color);
        noStroke();
        ellipse(this.pos.x, this.pos.y, this.size, this.size);
        pop();
    }

    isOnScreen() {
        return (
            this.pos.x > -this.size && this.pos.x < width + this.size &&
            this.pos.y > -this.size && this.pos.y < height + this.size
        );
    }

    hits(player) {
        if (!player || !player.pos) return false;
        let d = dist(this.pos.x, this.pos.y, player.pos.x, player.pos.y);
        return d < (this.size / 2 + player.size / 2);
    }
}


class Zombie {
  constructor(x, y, speed = 1, maxHealth = 30, canShoot = false) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.size = 20 + random(-5, 5);
    this.speed = speed + random(-0.2, 0.2);
    this.maxHealth = maxHealth;
    this.health = this.maxHealth;
    this.baseColor = color(COLOR_ZOMBIE[0], COLOR_ZOMBIE[1], COLOR_ZOMBIE[2]);
    this.headColor = color(COLOR_ZOMBIE_HEAD[0], COLOR_ZOMBIE_HEAD[1], COLOR_ZOMBIE_HEAD[2]);
    this.damage = 10;
    this.angle = random(TWO_PI);
    this.scoreValue = 10;

    // Shooting properties
    this.canShoot = canShoot;
    this.shootCooldown = ZOMBIE_SHOOT_COOLDOWN + random(-30, 30);
    this.shootTimer = this.shootCooldown / 2;

    // DOT properties
    this.dotTimer = 0;
    this.dotDamagePerTick = 0; // This should represent damage per second
  }

  update(playerPos) {
    // --- DOT Effect ---
    if (this.dotTimer > 0) {
        // Apply damage scaled by frame rate (assuming 60fps target)
        this.takeDamage(this.dotDamagePerTick / 60);
        this.dotTimer--;
    }

    // --- Movement ---
    let direction = p5.Vector.sub(playerPos, this.pos);
    direction.normalize();
    direction.mult(this.speed);
    this.vel = direction;
    this.pos.add(this.vel);

    // --- Shooting ---
    if (this.canShoot && gameState === 'playing') {
        this.shootTimer--;
        if (this.shootTimer <= 0) {
            let angleToPlayer = atan2(playerPos.y - this.pos.y, playerPos.x - this.pos.x);
            enemyBullets.push(new EnemyBullet(this.pos.x, this.pos.y, angleToPlayer));
            this.shootTimer = this.shootCooldown;
        }
    }
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);

    // Health Color Lerp
    let healthPercent = max(0, this.health / this.maxHealth); // Ensure 0-1 range
    healthPercent = isNaN(healthPercent) ? 1 : healthPercent;
    let bodyColor = lerpColor(color(255,0,0), this.baseColor, healthPercent);
    let currentHeadColor = lerpColor(color(150,0,0), this.headColor, healthPercent);

    stroke(0);
    strokeWeight(1);

    // Body
    fill(bodyColor);
    rect(-this.size * 0.3, -this.size * 0.4, this.size * 0.6, this.size * 0.8, 2);

    // Head
    fill(currentHeadColor);
    ellipse(0, -this.size * 0.4, this.size * 0.5, this.size * 0.5);

    // Shooter Indicator
    if (this.canShoot) {
        fill(COLOR_SHOOTER_ZOMBIE_TINT);
        noStroke();
        ellipse(0, 0, this.size * 0.4, this.size * 0.4);
    }
    // DOT Indicator
    if (this.dotTimer > 0) {
        fill(COLOR_DOT_EFFECT); // Greenish tint
        noStroke();
        ellipse(0, this.size * 0.1, this.size * 0.5, this.size * 0.5); // Dot on body
    }

    pop();
  }

  applyDOT(damagePerSecond, durationFrames) {
      // Apply new DOT or refresh/stack? Let's just apply the new one.
      this.dotDamagePerTick = damagePerSecond;
      this.dotTimer = durationFrames;
  }


  takeDamage(amount) {
      // Don't take negative damage
      if (amount > 0) {
        this.health -= amount;
      }
  }

  isDead() {
      return this.health <= 0;
  }

  hits(target) {
    if (!target || !target.pos) return false;
    let d = dist(this.pos.x, this.pos.y, target.pos.x, target.pos.y);
    return d < (this.size / 2 + target.size / 2);
  }
}

// MiniBoss Class
class MiniBoss {
     constructor(x, y, speed = 0.8, maxHealth = 200) {
        this.pos = createVector(x, y);
        this.vel = createVector(0, 0);
        this.size = 45;
        this.speed = speed;
        this.maxHealth = maxHealth;
        this.health = this.maxHealth;
        this.baseColor = color(COLOR_MINIBOSS_BODY[0], COLOR_MINIBOSS_BODY[1], COLOR_MINIBOSS_BODY[2]);
        this.headColor = color(COLOR_MINIBOSS_HEAD[0], COLOR_MINIBOSS_HEAD[1], COLOR_MINIBOSS_HEAD[2]);
        this.damage = 25;
        this.angle = random(TWO_PI);
        this.scoreValue = 100;
        this.canShoot = false; // Could be modified by perks later?

        // DOT properties (Bosses can also be affected)
        this.dotTimer = 0;
        this.dotDamagePerTick = 0;
    }

    update(playerPos) {
         // --- DOT Effect ---
        if (this.dotTimer > 0) {
            this.takeDamage(this.dotDamagePerTick / 60);
            this.dotTimer--;
        }

        // Basic chase behavior
        let direction = p5.Vector.sub(playerPos, this.pos);
        direction.normalize();
        direction.mult(this.speed);
        this.vel = direction;
        this.pos.add(this.vel);
    }

    display() {
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.angle); // Use fixed random angle

        let healthPercent = max(0, this.health / this.maxHealth);
        healthPercent = isNaN(healthPercent) ? 1 : healthPercent;
        let bodyColor = lerpColor(color(255, 50, 50), this.baseColor, healthPercent); // Lerp towards brighter red
        let currentHeadColor = lerpColor(color(255, 100, 100), this.headColor, healthPercent);

        stroke(0);
        strokeWeight(2); // Thicker outline

        // Draw Body (Larger Rectangle)
        fill(bodyColor);
        rect(-this.size * 0.4, -this.size * 0.5, this.size * 0.8, this.size, 5); // Wider, rounded

        // Draw Head (Larger Circle)
        fill(currentHeadColor);
        ellipse(0, -this.size * 0.5, this.size * 0.6, this.size * 0.6);

         // DOT Indicator
        if (this.dotTimer > 0) {
            fill(COLOR_DOT_EFFECT);
            noStroke();
            ellipse(0, this.size * 0.1, this.size * 0.5, this.size * 0.5);
        }


        pop();
    }

     applyDOT(damagePerSecond, durationFrames) {
      this.dotDamagePerTick = damagePerSecond;
      this.dotTimer = durationFrames;
     }

    takeDamage(amount) {
         if (amount > 0) {
            this.health -= amount;
         }
    }

    isDead() {
        return this.health <= 0;
    }

    hits(target) {
        if (!target || !target.pos) return false;
        let d = dist(this.pos.x, this.pos.y, target.pos.x, target.pos.y);
        return d < (this.size / 2 + target.size / 2);
    }
}

// New GigaBoss Class
class GigaBoss {
     constructor(x, y, speed = 0.5, maxHealth = 800) {
        this.pos = createVector(x, y);
        this.vel = createVector(0, 0);
        this.size = 70; // Even larger size
        this.speed = speed; // Even slower
        this.maxHealth = maxHealth;
        this.health = this.maxHealth;
        this.bodyColor = color(COLOR_GIGABOSS_BODY[0], COLOR_GIGABOSS_BODY[1], COLOR_GIGABOSS_BODY[2]);
        this.accentColor = color(COLOR_GIGABOSS_ACCENT[0], COLOR_GIGABOSS_ACCENT[1], COLOR_GIGABOSS_ACCENT[2]);
        this.damage = 40; // Very high contact damage
        this.angle = random(TWO_PI);
        this.scoreValue = 500; // Huge score value
        this.canShoot = false; // Could add shooting patterns later

        // DOT properties
        this.dotTimer = 0;
        this.dotDamagePerTick = 0;
    }

    update(playerPos) {
         // --- DOT Effect ---
        if (this.dotTimer > 0) {
            this.takeDamage(this.dotDamagePerTick / 60);
            this.dotTimer--;
        }

        // Basic chase behavior
        let direction = p5.Vector.sub(playerPos, this.pos);
        direction.normalize();
        direction.mult(this.speed);
        this.vel = direction;
        this.pos.add(this.vel);
    }

    display() {
        push();
        translate(this.pos.x, this.pos.y);
        // Maybe make it slowly rotate?
        this.angle += 0.005;
        rotate(this.angle);

        let healthPercent = max(0, this.health / this.maxHealth);
        healthPercent = isNaN(healthPercent) ? 1 : healthPercent;
        // Lerp color towards a damaged color (e.g., darker gray or reddish gray)
        let damagedColor = color(red(this.bodyColor)*0.5, green(this.bodyColor)*0.5, blue(this.bodyColor)*0.5);
        let currentBodyColor = lerpColor(damagedColor, this.bodyColor, healthPercent);

        stroke(0);
        strokeWeight(3); // Very thick outline

        // Draw Body (Large complex shape?) - Let's use overlapping shapes
        fill(currentBodyColor);
        ellipse(0, 0, this.size, this.size); // Main body circle

        // Draw Accents (e.g., spikes or plates)
        let numAccents = 6;
        for (let i = 0; i < numAccents; i++) {
            rotate(TWO_PI / numAccents);
            fill(this.accentColor);
            triangle(0, -this.size * 0.4, -this.size * 0.1, -this.size * 0.6, this.size * 0.1, -this.size * 0.6);
        }


         // DOT Indicator (on top)
        if (this.dotTimer > 0) {
            fill(COLOR_DOT_EFFECT);
            noStroke();
            ellipse(0, 0, this.size * 0.4, this.size * 0.4); // Center dot
        }

        pop();
    }

     applyDOT(damagePerSecond, durationFrames) {
      this.dotDamagePerTick = damagePerSecond;
      this.dotTimer = durationFrames;
     }

    takeDamage(amount) {
         if (amount > 0) {
            this.health -= amount;
         }
    }

    isDead() {
        return this.health <= 0;
    }

    hits(target) {
        if (!target || !target.pos) return false;
        let d = dist(this.pos.x, this.pos.y, target.pos.x, target.pos.y);
        return d < (this.size / 2 + target.size / 2);
    }
}


// New Class for Experience Balls
class ExperienceBall {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.size = 10;
        this.color = color(COLOR_XP_BALL[0], COLOR_XP_BALL[1], COLOR_XP_BALL[2]);
        this.xpValue = BASE_XP_PER_ORB; // Use constant for base XP
        this.pulseSize = 0; // For pulsing effect
        this.pulseSpeed = 0.1;
        this.homingSpeed = 3;
        // Homing trigger distance is now controlled by player.xpPickupRadius
    }

    update(player) { // Pass player object
        // Simple pulsing effect
        this.pulseSize = sin(frameCount * this.pulseSpeed) * 2;

        // Homing effect towards player if close enough and game is playing
        if (gameState === 'playing' && player && player.pos) {
            let d = dist(this.pos.x, this.pos.y, player.pos.x, player.pos.y);
            // Use player's pickup radius for homing check
            if (d < player.xpPickupRadius) {
                let direction = p5.Vector.sub(player.pos, this.pos);
                direction.normalize();
                direction.mult(this.homingSpeed);
                this.pos.add(direction);
            }
        }
    }


    display() {
        push();
        translate(this.pos.x, this.pos.y);
        fill(this.color);
        // Add a white outline for better visibility
        stroke(255, 200);
        strokeWeight(1);
        // Draw pulsing ellipse
        ellipse(0, 0, this.size + this.pulseSize, this.size + this.pulseSize);
        pop();
    }

    // Check collision with the player
    hits(player) {
        if (!player || !player.pos) return false;
        let d = dist(this.pos.x, this.pos.y, player.pos.x, player.pos.y);
        // Keep collision radius relatively small for direct pickup
        return d < (this.size / 2 + player.size / 2 + 5);
    }
}

// Simple Particle Class for effects like blood splatter
class Particle {
    constructor(x, y, pColor = COLOR_BLOOD, baseSpeed = 1, speedRange = 3) { // Added speed params
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D();
        this.vel.mult(random(baseSpeed, baseSpeed + speedRange)); // Use speed params
        this.lifespan = random(15, 40);
        // Ensure pColor is a p5.Color object before accessing components
        let baseC = (pColor instanceof p5.Color) ? pColor : color(pColor[0], pColor[1], pColor[2]);
        this.color = color(red(baseC), green(baseC), blue(baseC), 200); // Use color components
        this.size = random(2, 5);
    }

    update() {
        this.pos.add(this.vel);
        this.lifespan -= 1;
        this.vel.mult(0.95); // Add some drag
        this.color.setAlpha(map(this.lifespan, 0, 40, 0, 200));
    }

    display() {
        noStroke();
        fill(this.color);
        ellipse(this.pos.x, this.pos.y, this.size, this.size);
    }

    isDead() {
        return this.lifespan <= 0;
    }
}
