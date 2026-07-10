// ==============================================
// ESTADO CENTRALIZADO DEL JUEGO (SINGLETON)
// ==============================================
const Game = {
    config: CONFIG,
    WORLD_SIZE: CONFIG.MAP_SIZE * CONFIG.CELL_SIZE,

    solidMap: new Uint8Array(CONFIG.MAP_SIZE * CONFIG.MAP_SIZE),

    camX: 0,
    camZ: 0,
    camY: CONFIG.TUNNEL_FLOOR + CONFIG.EYE_HEIGHT,
    angle: 0,
    pitch: 0,
    vy: 0,
    isOnGround: true,
    health: 200,
    maxHealth: 200,
    ammo: 12,                     // balas en el cargador
    maxAmmo: 12,                  // capacidad máxima del cargador
    reserveAmmo: 120,              // ← NUEVO: munición de reserva
    maxReserveAmmo: 120,           // ← NUEVO: máximo de reserva (opcional)
    isReloading: false,
    reloadStartTime: 0,

    gunRecoil: 0,
    recoilTimer: 0,
    screenShake: 0,
    gunState: 'idle',
    fireStartTime: 0,
    hitDist: -1,
    hitTime: 0,
    stepDistFwd: 0,
    stepDistLat: 0,
    lastShotTime: 0,
    lastShotX: 0,
    lastShotZ: 0,

    showFullMap: false,
    fullMapCache: null,
    deathTime: 0,

    enemies: [],
    particles: [],

    getCellIndex(wx, wz) {
        const cx = Math.floor(wx / this.config.CELL_SIZE);
        const cz = Math.floor(wz / this.config.CELL_SIZE);
        if (cx < 0 || cx >= this.config.MAP_SIZE || cz < 0 || cz >= this.config.MAP_SIZE) return -1;
        return cz * this.config.MAP_SIZE + cx;
    },

    boxCollides(x, z, halfWidth, feetY, headY) {
        const offsets = [
            [-halfWidth, -halfWidth],
            [halfWidth, -halfWidth],
            [-halfWidth, halfWidth],
            [halfWidth, halfWidth],
            [0, 0]
        ];
        for (const [dx, dz] of offsets) {
            const idx = this.getCellIndex(x + dx, z + dz);
            if (idx !== -1 && this.solidMap[idx] === 1) {
                if (feetY < this.config.TUNNEL_CEIL && headY > this.config.TUNNEL_FLOOR) return true;
            }
        }
        return false;
    },

    playerEnemyCollision(px, pz, halfWidth, excludeEnemy = null) {
        for (const enemy of this.enemies) {
            if (enemy.dead) continue;
            if (enemy === excludeEnemy) continue;
            const dx = px - enemy.x;
            const dz = pz - enemy.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < halfWidth + 0.4) return true;
        }
        return false;
    },

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        if (this.health <= 0) {
            this.deathTime = performance.now();
            return false;
        }
        return true;
    },

    isDead() {
        return this.health <= 0;
    },

    reset() {
        this.camX = 0;
        this.camZ = 0;
        this.camY = this.config.TUNNEL_FLOOR + this.config.EYE_HEIGHT;
        this.angle = 0;
        this.pitch = 0;
        this.vy = 0;
        this.isOnGround = true;
        this.gunRecoil = 0;
        this.recoilTimer = 0;
        this.screenShake = 0;
        this.gunState = 'idle';
        this.fireStartTime = 0;
        this.hitDist = -1;
        this.hitTime = 0;
        this.stepDistFwd = 0;
        this.stepDistLat = 0;
        this.lastShotTime = 0;
        this.lastShotX = 0;
        this.lastShotZ = 0;
        this.showFullMap = false;
        this.fullMapCache = null;
        this.deathTime = 0;
        this.health = this.maxHealth;
        this.ammo = this.maxAmmo;
        this.reserveAmmo = this.maxReserveAmmo;   // ← reiniciar reserva
        this.isReloading = false;
        this.reloadStartTime = 0;
        this.enemies.length = 0;
        this.particles.length = 0;
        this.solidMap.fill(0);
    }
};