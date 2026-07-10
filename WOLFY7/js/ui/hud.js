// ==============================================
// MÓDULO HUD (PISTOLA, CRUZ, MINIMAPA, BARRA DE VIDA, MUNICIÓN)
// ==============================================
const HUD = {
    gunSprites: null,
    gunBBoxes: null,

    init() {
        this.gunSprites = [
            this.parseGunSprite(gunIdleRaw),
            this.parseGunSprite(gunFire1Raw),
            this.parseGunSprite(gunFire2Raw)
        ];
        this.gunBBoxes = this.gunSprites.map(pixels => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            pixels.forEach(p => {
                if (p.color === '#000000') return;
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            });
            if (!isFinite(minX)) { minX=0; minY=0; maxX=0; maxY=0; }
            return { minX, minY, maxX, maxY };
        });
    },

    parseGunSprite(raw) {
        const lines = raw.trim().split('\n');
        const pixels = [];
        lines.forEach(line => {
            const [x, y, color] = line.split(',');
            if (x && y && color) pixels.push({ x: +x, y: +y, color });
        });
        return pixels;
    },

    drawGun(renderer, keys) {
        const now = performance.now();
        let walkBob = 0;
        if (Game.isOnGround && (keys['w'] || keys['s'] || keys['a'] || keys['d'])) {
            walkBob = Math.sin(now * 0.015) * 2;
        }

        const scale = 2;
        const screenCenterX = renderer.width / 2;
        const screenBottom = renderer.height + 5 + Game.gunRecoil + walkBob;
        const ctx = renderer.ctx;

        let currentSprite, bbox;
        if (Game.gunState === 'firing') {
            const elapsed = (now - Game.fireStartTime) / 1000;
            if (elapsed < 0.12) {
                currentSprite = this.gunSprites[1];
                bbox = this.gunBBoxes[1];
            } else if (elapsed < 0.24) {
                currentSprite = this.gunSprites[2];
                bbox = this.gunBBoxes[2];
            } else {
                Game.gunState = 'idle';
                currentSprite = this.gunSprites[0];
                bbox = this.gunBBoxes[0];
            }
        } else {
            currentSprite = this.gunSprites[0];
            bbox = this.gunBBoxes[0];
        }

        const gunCenterX = (bbox.minX + bbox.maxX) / 2;
        const gunBaseY = bbox.maxY;

        ctx.save();
        ctx.translate(screenCenterX, screenBottom);
        currentSprite.forEach(p => {
            if (p.color === '#000000') return;
            const drawX = (p.x - gunCenterX) * scale;
            const drawY = (p.y - gunBaseY) * scale;
            ctx.fillStyle = p.color;
            ctx.fillRect(drawX, drawY, scale, scale);
        });
        ctx.restore();
    },

    drawCrosshair(renderer, now) {
        const hitActive = (Game.hitDist >= 0 && (now - Game.hitTime) < Game.config.HIT_MARKER_DURATION * 1000);
        const ctx = renderer.ctx;
        ctx.fillStyle = hitActive ? '#ff0000' : '#000000';
        const cx = Math.floor(renderer.width / 2);
        const cy = Math.floor(renderer.height / 2);
        ctx.fillRect(cx, cy, 1, 1);
    },

    drawHealthBar(renderer) {
        const ctx = renderer.ctx;
        const barWidth = 200;
        const barHeight = 14;
        const x = 20;
        const y = renderer.height - 50;

        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);

        const ratio = Game.health / Game.maxHealth;
        const fillWidth = Math.max(0, Math.floor(barWidth * ratio));
        let fillColor;
        if (ratio < 0.3) {
            fillColor = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff0000' : '#aa0000';
        } else if (ratio < 0.6) {
            fillColor = '#ffaa00';
        } else {
            fillColor = '#00cc44';
        }
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, fillWidth, barHeight);

        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);
    },

    /*// Contador de munición (ahora encima de la barra de vida, a la izquierda)
    drawAmmo(renderer) {
        const ctx = renderer.ctx;
        const x = 20;                         // mismo margen izquierdo que la barra
        const y = renderer.height - 65;       // justo encima de la barra (que está en height-50)
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${Game.ammo} / ${Game.maxAmmo}`, x, y);
    },*/
    // Contador de munición con reserva
    drawAmmo(renderer) {
        const ctx = renderer.ctx;
        const x = 20;
        const y = renderer.height - 65;       // encima de la barra de vida
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'left';
        // Muestra: "12 / 48" (cargador / reserva)
        ctx.fillText(`${Game.ammo} / ${Game.reserveAmmo}`, x, y);
    },

    drawDeathMessage(renderer) {
        if (!Game.isDead()) return;
        const now = performance.now();
        const elapsed = now - Game.deathTime;
        if (elapsed > 2000) return;

        const ctx = renderer.ctx;
        const alpha = 1.0 - (elapsed / 2000);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('HAS MUERTO', renderer.width / 2, renderer.height / 2);
        ctx.restore();
    },

    drawMinimap(renderer) {
        if (Game.showFullMap) {
            this.drawFullMap(renderer);
            return;
        }

        const ctx = renderer.ctx;
        const mmX = renderer.width - Game.config.MINIMAP_SIZE - Game.config.MINIMAP_POS_X;
        const mmY = renderer.height - Game.config.MINIMAP_SIZE - Game.config.MINIMAP_POS_Y;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(mmX, mmY, Game.config.MINIMAP_SIZE, Game.config.MINIMAP_SIZE);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX, mmY, Game.config.MINIMAP_SIZE, Game.config.MINIMAP_SIZE);

        const pixelsPerMeter = Game.config.MINIMAP_SIZE / Game.config.MINIMAP_RANGE;
        const halfRange = Game.config.MINIMAP_RANGE / 2;
        const centerCellX = Game.camX / Game.config.CELL_SIZE, centerCellZ = Game.camZ / Game.config.CELL_SIZE;
        const cellsPerSide = Game.config.MINIMAP_RANGE / Game.config.CELL_SIZE;
        const startCellX = Math.floor(centerCellX - cellsPerSide / 2);
        const startCellZ = Math.floor(centerCellZ - cellsPerSide / 2);

        for (let dz = 0; dz < cellsPerSide; dz++) {
            for (let dx = 0; dx < cellsPerSide; dx++) {
                const mapX = startCellX + dx, mapZ = startCellZ + dz;
                if (mapX < 0 || mapX >= Game.config.MAP_SIZE || mapZ < 0 || mapZ >= Game.config.MAP_SIZE) continue;
                const idx = mapZ * Game.config.MAP_SIZE + mapX;
                const isWall = Game.solidMap[idx] === 1;
                const screenX = mmX + dx * (Game.config.MINIMAP_SIZE / cellsPerSide);
                const screenY = mmY + dz * (Game.config.MINIMAP_SIZE / cellsPerSide);
                ctx.fillStyle = isWall ? '#444' : '#222';
                ctx.fillRect(Math.floor(screenX), Math.floor(screenY),
                    Math.ceil(Game.config.MINIMAP_SIZE / cellsPerSide), Math.ceil(Game.config.MINIMAP_SIZE / cellsPerSide));
            }
        }

        for (const enemy of Game.enemies) {
            if (enemy.dead) continue;
            const relX = enemy.x - Game.camX, relZ = enemy.z - Game.camZ;
            if (Math.abs(relX) > halfRange || Math.abs(relZ) > halfRange) continue;
            const ex = mmX + Game.config.MINIMAP_SIZE / 2 + relX * pixelsPerMeter;
            const ey = mmY + Game.config.MINIMAP_SIZE / 2 + relZ * pixelsPerMeter;
            ctx.fillStyle = enemy.state === 'alert' ? '#ffff00' : '#ff0000';
            ctx.fillRect(ex - 2, ey - 2, 4, 4);
        }

        const playerScreenX = mmX + Game.config.MINIMAP_SIZE / 2, playerScreenY = mmY + Game.config.MINIMAP_SIZE / 2;
        const arrowLength = 6;
        const tipX = playerScreenX + Math.cos(Game.angle) * arrowLength;
        const tipY = playerScreenY + Math.sin(Game.angle) * arrowLength;
        const leftX = playerScreenX + Math.cos(Game.angle + 2.5) * arrowLength * 0.6;
        const leftY = playerScreenY + Math.sin(Game.angle + 2.5) * arrowLength * 0.6;
        const rightX = playerScreenX + Math.cos(Game.angle - 2.5) * arrowLength * 0.6;
        const rightY = playerScreenY + Math.sin(Game.angle - 2.5) * arrowLength * 0.6;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.fill();
    },

    drawFullMap(renderer) {
        const ctx = renderer.ctx;
        if (!Game.fullMapCache) {
            Game.fullMapCache = document.createElement('canvas');
            Game.fullMapCache.width = renderer.width;
            Game.fullMapCache.height = renderer.height;
            const cacheCtx = Game.fullMapCache.getContext('2d');

            cacheCtx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            cacheCtx.fillRect(0, 0, renderer.width, renderer.height);

            const mapSize = Game.config.MAP_SIZE;
            const margin = 30;
            const areaW = renderer.width - margin * 2;
            const areaH = renderer.height - margin * 2;
            const cellW = Math.min(areaW, areaH) / mapSize;
            const size = cellW * mapSize;
            const startX = (renderer.width - size) / 2;
            const startY = (renderer.height - size) / 2;

            for (let z = 0; z < mapSize; z++) {
                for (let x = 0; x < mapSize; x++) {
                    if (Game.solidMap[z * mapSize + x] === 1) {
                        cacheCtx.fillStyle = '#666';
                        cacheCtx.fillRect(startX + x * cellW, startY + z * cellW, cellW, cellW);
                    }
                }
            }

            Game.fullMapCache.startX = startX;
            Game.fullMapCache.startY = startY;
            Game.fullMapCache.cellW = cellW;
        }

        ctx.drawImage(Game.fullMapCache, 0, 0);

        const startX = Game.fullMapCache.startX;
        const startY = Game.fullMapCache.startY;
        const cellW = Game.fullMapCache.cellW;

        const px = startX + (Game.camX / Game.config.CELL_SIZE) * cellW;
        const pz = startY + (Game.camZ / Game.config.CELL_SIZE) * cellW;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(px, pz, Math.max(3, cellW * 1.5), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, pz);
        ctx.lineTo(px + Math.cos(Game.angle) * cellW * 3, pz + Math.sin(Game.angle) * cellW * 3);
        ctx.stroke();

        for (const enemy of Game.enemies) {
            if (enemy.dead) continue;
            const ex = startX + (enemy.x / Game.config.CELL_SIZE) * cellW;
            const ez = startY + (enemy.z / Game.config.CELL_SIZE) * cellW;
            ctx.fillStyle = enemy.state === 'alert' ? '#ff0' : '#f00';
            ctx.beginPath();
            ctx.arc(ex, ez, Math.max(2, cellW * 1.2), 0, Math.PI * 2);
            ctx.fill();
        }

        if (performance.now() - Game.lastShotTime < Game.config.SHOT_SOUND_DISPLAY_DURATION * 1000) {
            const sx = startX + (Game.lastShotX / Game.config.CELL_SIZE) * cellW;
            const sy = startY + (Game.lastShotZ / Game.config.CELL_SIZE) * cellW;
            const soundRadiusPx = (Game.config.SHOT_SOUND_RADIUS / Game.config.CELL_SIZE) * cellW;
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, soundRadiusPx, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.fill();
        }

        ctx.fillStyle = '#fff';
        ctx.font = '14px monospace';
        ctx.fillText('MAPA COMPLETO (M = cerrar)', 40, 40);
    }
};