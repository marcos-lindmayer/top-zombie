// server.js (Node.js using Express and Socket.IO)

const express = require('express');
const http = require('http');
const path = require('path'); // Added for serving static files
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Restrict in production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5500; // Keep port 5500

// --- Serve static files from the 'public' directory --- ADDED THIS LINE ---
app.use(express.static(path.join(__dirname, 'public')));
// --------------------------------------------------------------------------

// --- Simple Vector Class (Replaces p5.Vector on server) ---
class Vector {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    add(v) { this.x += v.x; this.y += v.y; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }
    mult(n) { this.x *= n; this.y *= n; return this; }
    div(n) { this.x /= n; this.y /= n; return this; }
    magSq() { return this.x * this.x + this.y * this.y; }
    mag() { return Math.sqrt(this.magSq()); }
    normalize() { const len = this.mag(); if (len !== 0) this.mult(1 / len); return this; }
    setMag(n) { return this.normalize().mult(n); }
    limit(max) { const mSq = this.magSq(); if (mSq > max * max) { this.div(Math.sqrt(mSq)).mult(max); } return this; }
    heading() { return Math.atan2(this.y, this.x); }
    copy() { return new Vector(this.x, this.y); }
    static sub(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y); }
    static dist(v1, v2) { const dx = v1.x - v2.x; const dy = v1.y - v2.y; return Math.sqrt(dx * dx + dy * dy); }
    static random2D() { const angle = Math.random() * Math.PI * 2; return Vector.fromAngle(angle); }
    static fromAngle(angle) { return new Vector(Math.cos(angle), Math.sin(angle)); }
    lerp(v, amt) { this.x += (v.x - this.x) * amt; this.y += (v.y - this.y) * amt; return this; }
}
// --- End Vector Class ---


// --- Game Constants ---
const TICK_RATE = 30;
const MAP_WIDTH = 1600;
const MAP_HEIGHT = 1200;
const PLAYER_SIZE = 25;
const ZOMBIE_DEFAULT_SIZE = 20;
const MINIBOSS_SIZE = 45;
const GIGABOSS_SIZE = 70;
const BULLET_SPEED = 8;
const ENEMY_BULLET_SPEED = 4;
const BASE_XP_PER_ORB = 100;
const BASE_XP_TO_LEVEL = 50;
const XP_LEVEL_SCALING_FACTOR = 1.25;
const PLAYER_BASE_SPEED = 4.0;
const PLAYER_BASE_FIRE_RATE_COOLDOWN = 20;
const SHOOTER_ZOMBIE_CHANCE = 0.15;
const ZOMBIE_SHOOT_COOLDOWN = 120;
const ENEMY_BULLET_DAMAGE = 5;
const MINIBOSS_HEALTH_BASE = 200;
const MINIBOSS_HEALTH_SCALE = 50;
const MINIBOSS_XP_DROP_MULTIPLIER = 10;
const GIGABOSS_HEALTH_BASE = 800;
const GIGABOSS_HEALTH_SCALE = 200;
const GIGABOSS_XP_DROP_MULTIPLIER = 30;


// --- Game State (Server-Side) ---
let players = {}; // { id: PlayerServer instance }
let bullets = {}; // { id: BulletServer instance }
let enemyBullets = {}; // { id: EnemyBulletServer instance }
let zombies = {}; // { id: ZombieServer/MiniBossServer/GigaBossServer instance }
let xpBalls = {}; // { id: XpBallServer instance }
let nextBulletId = 0;
let nextEnemyBulletId = 0;
let nextZombieId = 0;
let nextXpBallId = 0;

// Shared state - INCLUDING gameState now
let sharedState = {
    gameState: 'start', // Initial game state
    health: 100,
    maxHealth: 100,
    currentXP: 0,
    xpToNextLevel: BASE_XP_TO_LEVEL,
    level: 1,
    acquiredPerks: [],
    firstPlayerId: null,
    wave: 0,
    score: 0,
    maxShieldHealth: 0,
    shieldHealth: 0,
    shieldRegenTimer: 0,
    shieldRegenDelay: 300,
    shieldRegenRate: 0,
    xpVacuumTimer: 0,
    xpVacuumCooldown: 1200,
    hasXPVacuum: false,
    lastStandCooldownTimer: 0,
    lastStandCooldown: 1800,
};

// Server-side perk definitions needed for applyPerkServer
// TODO: Populate this fully based on client-side defineUpgrades
let serverPerkDefinitions = {
    'health_boost': (state) => { state.maxHealth += 50; state.health = state.maxHealth; },
    // ... add effects for ALL perks modifying sharedState
};

