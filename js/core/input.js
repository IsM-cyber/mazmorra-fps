// ==============================================
// MÓDULO DE ENTRADA (TECLADO Y RATÓN) – CON RECARGA Y REGENERACIÓN
// ==============================================
const Input = {
    keys: {},
    canvas: null,
    regenerate: false,

    init(canvas) {
        this.canvas = canvas;

        window.addEventListener('keydown', e => {
            this.keys[e.key.toLowerCase()] = true;

            if (e.key.toLowerCase() === 'r') {
                Player.startReload();
                e.preventDefault();
            }

            if (e.key.toLowerCase() === 'n') {
                this.regenerate = true;
                e.preventDefault();
            }

            if (e.key.toLowerCase() === 'm') {
                Game.showFullMap = !Game.showFullMap;
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', e => {
            this.keys[e.key.toLowerCase()] = false;
            e.preventDefault();
        });

        canvas.addEventListener('click', () => canvas.requestPointerLock());
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === canvas) {
                document.addEventListener('mousemove', this.onMouseMove);
                document.addEventListener('mousedown', this.onMouseDown);
            } else {
                document.removeEventListener('mousemove', this.onMouseMove);
                document.removeEventListener('mousedown', this.onMouseDown);
            }
        });
    },

    onMouseMove(e) {
        const sensitivity = 0.002;
        Game.angle += e.movementX * sensitivity;
        Game.pitch += e.movementY * sensitivity;
        Game.pitch = Math.max(-0.8, Math.min(0.8, Game.pitch));
    },

    onMouseDown(e) {
        if (e.button === 0) Player.shoot();
    },

    isDown(key) {
        return !!this.keys[key.toLowerCase()];
    }
};