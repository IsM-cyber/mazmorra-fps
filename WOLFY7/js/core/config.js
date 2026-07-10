// ==============================================
// CONFIGURACIÓN CENTRAL DEL MOTOR WOLFENSTEIN 3D
// ==============================================
const CONFIG = {
    MAP_SIZE: 512,
    CELL_SIZE: 0.5,

    PLAYER_RADIUS: 0.2,
    PLAYER_HEIGHT: 2.2,
    EYE_HEIGHT: 2.0,            // ← vuelve a la altura original

    TUNNEL_FLOOR: 2,
    TUNNEL_CEIL: 14,
    ENEMY_HEIGHT: 2.0,

    COLOR_WALL_NS: [20, 40, 100],
    COLOR_WALL_EW: [60, 100, 200],
    COLOR_FLOOR: [120, 120, 120],
    COLOR_CEIL: [180, 180, 180],

    TEX_SIZE: 256,
    TEX_SCALE: 2.5,

    FOG_MIN_DIST: 10,
    FOG_MAX_DIST: 150,

    FOV: Math.PI / 4,
    SCALE: 200,
    RENDER_SCALE: 0.5,

    GRAVITY: 30,
    JUMP_SPEED: 12,

    ROT_SPEED: 0.03,
    MOVE_SPEED: 6,
    STRAFE_SPEED: 0.75,

    STEP_THRESHOLD_FWD: 3.0,
    STEP_THRESHOLD_LAT: 0.75,

    HIT_MARKER_DURATION: 0.1,
    GUN_RECOIL: 6,
    GUN_RECOIL_TIME: 0.08,

    SHOT_SOUND_DISPLAY_DURATION: 0.5,
    SHOT_SOUND_RADIUS: 30,

    MAX_PARTICLES: 800,
    MAX_ENEMIES: 100,

    MINIMAP_SIZE: 120,
    MINIMAP_RANGE: 40,
    MINIMAP_POS_X: 10,
    MINIMAP_POS_Y: 10,
};