// --- Server-Side Classes (Using new Vector class) ---
class PlayerServer {
    constructor(id, x, y) {
        this.id = id;
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        this.angle = 0;
        this.speed = PLAYER_BASE_SPEED;
        this.size = PLAYER_SIZE;
        this.input = { dx: 0, dy: 0, shooting: false, angle: 0 };
        this.fireRateCooldown = 0;
        this.maxFireRateCooldown = PLAYER_BASE_FIRE_RATE_COOLDOWN;
        this.shotCount = 1;
        this.shotSpreadAngle = 0.15;
        this.bulletDamage = 10;
        this.maxPierceCount = 1;
        this.bulletSpeedMultiplier = 1.0;
        this.bulletSizeMultiplier = 1.0;
        this.maxRicochets = 0;
        this.critChance = 0;
        this.critMultiplier = 1.5;
        this.dotChance = 0;
        this.dotDamage = 0;
        this.dotDuration = 0;
        this.thornsDamage = 0;
        this.damageReduction = 0;
        this.healthOnKillAmount = 0;
        this.scoreMultiplier = 1.0;
        this.orbDoubleChance = 0;
        this.xpMultiplier = 1.0; // Added for consistency
        this.xpPickupRadius = 80; // Added for consistency
    }

    update() {
        // Apply Input to Velocity
        let moveDir = new Vector(this.input.dx, this.input.dy);
        if (moveDir.magSq() > 0) {
            moveDir.normalize().mult(this.speed);
            this.vel = moveDir;
        } else {
            this.vel.x = 0; this.vel.y = 0;
        }
        this.pos.add(this.vel);

        // Clamp Position
        this.pos.x = constrain(this.pos.x, this.size / 2, MAP_WIDTH - this.size / 2);
        this.pos.y = constrain(this.pos.y, this.size / 2, MAP_HEIGHT - this.size / 2);

        // Update Angle
        if (this.input.angle !== null) { // Desktop aiming
             this.angle = this.input.angle;
        } else { // Mobile aiming (find nearest zombie)
             let nearestZombie = findNearestZombie(this.pos); // Find nearest ZOMBIE
             if (nearestZombie) {
                 this.angle = Vector.sub(nearestZombie.pos, this.pos).heading();
             } else if (this.vel.magSq() > 0) { // Fallback to movement if no zombies
                 this.angle = this.vel.heading();
             }
             // Keep current angle if stopped and no zombies
        }


        // Handle Shooting Cooldown
        if (this.fireRateCooldown > 0) {
            this.fireRateCooldown--;
        }

        // Handle Shooting Input
        // TODO: Read fire rate cooldown from sharedState if modified by perks
        if (this.input.shooting && this.fireRateCooldown <= 0) {
            this.shoot();
            this.fireRateCooldown = this.maxFireRateCooldown; // Use current cooldown
        }
    }

    shoot() {
        // TODO: Read shotCount, spreadAngle, damage, pierce, speedMult, sizeMult, ricochets
        // from sharedState or player instance if they become individual perks
        for (let i = 0; i < this.shotCount; i++) {
            let angleOffset = (i - (this.shotCount - 1) / 2) * this.shotSpreadAngle;
            let fireAngle = this.angle + angleOffset;
            let bulletId = `b_${nextBulletId++}`;
            bullets[bulletId] = new BulletServer(
                bulletId, this.pos.x, this.pos.y, fireAngle,
                this.bulletDamage, this.maxPierceCount,
                this.bulletSpeedMultiplier, this.bulletSizeMultiplier,
                this.maxRicochets
            );
            // Assign owner for potential stat lookups (crit, dot etc.)
            bullets[bulletId].ownerId = this.id;
        }
    }

    getState() {
        return { id: this.id, x: this.pos.x, y: this.pos.y, angle: this.angle };
    }
}

class BulletServer {
    constructor(id, x, y, angle, damage, pierceCount, speedMultiplier, sizeMultiplier, maxRicochets) {
        this.id = id; this.pos = new Vector(x, y); this.vel = Vector.fromAngle(angle);
        this.speed = BULLET_SPEED * speedMultiplier; this.vel.mult(this.speed);
        this.size = 6 * sizeMultiplier; this.color = [255, 255, 0]; // Example color
        this.damage = damage; this.pierceCount = pierceCount;
        this.maxRicochets = maxRicochets; this.ricochetCount = 0; this.ownerId = null;
    }
    update() { this.pos.add(this.vel); /* TODO: Ricochet */ }
    isOnScreen() { return this.pos.x > -this.size && this.pos.x < MAP_WIDTH + this.size && this.pos.y > -this.size && this.pos.y < MAP_HEIGHT + this.size; }
    getState() { return { id: this.id, x: this.pos.x, y: this.pos.y, size: this.size }; }
}

