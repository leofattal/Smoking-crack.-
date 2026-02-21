// === TILE & LAYOUT ===
export const TILE_SIZE = 32;
export const HUD_HEIGHT = 52;
export const MAZE_COLS = 21;
export const MAZE_ROWS = 21;
export const CANVAS_WIDTH = MAZE_COLS * TILE_SIZE;
export const CANVAS_HEIGHT = MAZE_ROWS * TILE_SIZE + HUD_HEIGHT;

// === TILE TYPES ===
export const WALL = 0;
export const PATH = 1;
export const CUSTOMER_SPAWN = 2;
export const BRIBE = 3;
export const TUNNEL = 4;
export const COP_SPAWN = 5;
export const PLAYER_SPAWN = 6;

// === COLORS ===
export const COLORS = {
  background: 0x0e0e1a,
  wall: 0x2a3a6e,
  wallHighlight: 0x4a6aae,
  wallShadow: 0x0c1527,
  player: 0xffd700,
  playerOutline: 0xffa500,
  contrabandWhite: 0xffffff,
  contrabandCyan: 0x00ced1,
  contrabandPink: 0xff69b4,
  contrabandGold: 0xffd700,
  customer: 0x00ff41,
  customerDark: 0x00cc33,
  bribe: 0xffd700,
  copBeat: 0xff0000,
  copPatrol: 0x4169e1,
  copUndercover: 0x00ff41,
  copScared: 0x4444ff,
  heatLow: 0x00ff00,
  heatMid: 0xffaa00,
  heatHigh: 0xff0000,
  hudText: 0xffffff,
  hudBg: 0x0a0a18,
};

