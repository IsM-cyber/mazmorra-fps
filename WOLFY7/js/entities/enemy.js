// ==============================================
// MÓDULO DE ENEMIGOS (IA, DIBUJADO OPTIMIZADO, DAÑO AL JUGADOR)
// ==============================================
const Enemy = {
    rawFrames: {
        idle:   idleRawViews,
        walk:   walkRawViews,
        attack: attackRawFrames,
        death:  deathRawFrames,
        pain:   []
    },
    animSpeeds: {
        idle: 800,
        walk: 200,
        attack: 120,
        death: 300,
        pain: 200
    },
    stateSprites: null,
    fastSprites: null,

    init() {
        this.stateSprites = this.buildEnemySprites(this.rawFrames);
        this.fastSprites = this.buildFastSprites(this.stateSprites);
    },

    parseEnemySprite(raw) {
        const lines = raw.trim().split('\n');
        const pixels = [];
        let transparentColor = null;
        lines.forEach(line => {
            const parts = line.split(',');
            if (parts.length === 3) {
                const x = +parts[0], y = +parts[1], color = parts[2];
                if (transparentColor === null) transparentColor = color;
                pixels.push({ x, y, color });
            }
        });
        pixels.transparentColor = transparentColor || '#000000';
        return pixels;
    },

    buildEnemySprites(rawFrames) {
        const sprites = {};
        for (const state in rawFrames) {
            const rawData = rawFrames[state];
            if (!rawData || rawData.length === 0) { sprites[state] = []; continue; }
            if (!Array.isArray(rawData[0])) {
                const parsedFrames = rawData.map(raw => this.parseEnemySprite(raw));
                sprites[state] = Array(8).fill(parsedFrames);
            } else {
                sprites[state] = rawData.map(viewFrames =>
                    viewFrames.map(raw => this.parseEnemySprite(raw))
                );
            }
        }
        return sprites;
    },

    buildFastSprites(stateSprites) {
        const fast = {};
        for (const state in stateSprites) {
            fast[state] = stateSprites[state].map(viewFrames =>
                viewFrames.map(sprite => this.convertSpriteToFast(sprite))
            );
        }
        return fast;
    },

    convertSpriteToFast(sprite) {
        const transp = sprite.transparentColor || '#000000';
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        sprite.forEach(p => {
            if (p.color === transp) return;
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const size = width * height;
        const data = new Uint32Array(size);
        data.fill(0x1000000);
        sprite.forEach(p => {
            if (p.color === transp) return;
            const localX = p.x - minX;
            const localY = p.y - minY;
            const hex = p.color.replace('#', '');
            const numColor = parseInt(hex, 16);
            data[localY * width + localX] = numColor;
        });
        return { width, height, data, minX, minY };
    },

    update(deltaTime) {
        const detectionRadius = 12;
        const alertRadius = 22;
        const shootRange = 18;
        const burstInterval = 0.15;
        const burstCooldown = 0.5;
        const damageAmount = 8;

        for (const enemy of Game.enemies) {
            if (enemy.dead) continue;

            if (enemy.lastDamageTime === undefined) {
                enemy.lastDamageTime = 0;
            }

            const dx = Game.camX - enemy.x, dz = Game.camZ - enemy.z;
            const dist = Math.sqrt(dx*dx + dz*dz);

            if (enemy.shooting) {
                enemy.shootTimer -= deltaTime;
                if (enemy.shootTimer <= 0) enemy.shooting = false;
            }
            if (enemy.shootCooldown > 0) enemy.shootCooldown -= deltaTime;

            const canSee = dist < detectionRadius && this.hasLineOfSight(enemy.x, enemy.z, Game.camX, Game.camZ);

            if (canSee) {
                enemy.state = 'chase';
                enemy.angle = Math.atan2(dz, dx);
                if (dist < shootRange && enemy.shootCooldown <= 0) {
                    if (enemy.burstCount <= 0 && !enemy.shooting) {
                        enemy.burstCount = 3;
                        enemy.shootCooldown = burstCooldown;
                    }
                    if (enemy.burstCount > 0 && !enemy.shooting) {
                        Audio.playEnemyShot();
                        enemy.shooting = true;
                        enemy.shootTimer = 0.15;
                        enemy.burstCount--;
                        if (enemy.burstCount > 0) {
                            enemy.shootCooldown = burstInterval;
                        } else {
                            enemy.shootCooldown = burstCooldown;
                        }

                        const now = performance.now();
                        if (now - enemy.lastDamageTime > 300) {
                            Game.takeDamage(damageAmount);
                            enemy.lastDamageTime = now;
                        }
                    }
                }
            } else {
                if (enemy.state !== 'alert' && enemy.state !== 'chase') {
                    if (dist < alertRadius) {
                        enemy.state = 'alert';
                    } else {
                        enemy.state = 'patrol';
                    }
                }
            }

            if (enemy.shooting) continue;

            if (enemy.state === 'chase') {
                if (dist > shootRange) {
                    const moveDirX = dx / dist, moveDirZ = dz / dist;
                    const newX = enemy.x + moveDirX * enemy.speed * deltaTime;
                    const newZ = enemy.z + moveDirZ * enemy.speed * deltaTime;
                    if (!this.boxCollides(newX, newZ, 0.4) && !Game.playerEnemyCollision(newX, newZ, 0.4, enemy)) {
                        enemy.x = newX; enemy.z = newZ;
                    }
                }
            } else if (enemy.state === 'alert') {
                const targetX = enemy.alertTargetX || Game.camX;
                const targetZ = enemy.alertTargetZ || Game.camZ;
                const tdx = targetX - enemy.x, tdz = targetZ - enemy.z;
                const tdist = Math.sqrt(tdx*tdx + tdz*tdz);

                if (tdist > 1.0) {
                    const desiredAngle = Math.atan2(tdz, tdx);
                    let angleDelta = desiredAngle - enemy.angle;
                    while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
                    while (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;

                    const moveX = Math.cos(enemy.angle) * enemy.speed * deltaTime;
                    const moveZ = Math.sin(enemy.angle) * enemy.speed * deltaTime;
                    const newX = enemy.x + moveX, newZ = enemy.z + moveZ;

                    if (!this.boxCollides(newX, newZ, 0.4) && !Game.playerEnemyCollision(newX, newZ, 0.4, enemy)) {
                        let wallAngle = null;
                        const sideDist = 0.6;
                        const leftCheckX = enemy.x + Math.cos(enemy.angle - Math.PI/2) * sideDist;
                        const leftCheckZ = enemy.z + Math.sin(enemy.angle - Math.PI/2) * sideDist;
                        const rightCheckX = enemy.x + Math.cos(enemy.angle + Math.PI/2) * sideDist;
                        const rightCheckZ = enemy.z + Math.sin(enemy.angle + Math.PI/2) * sideDist;

                        const leftCollides = this.boxCollides(leftCheckX, leftCheckZ, 0.3);
                        const rightCollides = this.boxCollides(rightCheckX, rightCheckZ, 0.3);

                        if (leftCollides && !rightCollides) {
                            wallAngle = enemy.angle - Math.PI/2;
                        } else if (rightCollides && !leftCollides) {
                            wallAngle = enemy.angle + Math.PI/2;
                        } else if (leftCollides && rightCollides) {
                            wallAngle = desiredAngle;
                        }

                        if (wallAngle !== null) {
                            let wallDelta = wallAngle - enemy.angle;
                            while (wallDelta > Math.PI) wallDelta -= 2 * Math.PI;
                            while (wallDelta < -Math.PI) wallDelta += 2 * Math.PI;
                            enemy.angle += wallDelta * Math.min(1, 4 * deltaTime);
                        } else {
                            if (Math.abs(angleDelta) > 0.05) {
                                enemy.angle += angleDelta * Math.min(1, 5 * deltaTime);
                            }
                        }

                        enemy.x = newX; enemy.z = newZ;
                        enemy.alertStuckCounter = 0;
                    } else {
                        const newXonly = enemy.x + moveX;
                        const newZonly = enemy.z;
                        const canMoveX = !this.boxCollides(newXonly, newZonly, 0.4) && !Game.playerEnemyCollision(newXonly, newZonly, 0.4, enemy);
                        const canMoveZ = !this.boxCollides(enemy.x, enemy.z + moveZ, 0.4) && !Game.playerEnemyCollision(enemy.x, enemy.z + moveZ, 0.4, enemy);

                        if (canMoveX) {
                            enemy.x = newXonly;
                            enemy.alertStuckCounter = 0;
                        } else if (canMoveZ) {
                            enemy.z = enemy.z + moveZ;
                            enemy.alertStuckCounter = 0;
                        } else {
                            enemy.alertStuckCounter += deltaTime;
                            const strafeDir = angleDelta > 0 ? 1 : -1;
                            enemy.angle += strafeDir * (Math.PI / 4);

                            if (enemy.alertStuckCounter > 0.8) {
                                enemy.alertTargetX = 0; enemy.alertTargetZ = 0;
                                enemy.alertStuckCounter = 0;
                                const backX = enemy.x - moveX * 1.5;
                                const backZ = enemy.z - moveZ * 1.5;
                                if (!this.boxCollides(backX, backZ, 0.4) && !Game.playerEnemyCollision(backX, backZ, 0.4, enemy)) {
                                    enemy.x = backX; enemy.z = backZ;
                                }
                                enemy.angle += Math.PI * 0.8 + (Math.random() - 0.5) * 1.5;
                            }
                        }
                    }
                } else {
                    enemy.alertTargetX = 0; enemy.alertTargetZ = 0;
                    enemy.alertStuckCounter = 0;
                    const forwardX = Math.cos(enemy.angle) * enemy.speed * deltaTime;
                    const forwardZ = Math.sin(enemy.angle) * enemy.speed * deltaTime;
                    const newX = enemy.x + forwardX, newZ = enemy.z + forwardZ;
                    if (!this.boxCollides(newX, newZ, 0.4) && !Game.playerEnemyCollision(newX, newZ, 0.4, enemy)) {
                        enemy.x = newX; enemy.z = newZ;
                        enemy.patrolTimer -= deltaTime;
                        if (enemy.patrolTimer <= 0) {
                            enemy.angle += (Math.random() - 0.5) * 3.0;
                            enemy.patrolTimer = 0.5 + Math.random() * 1.5;
                        }
                    } else {
                        enemy.angle += Math.PI * 0.8 + (Math.random() - 0.5) * 1.5;
                        enemy.patrolTimer = 0.5 + Math.random() * 1.0;
                        const backX = enemy.x - forwardX * 0.5, backZ = enemy.z - forwardZ * 0.5;
                        if (!this.boxCollides(backX, backZ, 0.4) && !Game.playerEnemyCollision(backX, backZ, 0.4, enemy)) { enemy.x = backX; enemy.z = backZ; }
                    }
                }
            } else {
                const forwardX = Math.cos(enemy.angle) * enemy.speed * deltaTime;
                const forwardZ = Math.sin(enemy.angle) * enemy.speed * deltaTime;
                const newX = enemy.x + forwardX, newZ = enemy.z + forwardZ;

                if (!this.boxCollides(newX, newZ, 0.4) && !Game.playerEnemyCollision(newX, newZ, 0.4, enemy)) {
                    enemy.x = newX; enemy.z = newZ;
                    enemy.patrolTimer -= deltaTime;

                    enemy.boredTimer += deltaTime;
                    const BORED_TIME = 5.0;
                    if (enemy.boredTimer >= BORED_TIME) {
                        enemy.boredTimer = 0;
                        enemy.angle += (Math.random() * Math.PI * 0.5 + Math.PI * 0.5) * (Math.random() < 0.5 ? 1 : -1);
                        enemy.patrolTimer = 2 + Math.random() * 3;
                    }

                    if (enemy.patrolTimer <= 0) {
                        enemy.angle += (Math.random() - 0.5) * 2.5;
                        enemy.patrolTimer = 2 + Math.random() * 3;
                    }
                } else {
                    enemy.angle += Math.PI * 0.6 + (Math.random() - 0.5) * 1.2;
                    enemy.patrolTimer = 1.5 + Math.random() * 2;
                    enemy.boredTimer = 0;
                    const backX = enemy.x - forwardX * 0.5, backZ = enemy.z - forwardZ * 0.5;
                    if (!this.boxCollides(backX, backZ, 0.4) && !Game.playerEnemyCollision(backX, backZ, 0.4, enemy)) { enemy.x = backX; enemy.z = backZ; }
                }
            }
        }
    },

    boxCollides(x, z, halfWidth) {
        return Game.boxCollides(x, z, halfWidth, Game.config.TUNNEL_FLOOR, Game.config.TUNNEL_FLOOR + 2.0);
    },

    hasLineOfSight(x1, z1, x2, z2) {
        const steps = Math.ceil(Math.sqrt((x2-x1)**2 + (z2-z1)**2) / 0.3);
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
            const idx = Game.getCellIndex(x, z);
            if (idx !== -1 && Game.solidMap[idx] === 1) return false;
        }
        return true;
    },

    draw(renderer) {
        const now = performance.now();
        const sorted = Game.enemies.map(e => ({ enemy: e, isDead: e.dead }));

        sorted.sort((a, b) => {
            const distA = Math.sqrt((a.enemy.x - Game.camX)**2 + (a.enemy.z - Game.camZ)**2);
            const distB = Math.sqrt((b.enemy.x - Game.camX)**2 + (b.enemy.z - Game.camZ)**2);
            return distB - distA;
        });

        const scaleX = renderer.renderWidth / renderer.width;
        const halfFov = Game.config.FOV / 2;

        for (const item of sorted) {
            const enemy = item.enemy;
            const dx = enemy.x - Game.camX, dz = enemy.z - Game.camZ;
            const dist = Math.sqrt(dx*dx + dz*dz);
            if (dist < 0.5) continue;

            const spriteAngle = Math.atan2(dz, dx);
            let angleDiff = spriteAngle - Game.angle;
            while (angleDiff > Math.PI) angleDiff -= 2*Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2*Math.PI;
            if (Math.abs(angleDiff) > halfFov + 0.3) continue;

            const dirToPlayerX = -dx;
            const dirToPlayerZ = -dz;
            const angleToPlayer = Math.atan2(dirToPlayerZ, dirToPlayerX);
            let relAngle = angleToPlayer - enemy.angle;
            while (relAngle < 0) relAngle += Math.PI * 2;
            while (relAngle >= Math.PI * 2) relAngle -= Math.PI * 2;

            const sectorSize = Math.PI / 4, halfSector = sectorSize / 2;
            const adjustedAngle = (relAngle + halfSector) % (Math.PI * 2);
            const viewIndex = Math.floor(adjustedAngle / sectorSize) % 8;

            let stateName = 'idle';
            let aimMode = false;

            if (enemy.dead) {
                stateName = 'death';
            } else if (enemy.shooting) {
                stateName = 'attack';
            } else if (enemy.state === 'chase' || enemy.state === 'alert') {
                const distToEnemy = Math.sqrt((enemy.x - Game.camX)**2 + (enemy.z - Game.camZ)**2);
                if (distToEnemy <= 18) {
                    stateName = 'attack';
                    aimMode = true;
                } else {
                    stateName = 'walk';
                }
            }

            const viewFrames = this.fastSprites[stateName]?.[viewIndex];
            if (!viewFrames || viewFrames.length === 0) continue;

            let frameIndex;
            if (stateName === 'death') {
                const elapsedDeath = now - enemy.deathTime;
                const duration = this.animSpeeds.death;
                frameIndex = Math.min(Math.floor(elapsedDeath / duration), viewFrames.length - 1);
                if (frameIndex === viewFrames.length - 1) enemy.deathAnimDone = true;
            } else if (aimMode) {
                frameIndex = 1;
            } else {
                const duration = this.animSpeeds[stateName] || 200;
                frameIndex = Math.floor((now / duration) % viewFrames.length);
            }

            const fastSprite = viewFrames[frameIndex];
            if (!fastSprite) continue;

            const texWidth = fastSprite.width;
            const texHeight = fastSprite.height;

            let spriteHeight = Game.config.ENEMY_HEIGHT;
            if (stateName === 'death' && frameIndex === viewFrames.length - 1) {
                spriteHeight = Game.config.ENEMY_HEIGHT * 0.4;
            }
            const proj = renderer.projectSprite(enemy.x, enemy.z, spriteHeight);
            if (!proj) continue;
            const { screenX, height: projHeight, dist: projDist, floorY } = proj;

            let spriteWidth;
            if (stateName === 'death') {
                if (frameIndex < viewFrames.length - 1) {
                    spriteWidth = projHeight * 0.5;
                } else {
                    spriteWidth = texHeight > 0 ? projHeight * (texWidth / texHeight) : projHeight * 0.5;
                }
            } else {
                spriteWidth = texHeight > 0 ? projHeight * (texWidth / texHeight) : projHeight * 0.5;
            }

            const left = Math.floor(screenX - spriteWidth / 2);
            const right = Math.floor(screenX + spriteWidth / 2);
            const bottom = Math.floor(floorY);
            const top = Math.floor(floorY - projHeight);

            const ctx = renderer.ctx;
            const zBuf = renderer.zBuffer;

            for (let sx = Math.max(0, left); sx <= Math.min(renderer.width - 1, right); sx++) {
                const zIdx = Math.floor(sx * scaleX);
                if (zIdx >= 0 && zIdx < renderer.renderWidth && projDist >= zBuf[zIdx]) continue;
                const texX = Math.floor((sx - left) / (right - left) * texWidth);
                if (texX < 0 || texX >= texWidth) continue;
                for (let y = Math.max(0, top); y <= Math.min(renderer.height - 1, bottom); y++) {
                    const texY = Math.floor((y - top) / (bottom - top) * texHeight);
                    if (texY < 0 || texY >= texHeight) continue;
                    const color = fastSprite.data[texY * texWidth + texX];
                    if (color > 0xFFFFFF) continue;
                    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
                    ctx.fillRect(sx, y, 1, 1);
                }
            }
        }
    }
};