class EnemyBulletServer {
     constructor(id, x, y, angle) { this.id = id; this.pos = new Vector(x, y); this.vel = Vector.fromAngle(angle); this.vel.mult(ENEMY_BULLET_SPEED); this.size = 8; this.damage = ENEMY_BULLET_DAMAGE; }
     update() { this.pos.add(this.vel); }
     isOnScreen() { return this.pos.x > -this.size && this.pos.x < MAP_WIDTH + this.size && this.pos.y > -this.size && this.pos.y < MAP_HEIGHT + this.size; }
     getState() { return { id: this.id, x: this.pos.x, y: this.pos.y, size: this.size }; }
}

class ZombieServer {
    constructor(id, x, y, speed, maxHealth, canShoot) {
        this.id = id; this.pos = new Vector(x, y); this.vel = new Vector(0, 0);
        this.size = ZOMBIE_DEFAULT_SIZE; this.speed = speed; this.maxHealth = maxHealth;
        this.health = maxHealth; this.damage = 10; this.scoreValue = 10; this.type = 'zombie';
        this.canShoot = canShoot; this.shootCooldown = ZOMBIE_SHOOT_COOLDOWN + random(-30, 30);
        this.shootTimer = this.shootCooldown / 2; this.dotTimer = 0; this.dotDamagePerTick = 0;
    }
    update() {
        if (this.dotTimer > 0) { this.takeDamage(this.dotDamagePerTick / TICK_RATE); this.dotTimer--; }
        let nearestPlayer = findNearestPlayer(this.pos);
        if (!nearestPlayer) { this.vel.x = 0; this.vel.y = 0; return; };
        let direction = Vector.sub(nearestPlayer.pos, this.pos);
        direction.normalize().mult(this.speed); this.vel = direction; this.pos.add(this.vel);
        if (this.canShoot) {
            this.shootTimer--;
            if (this.shootTimer <= 0) {
                let angleToPlayer = Vector.sub(nearestPlayer.pos, this.pos).heading();
                let bulletId = `eb_${nextEnemyBulletId++}`;
                enemyBullets[bulletId] = new EnemyBulletServer(bulletId, this.pos.x, this.pos.y, angleToPlayer);
                this.shootTimer = this.shootCooldown;
            }
        }
    }
    takeDamage(amount) { if (amount > 0) { this.health -= amount; } }
    applyDOT(damagePerSecond, durationFrames) { this.dotDamagePerTick = damagePerSecond; this.dotTimer = durationFrames; }
    isDead() { return this.health <= 0; }
    getState() { return { id: this.id, x: this.pos.x, y: this.pos.y, healthPercent: max(0, this.health / this.maxHealth), size: this.size, type: this.type, canShoot: this.canShoot, dotTimer: this.dotTimer }; }
}

class MiniBossServer extends ZombieServer {
    constructor(id, x, y, speed, maxHealth) { super(id, x, y, speed, maxHealth, false); this.size = MINIBOSS_SIZE; this.damage = 25; this.scoreValue = 100; this.type = 'miniboss'; }
}
class GigaBossServer extends ZombieServer {
     constructor(id, x, y, speed, maxHealth) { super(id, x, y, speed, maxHealth, false); this.size = GIGABOSS_SIZE; this.damage = 40; this.scoreValue = 500; this.type = 'gigaboss'; }
}
class XpBallServer {
    constructor(id, x, y) { this.id = id; this.pos = new Vector(x, y); this.xpValue = BASE_XP_PER_ORB; this.size = 10; }
    getState() { return { id: this.id, x: this.pos.x, y: this.pos.y }; }
}


// --- Game Logic Implementation ---
function updateGame() {
    // 1. Update Players
    for (const id in players) { players[id].update(); }
    // 2. Update Player Bullets
    for (const id in bullets) { bullets[id].update(); if (!bullets[id].isOnScreen()) { delete bullets[id]; } }
    // 3. Update Enemy Bullets
    for (const id in enemyBullets) { enemyBullets[id].update(); if (!enemyBullets[id].isOnScreen()) { delete enemyBullets[id]; } }
    // 4. Update Zombies/Bosses
    for (const id in zombies) { zombies[id].update(); }
    // 5. Collision Detection
    handleCollisions();
    // 8. Check Wave Completion
    if (zombiesRemaining <= 0 && Object.keys(zombies).length === 0) { startNextWave(); }
    // 9. Check Game Over
    if (sharedState.health <= 0 && sharedState.gameState !== 'gameOver') {
        sharedState.gameState = 'gameOver';
        io.emit('gameOver');
        console.log("Game Over Condition Met");
    }
    // 10. Update Shared State Timers
    updateSharedTimers();
}

