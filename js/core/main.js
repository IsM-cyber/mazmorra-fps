// ==============================================
// MÓDULO PRINCIPAL (INICIALIZACIÓN Y BUCLE)
// ==============================================
const Main = {
    canvas: null,
    lastTime: 0,

    start(canvas) {
        this.canvas = canvas;

        const texNS = MapGenerator.createStoneTexture(Game.config.COLOR_WALL_NS);
        const texEW = MapGenerator.createStoneTexture(Game.config.COLOR_WALL_EW);

        Input.init(canvas);
        Enemy.init();
        HUD.init();
        Renderer.init(canvas, texNS, texEW);
        MapGenerator.generateWorld();

        canvas.addEventListener('click', () => {
            Audio.init();
            canvas.requestPointerLock();
        });

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            Renderer.resize(canvas.width, canvas.height);
        });

        this.lastTime = performance.now();
        requestAnimationFrame((now) => this.gameLoop(now));
    },

    update(deltaTime) {
        // Regenerar mundo con N (Input.regenerate se activa en input.js)
        if (Input.regenerate) {
            MapGenerator.generateWorld();
            Input.regenerate = false;
        }

        /*// Temporizador de recarga
        if (Game.isReloading) {
            if (performance.now() - Game.reloadStartTime >= 2000) {
                Game.ammo = Game.maxAmmo;
                Game.isReloading = false;
            }
        }*/

        // Temporizador de recarga
        if (Game.isReloading) {
            if (performance.now() - Game.reloadStartTime >= 2000) {
                Player.finishReload();
            }
        }

        if (Game.isDead()) {
            if (performance.now() - Game.deathTime > 2000) {
                MapGenerator.generateWorld();
            }
            return;
        }

        Player.update(deltaTime);
        Particles.update(deltaTime);
        Enemy.update(deltaTime);
    },

    gameLoop(now) {
        const deltaTime = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this.update(deltaTime);
        Renderer.render3D();
        Enemy.draw(Renderer);
        Particles.draw(Renderer);
        HUD.drawGun(Renderer, Input.keys);
        HUD.drawCrosshair(Renderer, now);
        HUD.drawMinimap(Renderer);
        HUD.drawHealthBar(Renderer);
        HUD.drawAmmo(Renderer);            // ← contador de munición
        HUD.drawDeathMessage(Renderer);

        requestAnimationFrame((next) => this.gameLoop(next));
    }
};