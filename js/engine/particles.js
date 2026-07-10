// ==============================================
// MÓDULO DE PARTÍCULAS (SANGRE, POLVO, ETC.)
// ==============================================
const Particles = {
    // Inicializar (no necesita nada especial)
    init() {},

    // Generar una ráfaga de partículas en una posición del mundo
    spawn(worldX, worldY, worldZ, isEnemy) {
        if (!isEnemy) return;

        const count = 50;
        const colors = [
            { r: 180, g: 0, b: 0 },
            { r: 220, g: 30, b: 30 },
            { r: 140, g: 10, b: 10 },
            { r: 200, g: 15, b: 15 }
        ];

        for (let i = 0; i < count; i++) {
            const speed = 1.5 + Math.random() * 4;
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI * 0.6;
            const vx = Math.cos(theta) * Math.cos(phi) * speed;
            const vy = Math.sin(phi) * speed + 0.8;
            const vz = Math.sin(theta) * Math.cos(phi) * speed;

            const color = colors[Math.floor(Math.random() * colors.length)];

            Game.particles.push({
                x: worldX,
                y: worldY,
                z: worldZ,
                vx, vy, vz,
                life: 0.4 + Math.random() * 0.6,
                maxLife: 0.4 + Math.random() * 0.6,
                size: 0.01 + Math.random() * 0.02,
                color: color
            });

            if (Game.particles.length > Game.config.MAX_PARTICLES) {
                Game.particles.shift();
            }
        }
    },

    // Actualizar la posición y ciclo de vida de todas las partículas
    update(deltaTime) {
        for (let i = Game.particles.length - 1; i >= 0; i--) {
            const p = Game.particles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.z += p.vz * deltaTime;
            p.vy -= 3 * deltaTime;
            p.life -= deltaTime;
            if (p.life <= 0) {
                Game.particles.splice(i, 1);
            }
        }
    },

    // Dibujar todas las partículas
    draw() {
        if (Game.particles.length === 0) return;

        const halfW = Renderer.width / 2;
        const halfH = Renderer.height / 2;
        const fovFactor = halfW / Math.tan(Game.config.FOV / 2);
        const vec = Renderer.getCameraVectors();

        const ctx = Renderer.ctx;

        for (const p of Game.particles) {
            const dx = p.x - Game.camX;
            const dy = p.y - Game.camY;
            const dz = p.z - Game.camZ;

            const camRight = dx * vec.rightX + dy * vec.rightY + dz * vec.rightZ;
            const camUp    = dx * vec.upX    + dy * vec.upY    + dz * vec.upZ;
            const camDepth = dx * vec.fwdX   + dy * vec.fwdY   + dz * vec.fwdZ;

            if (camDepth <= 0.01) continue;

            const screenX = halfW + (camRight / camDepth) * fovFactor;
            const screenY = halfH - (camUp    / camDepth) * fovFactor;

            const screenSize = Math.max(1, (p.size * Game.config.SCALE) / camDepth);
            const alpha = Math.min(1, p.life / p.maxLife);

            ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${alpha})`;
            ctx.fillRect(screenX - screenSize/2, screenY - screenSize/2, screenSize, screenSize);
        }
    }
};