function handleCollisions() {
    let playersArray = Object.values(players);
    let bulletsToDelete = new Set();
    let enemyBulletsToDelete = new Set();
    let zombiesToDelete = new Set();
    let xpBallsToDelete = new Set();

    // Player Bullets vs Zombies
    for (const bulletId in bullets) {
        if (bulletsToDelete.has(bulletId)) continue;
        let bullet = bullets[bulletId];
        for (const zombieId in zombies) {
            if (zombiesToDelete.has(zombieId)) continue;
            let zombie = zombies[zombieId];
            let d = Vector.dist(bullet.pos, zombie.pos);
            if (d < (bullet.size / 2 + zombie.size / 2)) {
                let ownerPlayer = players[bullet.ownerId];
                // Use owner stats if available, otherwise default (or maybe shared stats?)
                let critChance = ownerPlayer ? ownerPlayer.critChance : 0;
                let critMultiplier = ownerPlayer ? ownerPlayer.critMultiplier : 1.5;
                let dotChance = ownerPlayer ? ownerPlayer.dotChance : 0;
                let dotDamage = ownerPlayer ? ownerPlayer.dotDamage : 0;
                let dotDuration = ownerPlayer ? ownerPlayer.dotDuration : 0;

                let actualDamage = bullet.damage;
                if (random(1) < critChance) { actualDamage *= critMultiplier; }
                zombie.takeDamage(actualDamage);

                if (dotChance > 0 && random(1) < dotChance) { zombie.applyDOT(dotDamage, dotDuration); }

                bullet.pierceCount--;
                if (bullet.pierceCount <= 0) {
                    bulletsToDelete.add(bulletId);
                    break;
                }
            }
        }
    }

    // Enemy Bullets vs Players
    for (const bulletId in enemyBullets) {
        if (enemyBulletsToDelete.has(bulletId)) continue;
        let bullet = enemyBullets[bulletId];
        for (const player of playersArray) {
             let d = Vector.dist(bullet.pos, player.pos);
             if (d < (bullet.size / 2 + player.size / 2)) {
                 takeSharedDamage(bullet.damage);
                 enemyBulletsToDelete.add(bulletId);
                 break;
             }
        }
    }

    // Zombies vs Players
    for (const zombieId in zombies) {
        if (zombiesToDelete.has(zombieId)) continue;
        let zombie = zombies[zombieId];
         for (const player of playersArray) {
             let d = Vector.dist(zombie.pos, player.pos);
             if (d < (zombie.size / 2 + player.size / 2)) {
                 takeSharedDamage(zombie.damage);
                 // TODO: Apply Thorns damage back to zombie
                 // if (player.thornsDamage > 0) zombie.takeDamage(player.thornsDamage);
                 zombiesToDelete.add(zombieId);
                 break;
             }
        }
    }

     // Players vs XP Orbs
     for (const xpBallId in xpBalls) {
        if (xpBallsToDelete.has(xpBallId)) continue;
        let ball = xpBalls[xpBallId];
         for (const player of playersArray) {
             // TODO: Use player's pickup radius perk value from sharedState?
             let pickupRadius = 10 + player.size / 2 + ball.size / 2; // Simple radius
             let d = Vector.dist(ball.pos, player.pos);
             if (d < pickupRadius) {
                 // TODO: Apply shared XP multiplier perk
                 let xpMultiplier = 1.0;
                 sharedState.currentXP += floor(ball.xpValue * xpMultiplier);
                 xpBallsToDelete.add(xpBallId);
                 if (sharedState.currentXP >= sharedState.xpToNextLevel) { handleLevelUp(); }
                 break;
             }
         }
     }

     // Zombie Death Check
     for (const zombieId in zombies) {
         if (zombiesToDelete.has(zombieId)) continue;
         let zombie = zombies[zombieId];
         if (zombie && zombie.isDead()) {
             // TODO: Apply shared score multiplier, health on kill, orb doubler perks
             let scoreMultiplier = 1.0;
             let healthOnKillAmount = 0;
             let orbDoubleChance = 0;

             sharedState.score += floor(zombie.scoreValue * scoreMultiplier);
             if (healthOnKillAmount > 0) { sharedState.health = min(sharedState.maxHealth, sharedState.health + healthOnKillAmount); }
             let orbDropCount = (orbDoubleChance > 0 && random(1) < orbDoubleChance) ? 2 : 1;
             let xpDropMultiplier = 1;
             if (zombie instanceof GigaBossServer) xpDropMultiplier = GIGABOSS_XP_DROP_MULTIPLIER;
             else if (zombie instanceof MiniBossServer) xpDropMultiplier = MINIBOSS_XP_DROP_MULTIPLIER;

             for(let k=0; k < xpDropMultiplier * orbDropCount; k++) {
                 let orbId = `xp_${nextXpBallId++}`;
                 xpBalls[orbId] = new XpBallServer(orbId, zombie.pos.x + random(-15, 15), zombie.pos.y + random(-15, 15));
             }
             zombiesToDelete.add(zombieId);
         }
     }

     // Apply Deletions
     bulletsToDelete.forEach(id => delete bullets[id]);
     enemyBulletsToDelete.forEach(id => delete enemyBullets[id]);
     xpBallsToDelete.forEach(id => delete xpBalls[id]);
     zombiesToDelete.forEach(id => {
         if (zombies[id]) {
             delete zombies[id];
             zombiesRemaining--;
         }
     });
     zombiesRemaining = max(0, zombiesRemaining);
}

