// ==============================================
// MÓDULO DE RENDERIZADO 3D (RAYCASTING)
// ==============================================
const Renderer = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    zBuffer: null,
    wallTextureNS: null,
    wallTextureEW: null,
    offscreenCanvas: null,
    offscreenCtx: null,
    renderWidth: 0,
    renderHeight: 0,

    // Inicializar el renderer con el canvas y las texturas
    init(canvas, texNS, texEW) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.zBuffer = new Float32Array(this.width);
        this.wallTextureNS = texNS;
        this.wallTextureEW = texEW;
        this.createOffscreenCanvas();
    },

    // Crear el canvas interno para subsampling
    createOffscreenCanvas() {
        const scale = Game.config.RENDER_SCALE;
        this.renderWidth = Math.floor(this.width * scale);
        this.renderHeight = Math.floor(this.height * scale);
        if (this.renderWidth < 1) this.renderWidth = 1;
        if (this.renderHeight < 1) this.renderHeight = 1;

        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = this.renderWidth;
        this.offscreenCanvas.height = this.renderHeight;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        this.zBuffer = new Float32Array(this.renderWidth);
    },

    // Actualizar dimensiones al redimensionar la ventana
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.createOffscreenCanvas();
    },

    // Calcular los vectores de cámara una sola vez por frame
    getCameraVectors() {
        const cosPitch = Math.cos(Game.pitch);
        const fwdX = cosPitch * Math.cos(Game.angle);
        const fwdY = Math.sin(Game.pitch);
        const fwdZ = cosPitch * Math.sin(Game.angle);
        const rightX = -Math.sin(Game.angle);
        const rightY = 0;
        const rightZ = Math.cos(Game.angle);
        const upX = rightY * fwdZ - rightZ * fwdY;
        const upY = rightZ * fwdX - rightX * fwdZ;
        const upZ = rightX * fwdY - rightY * fwdX;
        return { fwdX, fwdY, fwdZ, rightX, rightY, rightZ, upX, upY, upZ };
    },

    // Renderizar el mundo 3D completo (ahora con subsampling)
    render3D() {
        const imageData = this.offscreenCtx.createImageData(this.renderWidth, this.renderHeight);
        const data = new Uint32Array(imageData.data.buffer);

        const tanPitch = Math.tan(Game.pitch);
        const cosPitch = Math.cos(Game.pitch);
        const horizonBase = (this.renderHeight / 2) - Game.config.SCALE * tanPitch;
        const angleStep = Game.config.FOV / this.renderWidth;

        const ceilColor  = (255<<24) | (Game.config.COLOR_CEIL[2]<<16) | (Game.config.COLOR_CEIL[1]<<8) | Game.config.COLOR_CEIL[0];
        const floorColor = (255<<24) | (Game.config.COLOR_FLOOR[2]<<16) | (Game.config.COLOR_FLOOR[1]<<8) | Game.config.COLOR_FLOOR[0];

        let shakeX = 0, shakeY = 0;
        if (Game.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * 8;
            shakeY = (Math.random() - 0.5) * 8;
        }

        const CELL = Game.config.CELL_SIZE;
        const MAP_S = Game.config.MAP_SIZE;
        const TEX_S = Game.config.TEX_SIZE;
        const TEX_SC = Game.config.TEX_SCALE;

        for (let sx = 0; sx < this.renderWidth; sx++) {
            const rayAngle = Game.angle - Game.config.FOV/2 + sx * angleStep;
            const rayDirX = Math.cos(rayAngle), rayDirZ = Math.sin(rayAngle);

            let mapX = Math.floor(Game.camX / CELL), mapZ = Math.floor(Game.camZ / CELL);
            const stepX = rayDirX > 0 ? 1 : -1, stepZ = rayDirZ > 0 ? 1 : -1;
            const nextBoundaryX = (mapX + (stepX > 0 ? 1 : 0)) * CELL;
            const nextBoundaryZ = (mapZ + (stepZ > 0 ? 1 : 0)) * CELL;
            let sideDistX = (nextBoundaryX - Game.camX) / rayDirX;
            let sideDistZ = (nextBoundaryZ - Game.camZ) / rayDirZ;
            const deltaDistX = Math.abs(CELL / rayDirX);
            const deltaDistZ = Math.abs(CELL / rayDirZ);

            const maxDist = 200;
            let dist = 0, hitWall = false, hitGlobalX = 0, side = 0;

            for (let i = 0; i < 4000; i++) {
                if (sideDistX < sideDistZ) {
                    mapX += stepX; dist = sideDistX; sideDistX += deltaDistX;
                    if (Game.solidMap[mapZ*MAP_S+mapX] === 1) { hitWall = true; side = 0; hitGlobalX = Game.camZ + dist * rayDirZ; break; }
                } else {
                    mapZ += stepZ; dist = sideDistZ; sideDistZ += deltaDistZ;
                    if (Game.solidMap[mapZ*MAP_S+mapX] === 1) { hitWall = true; side = 1; hitGlobalX = Game.camX + dist * rayDirX; break; }
                }
                if (mapX<0 || mapX>=MAP_S || mapZ<0 || mapZ>=MAP_S) break;
                if (dist > maxDist) break;
            }

            this.zBuffer[sx] = hitWall ? dist : 1e6;

            let ceilScreenY, floorScreenY;
            if (hitWall) {
                ceilScreenY = horizonBase - Game.config.SCALE * (Game.config.TUNNEL_CEIL - Game.camY) / (dist * cosPitch);
                floorScreenY = horizonBase - Game.config.SCALE * (Game.config.TUNNEL_FLOOR - Game.camY) / (dist * cosPitch);
            } else {
                ceilScreenY = horizonBase - 1;
                floorScreenY = horizonBase + 1;
            }

            const ceilEnd = Math.max(0, Math.floor(ceilScreenY));
            const floorStart = Math.min(this.renderHeight - 1, Math.floor(floorScreenY));

            const texData = (side === 0) ? this.wallTextureEW : this.wallTextureNS;
            const texWidth = TEX_S;

            let fogFactor = 0;
            if (hitWall) {
                fogFactor = (dist - Game.config.FOG_MIN_DIST) / (Game.config.FOG_MAX_DIST - Game.config.FOG_MIN_DIST);
                fogFactor = Math.max(0, Math.min(1, fogFactor));
            }

            for (let y = 0; y < this.renderHeight; y++) {
                const pixelIdx = y * this.renderWidth + sx;
                if (y <= ceilEnd) data[pixelIdx] = ceilColor;
                else if (y >= floorStart) data[pixelIdx] = floorColor;
                else if (hitWall) {
                    const texY = Math.floor((y - ceilEnd) / (floorStart - ceilEnd) * TEX_S) % TEX_S;
                    const texX = Math.floor((hitGlobalX / TEX_SC) * TEX_S) % TEX_S;
                    const texIdx = (texY * texWidth + texX) * 4;
                    const r = texData.data[texIdx], g = texData.data[texIdx+1], b = texData.data[texIdx+2];
                    const finalR = Math.floor(r * (1 - fogFactor));
                    const finalG = Math.floor(g * (1 - fogFactor));
                    const finalB = Math.floor(b * (1 - fogFactor));
                    data[pixelIdx] = (255<<24) | (finalB<<16) | (finalG<<8) | finalR;
                } else data[pixelIdx] = ceilColor;
            }
        }

        this.offscreenCtx.putImageData(imageData, 0, 0);

        // Escalar el canvas interno al tamaño real
        this.ctx.save();
        this.ctx.translate(shakeX, shakeY);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.renderWidth, this.renderHeight, 0, 0, this.width, this.height);
        this.ctx.restore();
    },

    // Proyectar un sprite en pantalla (devuelve coordenadas o null si está fuera de vista)
    projectSprite(wx, wz, spriteHeight) {
        const dx = wx - Game.camX, dz = wz - Game.camZ;
        const dist = Math.sqrt(dx*dx + dz*dz);
        const spriteAngle = Math.atan2(dz, dx);
        let angleDiff = spriteAngle - Game.angle;
        while (angleDiff > Math.PI) angleDiff -= 2*Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2*Math.PI;
        if (Math.abs(angleDiff) > Game.config.FOV/2 + 0.1) return null;

        // Usamos el ancho/alto renderizado para la proyección
        const screenX = this.renderWidth/2 + Math.tan(angleDiff) * (this.renderWidth/2) / Math.tan(Game.config.FOV/2);
        const tanPitch = Math.tan(Game.pitch);
        const cosPitch = Math.cos(Game.pitch);
        const horizonBase = (this.renderHeight / 2) - Game.config.SCALE * tanPitch;
        const floorScreenY = horizonBase - Game.config.SCALE * (Game.config.TUNNEL_FLOOR - Game.camY) / (dist * cosPitch);
        const heightOnScreen = Game.config.SCALE * spriteHeight / (dist * cosPitch);

        // Convertimos las coordenadas del canvas interno al canvas real
        return {
            screenX: (screenX / this.renderWidth) * this.width,
            height: (heightOnScreen / this.renderHeight) * this.height,
            dist,
            floorY: (floorScreenY / this.renderHeight) * this.height
        };
    }
};