// === DIRECTIONS ===
export enum Direction {
  NONE = 'NONE',
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export const DIR_DELTA: Record<Direction, { dx: number; dy: number }> = {
  [Direction.NONE]: { dx: 0, dy: 0 },
  [Direction.UP]: { dx: 0, dy: -1 },
  [Direction.DOWN]: { dx: 0, dy: 1 },
  [Direction.LEFT]: { dx: -1, dy: 0 },
  [Direction.RIGHT]: { dx: 1, dy: 0 },
};

export const OPPOSITE_DIR: Record<Direction, Direction> = {
  [Direction.NONE]: Direction.NONE,
  [Direction.UP]: Direction.DOWN,
  [Direction.DOWN]: Direction.UP,
  [Direction.LEFT]: Direction.RIGHT,
  [Direction.RIGHT]: Direction.LEFT,
};

// === GAME PHASES ===
export enum GamePhase {
  COLLECT = 'COLLECT',   // 15s — run around collecting drugs, no cops
  SELL = 'SELL',         // street vendor phase — sell to customers, cops patrol
}

// === GAMEPLAY ===
export const BASE_PLAYER_SPEED = 130; // pixels per second
export const BASE_COP_SPEED = 95;
export const CRACK_SPEED_MULT = 2.8; // speed multiplier when high on crack
export const CRACK_DURATION = 5000; // ms
export const COLLECT_PHASE_DURATION = 15; // seconds
export const SELL_PHASE_DURATION = 60; // seconds
export const BASE_DETECTION_RANGE = 5; // tiles
export const COP_AI_INTERVAL = 300; // ms between AI decisions

// === HEAT ===
export const HEAT_PER_SALE = 4;
export const HEAT_PASSIVE_RATE = 0.5; // per second during sell phase
export const HEAT_MAX = 100;

// === ECONOMY ===
export interface DrugType {
  name: string;
  emoji: string;
  color: number;
  size: number;
  weight: number; // spawn probability weight
}

export const DRUG_TYPES: DrugType[] = [
  { name: 'crack', emoji: '💎', color: 0xffffff, size: 4, weight: 30 },
  { name: 'weed', emoji: '🌿', color: 0x22cc44, size: 5, weight: 25 },
  { name: 'coke', emoji: '❄️', color: 0xeeeeff, size: 4, weight: 15 },
  { name: 'pills', emoji: '💊', color: 0xff69b4, size: 4, weight: 15 },
  { name: 'lean', emoji: '🟣', color: 0x9b59b6, size: 5, weight: 10 },
  { name: 'shrooms', emoji: '🍄', color: 0xcc8844, size: 5, weight: 5 },
];

export const CONTRABAND_VALUES = {
  baggie: 10,
  vial: 20,
  pill: 15,
  package: 50,
};

export const BASE_CUSTOMERS = 6;

// === CRACK HIGH VOICE LINES ===
export const CRACK_VOICE_LINES = [
  'Damn, this stuff hits hard',
  'Yes! More power! More gas!',
  'I am speed!',
  'Can\'t nobody stop me now!',
  'Oh yeah, that\'s the good stuff',
];

// === COP KNOCKOUT LINES ===
export const COP_KNOCKOUT_LINES = [
  'Bruh, damn you\'re strong.',
  'I regret that.',
  'What the hell!?',
  'He\'s too fast!',
  'I need backup!',
  'My badge!!',
  'Officer down! Officer down!',
  'You\'re gonna pay for this!',
];

// === COP CHASE LINES ===
export const COP_CHASE_LINES = [
  'Come here, druglord!',
  'Stop right there!',
  'You\'re under arrest!',
  'I see you! Don\'t move!',
  'Freeze, punk!',
];

// === COP TYPES ===
export enum CopType {
  BEAT = 'BEAT',
  PATROL = 'PATROL',
  UNDERCOVER = 'UNDERCOVER',
}

export enum CopState {
  IN_HOUSE = 'IN_HOUSE',
  PATROL = 'PATROL',
  CHASE = 'CHASE',
  SCARED = 'SCARED',
}

// === SKINS ===
export interface SkinDef {
  id: string;
  name: string;
  color: number;
  cost: number;
  glow?: boolean;
  rainbow?: boolean;
  trail?: number;
}

export const SKINS: SkinDef[] = [
  { id: 'default', name: 'Classic Yellow', color: 0xffd700, cost: 0 },
  { id: 'og_purple', name: 'OG Purple', color: 0x9b59b6, cost: 200, trail: 0x7b39a6 },
  { id: 'neon_green', name: 'Neon Green', color: 0x00ff41, cost: 300, glow: true },
  { id: 'ice_blue', name: 'Ice Blue', color: 0x00bfff, cost: 350, trail: 0x0088cc },
  { id: 'blood_red', name: 'Blood Red', color: 0xff2222, cost: 400 },
  { id: 'gold_plated', name: 'Gold Plated', color: 0xffaa00, cost: 600, glow: true },
  { id: 'ghost_white', name: 'Ghost White', color: 0xeeeeff, cost: 500, trail: 0xaaaacc },
  { id: 'rainbow', name: 'Rainbow', color: 0xffffff, cost: 1000, rainbow: true },
];

// === GUNS ===
export interface GunDef {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  /** Time window in ms the player has to click during the DRAW phase */
  drawWindow: number;
  /** Chance to win the shootout if player clicks in time (0-1) */
  accuracy: number;
  description: string;
}

export const GUNS: GunDef[] = [
  { id: 'fists', name: 'Bare Fists', emoji: '👊', cost: 0, drawWindow: 400, accuracy: 0.25, description: 'Better than nothing' },
  { id: 'knife', name: 'Switchblade', emoji: '🔪', cost: 75, drawWindow: 450, accuracy: 0.3, description: 'Quick but risky' },
  { id: 'pistol', name: '9mm Pistol', emoji: '🔫', cost: 150, drawWindow: 600, accuracy: 0.5, description: 'Standard street piece' },
  { id: 'revolver', name: '.44 Magnum', emoji: '💢', cost: 275, drawWindow: 550, accuracy: 0.6, description: 'Big iron on his hip' },
  { id: 'shotgun', name: 'Sawed-Off', emoji: '💥', cost: 400, drawWindow: 800, accuracy: 0.7, description: 'Spread makes it easier' },
  { id: 'mac10', name: 'MAC-10', emoji: '🔥', cost: 550, drawWindow: 900, accuracy: 0.75, description: 'Compact & deadly' },
  { id: 'uzi', name: 'Uzi', emoji: '⚡', cost: 700, drawWindow: 1000, accuracy: 0.85, description: 'Spray and pray' },
  { id: 'ak47', name: 'AK-47', emoji: '☠️', cost: 1000, drawWindow: 1100, accuracy: 0.9, description: 'Street legend' },
  { id: 'rpg', name: 'RPG', emoji: '🚀', cost: 1500, drawWindow: 1300, accuracy: 0.95, description: 'Overkill. Period.' },
  { id: 'minigun', name: 'Minigun', emoji: '🌀', cost: 2500, drawWindow: 1500, accuracy: 0.99, description: 'You ARE the army' },
];

// === SHOOTOUT LINES ===
export const SHOOTOUT_WIN_LINES = [
  'Not today, pig!',
  'You picked the wrong one!',
  'Tell your boys I said hi!',
  'Bang bang!',
  'Too slow, officer!',
];

export const SHOOTOUT_LOSE_LINES = [
  'Drop the weapon!',
  'Got you now, punk!',
  'End of the line!',
  'Should\'ve stayed home!',
];

// === POWER-UPS ===
export enum PowerUpType {
  SPEED_BOOST = 'SPEED_BOOST',
  COP_BLIND = 'COP_BLIND',
  DOUBLE_CASH = 'DOUBLE_CASH',
  MAGNET = 'MAGNET',
}

export interface PowerUpDef {
  type: PowerUpType;
  name: string;
  emoji: string;
  color: number;
  duration: number; // ms
  description: string;
}

export const POWER_UPS: PowerUpDef[] = [
  { type: PowerUpType.SPEED_BOOST, name: 'Speed Boost', emoji: '⚡', color: 0xffff00, duration: 6000, description: '1.5x speed' },
  { type: PowerUpType.COP_BLIND, name: 'Cop Blind', emoji: '🕶️', color: 0x4444ff, duration: 8000, description: 'Cops can\'t see you' },
  { type: PowerUpType.DOUBLE_CASH, name: 'Double Cash', emoji: '💰', color: 0x00ff00, duration: 10000, description: '2x sale earnings' },
  { type: PowerUpType.MAGNET, name: 'Magnet', emoji: '🧲', color: 0xff4444, duration: 7000, description: 'Auto-collect nearby items' },
];

// === GAME STATE ===
export interface GameState {
  day: number;
  cash: number;
  lives: number;
  totalCashEarned: number;
  upgrades: {
    speedShoes: number;
    streetSmarts: number;
    lookout: boolean;
    betterProduct: number;
    crackTolerance: number;
    getawayCar: boolean;
  };
  advertisingTier: number;
  selectedSkin: string;
  ownedSkins: string[];
  getawayCarUsedToday: boolean;
  currentGun: string;
  ownedGuns: string[];
}

export function createInitialGameState(): GameState {
  return {
    day: 1,
    cash: 0,
    lives: 3,
    totalCashEarned: 0,
    upgrades: {
      speedShoes: 0,
      streetSmarts: 0,
      lookout: false,
      betterProduct: 0,
      crackTolerance: 0,
      getawayCar: false,
    },
    advertisingTier: 0,
    selectedSkin: 'default',
    ownedSkins: ['default'],
    getawayCarUsedToday: false,
    currentGun: 'fists',
    ownedGuns: ['fists'],
  };
}