function takeSharedDamage(amount) {
    // TODO: Apply shared damage reduction perk
    let damageReduction = 0; // Get from sharedState based on perks
    let reducedAmount = amount * (1 - damageReduction);

    let damageToHealth = reducedAmount;

    // Apply to shield first
    if (sharedState.shieldHealth > 0) {
        let shieldDamage = Math.min(sharedState.shieldHealth, reducedAmount); // Use reducedAmount here
        sharedState.shieldHealth -= shieldDamage;
        damageToHealth -= shieldDamage;
        sharedState.shieldRegenTimer = sharedState.shieldRegenDelay; // Reset shield regen delay
    }

    // Apply remaining to health
    if (damageToHealth > 0) {
        sharedState.health -= damageToHealth;
        sharedState.health = Math.max(0, sharedState.health); // Clamp health
        sharedState.shieldRegenTimer = sharedState.shieldRegenDelay; // Also reset shield delay if health hit
        // TODO: Trigger Adrenaline Rush perk effect (maybe set a flag in sharedState?)
        // TODO: Check for Last Stand perk trigger
    }
}

function updateSharedTimers() {
     // Shield Regen
    if (sharedState.maxShieldHealth > 0) {
        if (sharedState.shieldRegenTimer > 0) {
            sharedState.shieldRegenTimer--;
        } else if (sharedState.shieldHealth < sharedState.maxShieldHealth) {
            sharedState.shieldHealth += sharedState.shieldRegenRate;
            sharedState.shieldHealth = Math.min(sharedState.shieldHealth, sharedState.maxShieldHealth);
        }
    }
    // XP Vacuum Timer
    if (sharedState.hasXPVacuum && sharedState.xpVacuumTimer > 0) {
        sharedState.xpVacuumTimer--;
         // Trigger vacuum effect
         if (sharedState.xpVacuumTimer <= 0) {
             console.log("XP Vacuum Triggered!");
             // Iterate and collect all balls
             let xpGained = 0;
             let xpBallsToVacuum = Object.keys(xpBalls); // Get IDs before modifying
             xpBallsToVacuum.forEach(xpBallId => {
                 if (xpBalls[xpBallId]) { // Check if still exists
                    xpGained += xpBalls[xpBallId].xpValue; // TODO: Apply multiplier?
                    delete xpBalls[xpBallId];
                 }
             });

             if (xpGained > 0) {
                 sharedState.currentXP += xpGained;
                  // Check for Level Up immediately after vacuum
                 if (sharedState.currentXP >= sharedState.xpToNextLevel) {
                     handleLevelUp();
                 }
             }
             sharedState.xpVacuumTimer = sharedState.xpVacuumCooldown; // Reset timer
         }
    }
     // Last Stand Cooldown Timer
    if (sharedState.lastStandCooldownTimer > 0) {
        sharedState.lastStandCooldownTimer--;
    }
    // TODO: Add other shared timer updates (Adrenaline, Wave Clear Bonus duration?)
}


