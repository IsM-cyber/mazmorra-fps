// ==============================================
// MÓDULO GENERADOR DE MAZMORRAS
// ==============================================
const MapGenerator = {
    noise(x, y) {
        const ix = Math.floor(x), iy = Math.floor(y);
        const fx = x - ix, fy = y - iy;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const hash = (a, b) => {
            let h = a * 374761393 + b * 668265263 + 1013904223;
            h = (h ^ (h >> 13)) * 1274126177;
            return (h ^ (h >> 16)) / 4294967296;
        };
        const v00 = hash(ix, iy), v10 = hash(ix + 1, iy), v01 = hash(ix, iy + 1), v11 = hash(ix + 1, iy + 1);
        const a = v00 + (v10 - v00) * sx, b = v01 + (v11 - v01) * sx;
        return a + (b - a) * sy;
    },

    createStoneTexture(baseColor) {
        const size = Game.config.TEX_SIZE;
        const off = new OffscreenCanvas(size, size);
        const octx = off.getContext('2d');
        const imageData = octx.createImageData(size, size);
        const data = imageData.data;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                let val = 0, amp = 1, freq = 0.02, totalAmp = 0;
                for (let i = 0; i < 4; i++) {
                    val += this.noise(x * 0.03 * freq, y * 0.03 * freq) * amp;
                    totalAmp += amp;
                    amp *= 0.5;
                    freq *= 2.3;
                }
                val /= totalAmp;
                const factor = 0.4 + val * 1.2;
                const r = Math.min(255, Math.max(0, Math.floor(baseColor[0] * factor)));
                const g = Math.min(255, Math.max(0, Math.floor(baseColor[1] * factor)));
                const b = Math.min(255, Math.max(0, Math.floor(baseColor[2] * factor)));
                const idx = (y * size + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }
        octx.putImageData(imageData, 0, 0);
        return octx.getImageData(0, 0, size, size);
    },

    generateWorld() {
        Game.reset();
        const MAP_S = Game.config.MAP_SIZE;
        const CELL = Game.config.CELL_SIZE;
        for (let i = 0; i < MAP_S * MAP_S; i++) Game.solidMap[i] = 1;
        const dungeon = new Uint8Array(MAP_S * MAP_S);
        const minRoomSize = 6, maxRoomSize = 20, maxRooms = 40;
        const rooms = [];
        for (let attempt = 0; attempt < 200; attempt++) {
            const w = minRoomSize + Math.floor(Math.random() * (maxRoomSize - minRoomSize));
            const h = minRoomSize + Math.floor(Math.random() * (maxRoomSize - minRoomSize));
            const x = Math.floor(Math.random() * (MAP_S - w - 2)) + 1;
            const z = Math.floor(Math.random() * (MAP_S - h - 2)) + 1;
            let overlaps = false;
            for (const room of rooms) {
                if (x < room.x + room.w + 2 && x + w + 2 > room.x && z < room.z + room.h + 2 && z + h + 2 > room.z) {
                    overlaps = true;
                    break;
                }
            }
            if (!overlaps) {
                for (let dz = 0; dz < h; dz++)
                    for (let dx = 0; dx < w; dx++)
                        dungeon[(z + dz) * MAP_S + (x + dx)] = 1;
                rooms.push({ x, z, w, h, centerX: x + Math.floor(w / 2), centerZ: z + Math.floor(h / 2) });
                if (rooms.length >= maxRooms) break;
            }
        }
        for (let i = 1; i < rooms.length; i++) {
            const a = rooms[i - 1], b = rooms[i];
            this.carveCorridor(dungeon, a.centerX, a.centerZ, b.centerX, a.centerZ);
            this.carveCorridor(dungeon, b.centerX, a.centerZ, b.centerX, b.centerZ);
        }
        for (let z = 0; z < MAP_S; z++)
            for (let x = 0; x < MAP_S; x++)
                Game.solidMap[z * MAP_S + x] = (dungeon[z * MAP_S + x] === 1) ? 0 : 1;
        this.findSafeSpawn(rooms);
        this.spawnEnemies(rooms);
    },

    carveCorridor(map, x1, z1, x2, z2) {
        const w = 2;
        const MAP_S = Game.config.MAP_SIZE;
        if (x1 === x2) {
            for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++)
                for (let dx = -Math.floor(w / 2); dx < Math.ceil(w / 2); dx++) {
                    const nx = x1 + dx, nz = z;
                    if (nx >= 0 && nx < MAP_S && nz >= 0 && nz < MAP_S) map[nz * MAP_S + nx] = 1;
                }
        } else {
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
                for (let dz = -Math.floor(w / 2); dz < Math.ceil(w / 2); dz++) {
                    const nx = x, nz = z1 + dz;
                    if (nx >= 0 && nx < MAP_S && nz >= 0 && nz < MAP_S) map[nz * MAP_S + nx] = 1;
                }
        }
    },

    findSafeSpawn(rooms) {
        const CELL = Game.config.CELL_SIZE;
        if (rooms.length > 0) {
            const room = rooms[0];
            const wx = room.centerX * CELL + CELL / 2, wz = room.centerZ * CELL + CELL / 2;
            if (!Game.boxCollides(wx, wz, Game.config.PLAYER_RADIUS, Game.config.TUNNEL_FLOOR, Game.config.TUNNEL_FLOOR + Game.config.PLAYER_HEIGHT)) {
                Game.camX = wx; Game.camZ = wz; Game.camY = Game.config.TUNNEL_FLOOR + Game.config.EYE_HEIGHT; Game.vy = 0; Game.isOnGround = true;
                return;
            }
        }
        const MAP_S = Game.config.MAP_SIZE;
        const cx = Math.floor(MAP_S / 2), cz = Math.floor(MAP_S / 2);
        for (let dz = -2; dz <= 2; dz++)
            for (let dx = -2; dx <= 2; dx++) {
                const nx = cx + dx, nz = cz + dz;
                if (nx >= 0 && nx < MAP_S && nz >= 0 && nz < MAP_S) Game.solidMap[nz * MAP_S + nx] = 0;
            }
        Game.camX = Game.WORLD_SIZE / 2; Game.camZ = Game.WORLD_SIZE / 2; Game.camY = Game.config.TUNNEL_FLOOR + Game.config.EYE_HEIGHT; Game.vy = 0; Game.isOnGround = true;
    },

    isValidSpawn(wx, wz, radius) {
        const checkRadius = radius + 0.1;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const cx = wx + Math.cos(angle) * checkRadius;
            const cz = wz + Math.sin(angle) * checkRadius;
            const idx = Game.getCellIndex(cx, cz);
            if (idx === -1 || Game.solidMap[idx] === 1) return false;
        }
        const centerIdx = Game.getCellIndex(wx, wz);
        if (centerIdx === -1 || Game.solidMap[centerIdx] === 1) return false;
        return true;
    },

    spawnEnemies(rooms) {
        Game.enemies.length = 0;
        const spawnRadius = 0.4;
        const safeDistance = 10;
        const CELL = Game.config.CELL_SIZE;
        const MAP_S = Game.config.MAP_SIZE;

        const playerCX = Math.floor(Game.camX / CELL);
        const playerCZ = Math.floor(Game.camZ / CELL);
        for (let dz = -7; dz <= 7; dz++) {
            for (let dx = -7; dx <= 7; dx++) {
                const cx = playerCX + dx;
                const cz = playerCZ + dz;
                if (cx >= 0 && cx < MAP_S && cz >= 0 && cz < MAP_S) {
                    Game.solidMap[cz * MAP_S + cx] = 0;
                }
            }
        }

        for (let i = 0; i < Game.config.MAX_ENEMIES; i++) {
            let placed = false;
            for (let attempt = 0; attempt < 500; attempt++) {
                const ax = (Math.random() * (MAP_S - 4) + 2) * CELL;
                const az = (Math.random() * (MAP_S - 4) + 2) * CELL;

                if (Math.abs(ax - Game.camX) < safeDistance * CELL && Math.abs(az - Game.camZ) < safeDistance * CELL) continue;
                if (!this.isValidSpawn(ax, az, spawnRadius)) continue;

                let tooClose = false;
                for (const e of Game.enemies) {
                    if (Math.hypot(ax - e.x, az - e.z) < 2.0) { tooClose = true; break; }
                }
                if (tooClose) continue;

                Game.enemies.push({
                    x: ax, z: az,
                    angle: Math.random() * Math.PI * 2,
                    health: 5,                // ← VIDA FIJA 5 PUNTOS
                    speed: 2.0,
                    state: 'patrol', patrolTimer: 2 + Math.random() * 3,
                    boredTimer: 0,
                    alertTargetX: 0, alertTargetZ: 0, alertStuckCounter: 0,
                    dead: false, deathTime: 0, deathAnimDone: false,
                    shootCooldown: 0, shooting: false, shootTimer: 0,
                    burstCount: 0
                });
                placed = true;
                break;
            }

            if (!placed) {
                for (let attempt = 0; attempt < 300; attempt++) {
                    const ax = (Math.random() * (MAP_S - 2) + 1) * CELL;
                    const az = (Math.random() * (MAP_S - 2) + 1) * CELL;

                    if (Math.abs(ax - Game.camX) < safeDistance * CELL && Math.abs(az - Game.camZ) < safeDistance * CELL) continue;
                    if (!this.isValidSpawn(ax, az, spawnRadius)) continue;

                    let tooClose = false;
                    for (const e of Game.enemies) {
                        if (Math.hypot(ax - e.x, az - e.z) < 2.0) { tooClose = true; break; }
                    }
                    if (tooClose) continue;

                    Game.enemies.push({
                        x: ax, z: az,
                        angle: Math.random() * Math.PI * 2,
                        health: 5,                // ← VIDA FIJA 5 PUNTOS
                        speed: 2.0,
                        state: 'patrol', patrolTimer: 2 + Math.random() * 3,
                        boredTimer: 0,
                        alertTargetX: 0, alertTargetZ: 0, alertStuckCounter: 0,
                        dead: false, deathTime: 0, deathAnimDone: false,
                        shootCooldown: 0, shooting: false, shootTimer: 0,
                        burstCount: 0
                    });
                    placed = true;
                    break;
                }
            }
        }
    }
};