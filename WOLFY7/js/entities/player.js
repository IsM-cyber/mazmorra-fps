// ==============================================
// MÓDULO DEL JUGADOR (MOVIMIENTO, FÍSICA, DISPARO, RECARGA)
// ==============================================
const Player = {
    playEmptyClick() {
        Audio.playSound('empty', 0.8);
    },

    shoot() {
        if (Game.isReloading) return;

        if (Game.ammo <= 0) {
            this.playEmptyClick();
            return;
        }

        Audio.playShot();
        Game.lastShotTime = performance.now();
        Game.lastShotX = Game.camX;
        Game.lastShotZ = Game.camZ;

        Game.ammo--;

        const cosPitch = Math.cos(Game.pitch);
        const dirX = cosPitch * Math.cos(Game.angle);
        const dirY = Math.sin(Game.pitch);
        const dirZ = cosPitch * Math.sin(Game.angle);

        const eps = 1e-10;
        const CELL = Game.config.CELL_SIZE;
        const MAP_S = Game.config.MAP_SIZE;

        let mapX = Math.floor(Game.camX / CELL);
        let mapZ = Math.floor(Game.camZ / CELL);
        const stepX = dirX > 0 ? 1 : -1;
        const stepZ = dirZ > 0 ? 1 : -1;

        const deltaDistX = Math.abs(dirX) < eps ? Infinity : Math.abs(CELL / dirX);
        const deltaDistZ = Math.abs(dirZ) < eps ? Infinity : Math.abs(CELL / dirZ);

        const nextBoundaryX = (mapX + (stepX > 0 ? 1 : 0)) * CELL;
        const nextBoundaryZ = (mapZ + (stepZ > 0 ? 1 : 0)) * CELL;

        let sideDistX = Math.abs(dirX) < eps ? Infinity : (nextBoundaryX - Game.camX) / dirX;
        let sideDistZ = Math.abs(dirZ) < eps ? Infinity : (nextBoundaryZ - Game.camZ) / dirZ;

        const maxDist = 80;
        let wallDist = maxDist;
        let hitWall = false;
        let wallHitX = 0, wallHitZ = 0;

        for (let i = 0; i < 4000; i++) {
            if (sideDistX < sideDistZ) {
                mapX += stepX;
                wallDist = sideDistX;
                sideDistX += deltaDistX;
                if (mapX < 0 || mapX >= MAP_S || mapZ < 0 || mapZ >= MAP_S) break;
                if (Game.solidMap[mapZ * MAP_S + mapX] === 1) {
                    hitWall = true;
                    wallHitX = Game.camX + dirX * wallDist;
                    wallHitZ = Game.camZ + dirZ * wallDist;
                    break;
                }
            } else {
                mapZ += stepZ;
                wallDist = sideDistZ;
                sideDistZ += deltaDistZ;
                if (mapX < 0 || mapX >= MAP_S || mapZ < 0 || mapZ >= MAP_S) break;
                if (Game.solidMap[mapZ * MAP_S + mapX] === 1) {
                    hitWall = true;
                    wallHitX = Game.camX + dirX * wallDist;
                    wallHitZ = Game.camZ + dirZ * wallDist;
                    break;
                }
            }
            if (wallDist > maxDist) break;
        }

        if (!hitWall) {
            wallDist = maxDist;
            wallHitX = Game.camX + dirX * wallDist;
            wallHitZ = Game.camZ + dirZ * wallDist;
        }

        let hitEnemy = null;
        let enemyHitDist = wallDist;
        let hitY = 0;

        for (const enemy of Game.enemies) {
            if (enemy.dead) continue;

            const ex = enemy.x;
            const ez = enemy.z;
            const radius = 0.6;
            const eBaseY = Game.config.TUNNEL_FLOOR;
            const eTopY = Game.config.TUNNEL_FLOOR + Game.config.ENEMY_HEIGHT;

            const dx = dirX;
            const dz = dirZ;
            const ox = Game.camX - ex;
            const oz = Game.camZ - ez;

            const a = dx * dx + dz * dz;
            if (a < eps) continue;
            const b = 2 * (ox * dx + oz * dz);
            const c = ox * ox + oz * oz - radius * radius;

            const disc = b * b - 4 * a * c;
            if (disc < 0) continue;

            const sqrtDisc = Math.sqrt(disc);
            const t1 = (-b - sqrtDisc) / (2 * a);
            const t2 = (-b + sqrtDisc) / (2 * a);

            let t = Math.min(t1, t2);
            if (t < 0) t = Math.max(t1, t2);
            if (t <= 0 || t >= enemyHitDist) continue;

            hitY = Game.camY + dirY * t;
            if (hitY >= eBaseY - 1.0 && hitY <= eTopY + 1.0) {
                enemyHitDist = t;
                hitEnemy = enemy;
            }
        }

        if (hitEnemy) {
            hitEnemy.health--;
            Game.hitTime = performance.now();

            if (hitEnemy.health <= 0) {
                hitEnemy.dead = true;
                hitEnemy.deathTime = performance.now();
                hitEnemy.deathAnimDone = false;
                Particles.spawn(hitEnemy.x, Game.config.TUNNEL_FLOOR + Game.config.ENEMY_HEIGHT/2, hitEnemy.z, true);
            }
            Game.hitDist = enemyHitDist;
            const impactX = Game.camX + dirX * enemyHitDist;
            const impactY = Game.camY + dirY * enemyHitDist;
            const impactZ = Game.camZ + dirZ * enemyHitDist;
            Particles.spawn(impactX, impactY, impactZ, true);
        } else {
            Game.hitDist = -1;
        }

        this.alertNearbyEnemies();
    },

    alertNearbyEnemies() {
        for (const enemy of Game.enemies) {
            if (enemy.dead) continue;
            const dx = enemy.x - Game.camX, dz = enemy.z - Game.camZ;
            const dist = Math.sqrt(dx*dx + dz*dz);
            if (dist < Game.config.SHOT_SOUND_RADIUS) {
                if (enemy.state !== 'chase') {
                    enemy.state = 'alert';
                    enemy.alertTargetX = Game.camX;
                    enemy.alertTargetZ = Game.camZ;
                }
            }
        }
    },

    // Recarga: transfiere balas de la reserva al cargador
    startReload() {
        if (Game.isReloading) return;
        if (Game.ammo === Game.maxAmmo) return;            // cargador lleno
        if (Game.reserveAmmo <= 0) return;                // sin reserva

        Audio.playReloadSound();
        Game.isReloading = true;
        Game.reloadStartTime = performance.now();
    },

    // Método para completar la recarga (llamado desde main.js cuando pasan 2 segundos)
    finishReload() {
        const needed = Game.maxAmmo - Game.ammo;          // cuántas balas faltan para llenar el cargador
        const transfer = Math.min(needed, Game.reserveAmmo); // no sacar más de lo que hay en reserva
        Game.ammo += transfer;
        Game.reserveAmmo -= transfer;
        Game.isReloading = false;
    },

    update(deltaTime) {
        const moveSpeed = Game.config.MOVE_SPEED * deltaTime;
        const strafeSpeed = Game.config.STRAFE_SPEED * deltaTime;
        const rotSpeed = Game.config.ROT_SPEED * deltaTime * 30;

        if (Input.isDown('q') || Input.isDown('arrowleft')) Game.angle -= rotSpeed;
        if (Input.isDown('e') || Input.isDown('arrowright')) Game.angle += rotSpeed;

        let forward = 0, right = 0;
        if (Input.isDown('w')) forward += 1;
        if (Input.isDown('s')) forward -= 1;
        if (Input.isDown('a')) right -= 1;
        if (Input.isDown('d')) right += 1;
        const len = Math.sqrt(forward*forward + right*right);
        if (len > 0) { forward /= len; right /= len; }

        const fwdX = Math.cos(Game.angle), fwdZ = Math.sin(Game.angle);
        const rightX = -Math.sin(Game.angle), rightZ = Math.cos(Game.angle);

        const moveX = forward * fwdX * moveSpeed + right * rightX * strafeSpeed;
        const moveZ = forward * fwdZ * moveSpeed + right * rightZ * strafeSpeed;

        const oldX = Game.camX, oldZ = Game.camZ;
        const halfW = Game.config.PLAYER_RADIUS;
        const feetY = Game.camY - Game.config.EYE_HEIGHT, headY = feetY + Game.config.PLAYER_HEIGHT;

        const desiredX = Game.camX + moveX, desiredZ = Game.camZ + moveZ;

        if (!Game.boxCollides(desiredX, Game.camZ, halfW, feetY, headY) && !Game.playerEnemyCollision(desiredX, Game.camZ, halfW)) {
            Game.camX = desiredX;
        }
        if (!Game.boxCollides(Game.camX, desiredZ, halfW, feetY, headY) && !Game.playerEnemyCollision(Game.camX, desiredZ, halfW)) {
            Game.camZ = desiredZ;
        }

        Game.camX = Math.max(halfW, Math.min(Game.WORLD_SIZE - halfW, Game.camX));
        Game.camZ = Math.max(halfW, Math.min(Game.WORLD_SIZE - halfW, Game.camZ));

        if (Game.isOnGround) {
            const dx = Game.camX - oldX, dz = Game.camZ - oldZ;
            const fwdMove = Math.abs(dx * fwdX + dz * fwdZ);
            const latMove = Math.abs(dx * rightX + dz * rightZ);
            Game.stepDistFwd += fwdMove; Game.stepDistLat += latMove;
            if (Game.stepDistFwd >= Game.config.STEP_THRESHOLD_FWD) { Audio.playStep(); Game.stepDistFwd -= Game.config.STEP_THRESHOLD_FWD; }
            if (Game.stepDistLat >= Game.config.STEP_THRESHOLD_LAT) { Audio.playStep(); Game.stepDistLat -= Game.config.STEP_THRESHOLD_LAT; }
        } else { Game.stepDistFwd = 0; Game.stepDistLat = 0; }

        const groundY = Game.config.TUNNEL_FLOOR;
        if (Input.isDown(' ') && Game.isOnGround) { Game.vy = Game.config.JUMP_SPEED; Game.isOnGround = false; Input.keys[' '] = false; }
        if (!Game.isOnGround) {
            Game.vy -= Game.config.GRAVITY * deltaTime; Game.camY += Game.vy * deltaTime;
            const newFeetY = Game.camY - Game.config.EYE_HEIGHT;
            if (newFeetY <= groundY) { Game.camY = groundY + Game.config.EYE_HEIGHT; Game.vy = 0; Game.isOnGround = true; }
            const headY2 = Game.camY + (Game.config.PLAYER_HEIGHT - Game.config.EYE_HEIGHT);
            if (headY2 >= Game.config.TUNNEL_CEIL) { Game.camY = Game.config.TUNNEL_CEIL - (Game.config.PLAYER_HEIGHT - Game.config.EYE_HEIGHT); if (Game.vy > 0) Game.vy = 0; }
        } else {
            Game.camY = groundY + Game.config.EYE_HEIGHT; Game.vy = 0;
            const headY2 = Game.camY + (Game.config.PLAYER_HEIGHT - Game.config.EYE_HEIGHT);
            if (headY2 > Game.config.TUNNEL_CEIL) Game.camY = Game.config.TUNNEL_CEIL - (Game.config.PLAYER_HEIGHT - Game.config.EYE_HEIGHT);
        }

        if (Game.recoilTimer > 0) {
            Game.recoilTimer -= deltaTime;
            Game.gunRecoil = Game.gunRecoil * (Game.recoilTimer / Game.config.GUN_RECOIL_TIME);
            if (Game.recoilTimer <= 0) { Game.gunRecoil = 0; Game.recoilTimer = 0; }
        }
        if (Game.screenShake > 0) { Game.screenShake -= deltaTime; if (Game.screenShake < 0) Game.screenShake = 0; }
    }
};