function handleLevelUp() {
    // Prevent multiple level ups in one go if XP gain is huge
    if (sharedState.gameState === 'levelUp') return;

    sharedState.level++;
    sharedState.currentXP -= sharedState.xpToNextLevel; // Keep remainder XP
    sharedState.xpToNextLevel = floor(sharedState.xpToNextLevel * XP_LEVEL_SCALING_FACTOR);
    sharedState.health = sharedState.maxHealth; // Full heal
    sharedState.shieldHealth = sharedState.maxShieldHealth; // Full shield recharge
    sharedState.lastStandCooldownTimer = 0; // Reset last stand cooldown on level up

    console.log(`Level Up! Reached level ${sharedState.level}`);
    sharedState.gameState = 'levelUp'; // Set server state to prevent game logic during perk selection

    // Select 3 perks (Need server-side definitions)
    let options = selectUpgradesServer(sharedState.acquiredPerks);

    // Emit 'promptPerkSelection' ONLY to sharedState.firstPlayerId
    if (sharedState.firstPlayerId && io.sockets.sockets.get(sharedState.firstPlayerId)) {
         io.to(sharedState.firstPlayerId).emit('promptPerkSelection', options);
         console.log(`Prompting player ${sharedState.firstPlayerId} for perk selection.`);
    } else {
        console.log("First player not found for perk selection. Skipping perk selection.");
        sharedState.gameState = 'playing'; // No one to select, resume game
    }
     // Check if multiple level ups occurred due to massive XP gain (after potential state change)
     if (sharedState.currentXP >= sharedState.xpToNextLevel && sharedState.gameState === 'playing') {
         handleLevelUp(); // Trigger again if needed
     }
}

function applyPerkServer(perkChoice) { // perkChoice is likely the perk ID/Name
    console.log(`Applying perk: ${perkChoice}`);
    // Find the perk definition on the server
    // const perk = serverPerkDefinitions.find(p => p.id === perkChoice || p.name === perkChoice);
    // if (perk && perk.applyEffectServer) {
         // perk.applyEffectServer(sharedState, players); // Pass shared state and potentially players map
         // Example direct modification:
         if (perkChoice === 'Extra Vitality' || perkChoice === 'health_boost') {
              sharedState.maxHealth += 50;
              sharedState.health = sharedState.maxHealth;
         }
         // TODO: Implement applyEffect logic for ALL perks server-side, modifying sharedState
         // Make sure acquiredPerks list is updated correctly
         if (!sharedState.acquiredPerks.includes(perkChoice)) { // Use name or ID consistently
             sharedState.acquiredPerks.push(perkChoice);
         }
    // } else {
    //     console.warn(`Could not find or apply server-side effect for perk: ${perkChoice}`);
    // }
    sharedState.gameState = 'playing'; // Resume game after applying perk
}

function startNextWave() {
    // Don't start next wave if game just ended or during level up
    if (sharedState.gameState === 'gameOver' || sharedState.gameState === 'levelUp') return;

    sharedState.wave++;
    let baseZombiesThisWave = 5 + sharedState.wave * 2;
    zombiesRemaining = 0; // Reset before adding

    let spawnGigaBoss = (sharedState.wave > 0 && sharedState.wave % 5 === 0);
    let spawnMiniBoss = (sharedState.wave > 0 && sharedState.wave % 2 === 0 && !spawnGigaBoss);

    let actualZombiesToSpawn = baseZombiesThisWave;

    if (spawnGigaBoss) {
        spawnGigaBossFuncServer();
        zombiesRemaining++;
        actualZombiesToSpawn = floor(baseZombiesThisWave * 0.5);
    } else if (spawnMiniBoss) {
        spawnMiniBossFuncServer();
        zombiesRemaining++;
    }

    spawnZombiesServer(actualZombiesToSpawn);
    zombiesRemaining += actualZombiesToSpawn;

    sharedState.lastStandCooldownTimer = 0; // Reset Last Stand cooldown at start of wave

    console.log(`Starting Wave: ${sharedState.wave}, Spawning ${zombiesRemaining} enemies.`);
    // TODO: Apply Wave Clear Bonus perk effect (if active) - maybe handled client-side?
}

// Server-side spawning functions
function spawnZombiesServer(count) {
  for (let i = 0; i < count; i++) {
    let pos = getRandomSpawnPosition();
    let zombieSpeed = min(1 + sharedState.wave * 0.1, 3);
    let zombieHealth = 30 + sharedState.wave * 5;
    let isShooter = random(1) < SHOOTER_ZOMBIE_CHANCE;
    let id = `z_${nextZombieId++}`;
    zombies[id] = new ZombieServer(id, pos.x, pos.y, zombieSpeed, zombieHealth, isShooter);
  }
}
function spawnMiniBossFuncServer() {
    let pos = getRandomSpawnPosition();
    let bossHealth = MINIBOSS_HEALTH_BASE + floor(sharedState.wave / 2) * MINIBOSS_HEALTH_SCALE;
    let bossSpeed = 0.8;
    let id = `z_${nextZombieId++}`;
    zombies[id] = new MiniBossServer(id, pos.x, pos.y, bossSpeed, bossHealth);
}
function spawnGigaBossFuncServer() {
    let pos = getRandomSpawnPosition();
    let bossHealth = GIGABOSS_HEALTH_BASE + floor(sharedState.wave / 5) * GIGABOSS_HEALTH_SCALE;
    let bossSpeed = 0.5;
     let id = `z_${nextZombieId++}`;
    zombies[id] = new GigaBossServer(id, pos.x, pos.y, bossSpeed, bossHealth);
}

// Helper function to find nearest player (needed for zombie AI)
function findNearestPlayer(pos) {
    let nearestPlayer = null;
    let minDistSq = Infinity;
    for (const id in players) {
        let player = players[id];
        let dSq = Vector.sub(player.pos, pos).magSq(); // Use new Vector
        if (dSq < minDistSq) {
            minDistSq = dSq;
            nearestPlayer = player;
        }
    }
    return nearestPlayer;
}
// Helper function to find nearest zombie (needed for player mobile aim)
function findNearestZombie(pos) {
    let nearestZombie = null;
    let minDistSq = Infinity;
    for (const id in zombies) {
        let zombie = zombies[id];
        if (!zombie || zombie.health <= 0) continue;
        let dSq = Vector.sub(zombie.pos, pos).magSq();
        if (dSq < minDistSq) {
            minDistSq = dSq;
            nearestZombie = zombie;
        }
    }
    return nearestZombie;
}

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Limit concurrent players (Example: max 3)
    if (Object.keys(players).length >= 3) {
        console.log('Max players reached. Disconnecting new user:', socket.id);
        socket.emit('serverFull', 'Server is full (max 3 players).');
        socket.disconnect(true);
        return;
    }

    // Assign first player role
    if (sharedState.firstPlayerId === null) {
        sharedState.firstPlayerId = socket.id;
        console.log('First player assigned:', socket.id);
    }

    // Initialize player state
    let startPos = getRandomSpawnPosition(true); // Spawn inside map
    players[socket.id] = new PlayerServer(socket.id, startPos.x, startPos.y);

    // Start game if this is the first player and game hasn't started
    if (Object.keys(players).length === 1 && sharedState.gameState === 'start') {
        console.log("First player joined, starting game!");
        sharedState.gameState = 'playing';
        startNextWave(); // Start wave 1
    }


    // Send the new player their ID and the current game state
    socket.emit('assignId', socket.id);
    socket.emit('gameStateUpdate', getFullGameState()); // Send initial state

    // Listen for player inputs
    socket.on('playerInput', (inputData) => {
        if (players[socket.id]) {
            players[socket.id].input = {
                dx: typeof inputData.dx === 'number' ? constrain(inputData.dx, -1, 1) : 0,
                dy: typeof inputData.dy === 'number' ? constrain(inputData.dy, -1, 1) : 0,
                shooting: typeof inputData.shooting === 'boolean' ? inputData.shooting : false,
                angle: typeof inputData.angle === 'number' ? inputData.angle : (players[socket.id].input.angle === null ? null : (players[socket.id].angle || 0)) // Preserve null for mobile if sent
            };
        }
    });

    // Listen for perk selection from the first player
    socket.on('perkSelected', (perkChoice) => {
        if (socket.id === sharedState.firstPlayerId && sharedState.gameState === 'levelUp') {
            applyPerkServer(perkChoice);
        } else {
            console.log(`Player ${socket.id} tried to select perk but is not first player or not level up state.`);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        if (sharedState.firstPlayerId === socket.id) {
            sharedState.firstPlayerId = null;
            const playerIds = Object.keys(players);
            if (playerIds.length > 0) {
                sharedState.firstPlayerId = playerIds[0];
                console.log('New first player assigned:', sharedState.firstPlayerId);
            } else {
                console.log("Last player left. Resetting game state.");
                // Reset game state when last player leaves
                 sharedState = {
                    gameState: 'start', health: 100, maxHealth: 100, currentXP: 0,
                    xpToNextLevel: BASE_XP_TO_LEVEL, level: 1, acquiredPerks: [],
                    firstPlayerId: null, wave: 0, score: 0, maxShieldHealth: 0,
                    shieldHealth: 0, shieldRegenTimer: 0, shieldRegenDelay: 300,
                    shieldRegenRate: 0, xpVacuumTimer: 0, xpVacuumCooldown: 1200,
                    hasXPVacuum: false, lastStandCooldownTimer: 0, lastStandCooldown: 1800,
                };
                zombies = {}; bullets = {}; enemyBullets = {}; xpBalls = {}; zombiesRemaining = 0;
            }
        }
    });
});

// --- Server Game Loop ---
setInterval(() => {
    // console.log("Server Tick - State:", sharedState.gameState); // DEBUG LOG
    if (sharedState.gameState === 'playing') { // Only update game if playing
       updateGame();
    }
    // Prepare state snapshot for broadcasting
    let stateSnapshot = {
        players: {}, bullets: {}, enemyBullets: {}, zombies: {}, xpBalls: {},
        shared: sharedState,
        // gameState: sharedState.gameState // Already in sharedState
    };
    // Populate snapshot with simplified state objects
    for(const id in players) stateSnapshot.players[id] = players[id].getState();
    for(const id in bullets) stateSnapshot.bullets[id] = bullets[id].getState();
    for(const id in enemyBullets) stateSnapshot.enemyBullets[id] = enemyBullets[id].getState();
    for(const id in zombies) stateSnapshot.zombies[id] = zombies[id].getState();
    for(const id in xpBalls) stateSnapshot.xpBalls[id] = xpBalls[id].getState();

    io.emit('gameStateUpdate', stateSnapshot);
}, 1000 / TICK_RATE);

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});

// Helper to get relevant state for new players
function getFullGameState() {
     // Prepare state snapshot for new player
    let stateSnapshot = {
        players: {}, bullets: {}, enemyBullets: {}, zombies: {}, xpBalls: {},
        shared: sharedState,
        // gameState: sharedState.gameState // Already in sharedState
    };
    for(const id in players) stateSnapshot.players[id] = players[id].getState();
    for(const id in bullets) stateSnapshot.bullets[id] = bullets[id].getState();
    for(const id in enemyBullets) stateSnapshot.enemyBullets[id] = enemyBullets[id].getState();
    for(const id in zombies) stateSnapshot.zombies[id] = zombies[id].getState();
    for(const id in xpBalls) stateSnapshot.xpBalls[id] = xpBalls[id].getState();
    return stateSnapshot;
}

// --- Placeholder for server-side perk definitions/selection ---
function selectUpgradesServer(acquiredPerks) {
    console.warn("selectUpgradesServer using basic placeholder logic!");
    let pool = [ 'speed_up', 'health_boost', 'damage_boost', 'fire_rate_up', 'xp_gain_up', 'regen_boost', 'piercing_shots', 'multi_shot', 'energy_shield', 'xp_magnet', 'xp_vacuum', 'crit_chance', 'crit_damage', 'faster_bullets', 'dot_chance', 'dot_damage', 'ricochet', 'giant_bullets', 'thorns', 'adrenaline', 'last_stand', 'health_on_kill', 'damage_reduction', 'greed', 'orb_doubler', 'wave_clear_bonus' ];
    if (sharedState.hasXPVacuum) pool = pool.filter(id => id !== 'xp_vacuum');
    // TODO: Add filtering for hasAdrenaline, hasLastStand if those player properties exist server-side
    pool.sort(() => 0.5 - Math.random());
    return pool.slice(0, Math.min(3, pool.length));
}

// --- Utility Functions ---
function constrain(val, minVal, maxVal) { return Math.max(minVal, Math.min(maxVal, val)); }
function random(minOrMax, maxOrUndefined) { if (maxOrUndefined === undefined) { return Math.random() * minOrMax; } else { return Math.random() * (maxOrUndefined - minOrMax) + minOrMax; } }
function floor(n) { return Math.floor(n); }
function atan2(y, x) { return Math.atan2(y, x); }
function min(a, b) { return Math.min(a, b); }
function max(a, b) { return Math.max(a, b); }

// Override getRandomSpawnPosition for server-side spawning inside map
function getRandomSpawnPosition(insideMap = false) {
    let bufferX = insideMap ? PLAYER_SIZE * 2 : -50; // Spawn further inside if insideMap
    let bufferY = insideMap ? PLAYER_SIZE * 2 : -50;
    let x, y;

    if (Math.random() < 0.5) { // Top/Bottom Edge
        x = random(bufferX, MAP_WIDTH - bufferX);
        y = (Math.random() < 0.5) ? bufferY : MAP_HEIGHT - bufferY;
    } else { // Left/Right Edge
        x = (Math.random() < 0.5) ? bufferX : MAP_WIDTH - bufferX;
        y = random(bufferY, MAP_HEIGHT - bufferY);
    }
    return new Vector(x, y); // Use new Vector
}
