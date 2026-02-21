import Phaser from 'phaser';
import {
  TILE_SIZE, HUD_HEIGHT, MAZE_COLS, MAZE_ROWS, CANVAS_WIDTH, CANVAS_HEIGHT,
  COLORS, Direction, DIR_DELTA, OPPOSITE_DIR,
  GamePhase,
  BASE_PLAYER_SPEED, BASE_COP_SPEED, CRACK_SPEED_MULT, CRACK_DURATION,
  COLLECT_PHASE_DURATION, SELL_PHASE_DURATION,
  BASE_DETECTION_RANGE, COP_AI_INTERVAL,
  HEAT_PER_SALE, HEAT_PASSIVE_RATE, HEAT_MAX,
  DRUG_TYPES, DrugType, BASE_CUSTOMERS,
  CRACK_VOICE_LINES, COP_KNOCKOUT_LINES, COP_CHASE_LINES,
  CopType, CopState,
  WALL, COP_SPAWN,
  GameState, SKINS,
  PowerUpType, POWER_UPS, PowerUpDef,
} from '../config/constants';
import {
  MAZE_DATA, findPlayerSpawn, findCopSpawns, findBribePositions,
  findTunnelPositions, isWalkableTile, getPathTiles, selectMaze, findCopExitTile,
} from '../config/maze';
import {
  getSpeedMultiplier, getDetectionRange,
  getSaleMultiplier, getCustomerCount, getCrackDuration,
} from '../config/upgrades';

// ==================== ENTITY TYPES ====================
interface GridEntity {
  container: Phaser.GameObjects.Container;
  gridX: number;
  gridY: number;
  targetGridX: number;
  targetGridY: number;
  direction: Direction;
  speed: number;
  isMoving: boolean;
}

interface PlayerEntity extends GridEntity {
  queuedDirection: Direction;
  inventory: number;
  crackStash: number;
  isHighOnCrack: boolean;
  crackTimer: number;
  baseSpeed: number;
  skinColor: number;
  skinRainbow: boolean;
  skinGlow: boolean;
  skinTrail: number | null;
}

interface CopEntity extends GridEntity {
  type: CopType;
  state: CopState;
  aiTimer: number;
  detectionRange: number;
  homeX: number;
  homeY: number;
  exitTimer: number;
  graphics: Phaser.GameObjects.Graphics;
  chaseLineSaid: boolean;
}

interface ContrabandDot {
  sprite: Phaser.GameObjects.Container;
  gridX: number;
  gridY: number;
  value: number;
  collected: boolean;
  drugType: DrugType;
}

interface CustomerNPC {
  container: Phaser.GameObjects.Container;
  gridX: number;
  gridY: number;
  active: boolean;
}

interface CrackPickup {
  sprite: Phaser.GameObjects.Arc;
  gridX: number;
  gridY: number;
  collected: boolean;
}

interface PowerUpPickup {
  container: Phaser.GameObjects.Container;
  gridX: number;
  gridY: number;
  collected: boolean;
  def: PowerUpDef;
}

interface ActivePowerUp {
  type: PowerUpType;
  timer: number;
  def: PowerUpDef;
}

export class GameScene extends Phaser.Scene {
  // Entities
  private player!: PlayerEntity;
  private cops: CopEntity[] = [];
  private customers: CustomerNPC[] = [];
  private contraband: ContrabandDot[] = [];
  private crackPickups: CrackPickup[] = [];
  private powerUpPickups: PowerUpPickup[] = [];
  private activePowerUps: ActivePowerUp[] = [];

  // State
  private gameState!: GameState;
  private phase: GamePhase = GamePhase.COLLECT;
  private heat: number = 0;
  private phaseTimer: number = COLLECT_PHASE_DURATION;
  private dayActive: boolean = true;
  private transitioning: boolean = false;

  // Visual effects for crack high
  private crackOverlay!: Phaser.GameObjects.Rectangle;
  private crackTrails: Phaser.GameObjects.Arc[] = [];
  private screenTintTimer: number = 0;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private touchDirection: Direction = Direction.NONE;
  private isTouchDevice: boolean = false;

  // HUD
  private phaseText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private dayText!: Phaser.GameObjects.Text;
  private cashText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private crackText!: Phaser.GameObjects.Text;
  private heatBarBg!: Phaser.GameObjects.Rectangle;
  private heatBarFill!: Phaser.GameObjects.Rectangle;
  private powerUpText!: Phaser.GameObjects.Text;
  private currentMapName: string = '';

  // Phase banner
  private phaseBanner!: Phaser.GameObjects.Container;

  // Tunnels
  private tunnelPositions: { x: number; y: number }[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.gameState = this.registry.get('gameState') as GameState;
    this.gameState.getawayCarUsedToday = false; // reset each day
    this.phase = GamePhase.COLLECT;
    this.heat = 0;
    this.phaseTimer = COLLECT_PHASE_DURATION;
    this.dayActive = true;
    this.transitioning = false;
    this.cops = [];
    this.customers = [];
    this.contraband = [];
    this.crackPickups = [];
    this.crackTrails = [];
    this.powerUpPickups = [];
    this.activePowerUps = [];

    // Select maze based on the current day
    this.currentMapName = selectMaze(this.gameState.day);

    this.tunnelPositions = findTunnelPositions();

    this.createMaze();
    this.createContraband();
    this.createPlayer();
    this.createCops();       // created but hidden during collect phase
    this.createCrackPickups(); // hidden during collect phase
    this.createPowerUps();
    this.createHUD();
    this.setupInput();

    // Crack high overlay (hidden by default)
    this.crackOverlay = this.add.rectangle(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2,
      CANVAS_WIDTH, CANVAS_HEIGHT,
      0xff00ff, 0,
    ).setDepth(50);

    // Phase banner container
    this.phaseBanner = this.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2).setDepth(90);

    // Player moves faster during collection phase (like pac-man gobbling)
    this.player.speed = this.player.baseSpeed * 1.4;

    // Start with collection phase announcement showing the map name
    this.showPhaseBanner(`📍 ${this.currentMapName.toUpperCase()}`, '15 seconds - grab everything!', '#FFD700');

    this.cameras.main.flash(300, 0, 0, 0);
  }

  // ==================== PHASE MANAGEMENT ====================
  private startSellPhase(): void {
    this.phase = GamePhase.SELL;
    this.phaseTimer = SELL_PHASE_DURATION;

    // Return player to normal speed for sell phase
    this.player.speed = this.player.baseSpeed;

    // Hide any remaining uncollected contraband
    for (const item of this.contraband) {
      if (!item.collected) item.sprite.setVisible(false);
    }

    // Spawn customers now
    this.createCustomers();

    // Activate cops — let them exit the ghost house
    for (const cop of this.cops) {
      cop.container.setVisible(false); // still hidden in house
    }

    // Show crack pickups
    for (const crack of this.crackPickups) {
      crack.sprite.setVisible(true);
    }

    this.showPhaseBanner('TIME TO SELL!', 'Watch out for cops! SPACE = smoke crack', '#FF6B35');
    this.cameras.main.flash(400, 255, 100, 0);
  }

  private showPhaseBanner(title: string, subtitle: string, color: string): void {
    this.phaseBanner.removeAll(true);

    const bg = this.add.rectangle(0, 0, CANVAS_WIDTH - 60, 80, 0x000000, 0.85)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color).color);
    this.phaseBanner.add(bg);

    const titleText = this.add.text(0, -15, title, {
      fontSize: '28px',
      fontFamily: 'monospace',
      color,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.phaseBanner.add(titleText);

    const subText = this.add.text(0, 18, subtitle, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#CCCCCC',
    }).setOrigin(0.5);
    this.phaseBanner.add(subText);

    this.phaseBanner.setAlpha(1);
    this.tweens.add({
      targets: this.phaseBanner,
      alpha: 0,
      delay: 2000,
      duration: 500,
    });
  }

  // ==================== MAZE ====================
  private isWall(col: number, row: number): boolean {
    if (row < 0 || row >= MAZE_ROWS || col < 0 || col >= MAZE_COLS) return true;
    return MAZE_DATA[row][col] === WALL;
  }

  private createMaze(): void {
    const gfx = this.add.graphics();
    const D = 8; // 3D extrusion depth
    const TS = TILE_SIZE;

    // === FLOOR LAYER ===
    for (let row = 0; row < MAZE_ROWS; row++) {
      for (let col = 0; col < MAZE_COLS; col++) {
        const tile = MAZE_DATA[row][col];
        const px = col * TS;
        const py = row * TS + HUD_HEIGHT;

        if (tile !== WALL) {
          // Asphalt base
          gfx.fillStyle(0x141424);
          gfx.fillRect(px, py, TS, TS);

          // Road texture variation
          const v = ((col * 7 + row * 13) % 5);
          if (v === 0) {
            gfx.fillStyle(0x181830, 0.6);
            gfx.fillRect(px, py, TS, TS);
          }

          // Sidewalk crack lines
          gfx.fillStyle(0x222244, 0.25);
          gfx.fillRect(px, py, TS, 1);
          gfx.fillRect(px, py, 1, TS);

          // Random road markings / stains for realism
          if ((col * 3 + row * 7) % 17 === 0) {
            gfx.fillStyle(0x333344, 0.3);
            gfx.fillCircle(px + TS / 2, py + TS / 2, 3);
          }
        }
      }
    }

    // === 3D WALL SHADOWS (drawn first, behind walls) ===
    for (let row = 0; row < MAZE_ROWS; row++) {
      for (let col = 0; col < MAZE_COLS; col++) {
        if (!this.isWall(col, row)) continue;
        const px = col * TS;
        const py = row * TS + HUD_HEIGHT;

        // Bottom face (dark shadow)
        if (!this.isWall(col, row + 1)) {
          // Multi-layer gradient shadow
          for (let i = 0; i < D; i++) {
            const a = 0.5 - (i / D) * 0.3;
            gfx.fillStyle(0x050a15, a);
            gfx.fillRect(px, py + TS + i, TS, 1);
          }
        }

        // Right face (slightly lighter shadow)
        if (!this.isWall(col + 1, row)) {
          for (let i = 0; i < D; i++) {
            const a = 0.4 - (i / D) * 0.25;
            gfx.fillStyle(0x0a1020, a);
            gfx.fillRect(px + TS + i, py, 1, TS);
          }
        }

        // Corner shadow
        if (!this.isWall(col + 1, row) && !this.isWall(col, row + 1)) {
          gfx.fillStyle(0x000000, 0.4);
          gfx.fillRect(px + TS, py + TS, D, D);
        }
      }
    }

    // === 3D WALL TOP FACES ===
    for (let row = 0; row < MAZE_ROWS; row++) {
      for (let col = 0; col < MAZE_COLS; col++) {
        if (!this.isWall(col, row)) continue;
        const px = col * TS;
        const py = row * TS + HUD_HEIGHT;

        // Main wall face
        gfx.fillStyle(0x2a3a6e);
        gfx.fillRect(px, py, TS, TS);

        // Brick pattern
        const brickH = 8;
        const brickW = 14;
        const offsetRow = row % 2 === 0 ? 0 : brickW / 2;
        // Horizontal mortar lines
        for (let by = 0; by < TS; by += brickH) {
          gfx.fillStyle(0x1e2e58, 0.6);
          gfx.fillRect(px, py + by, TS, 1);
        }
        // Vertical mortar lines (offset every other row of bricks)
        for (let bx = -brickW + offsetRow; bx < TS; bx += brickW) {
          const drawRow = Math.floor((py - HUD_HEIGHT) / TS);
          for (let by = 0; by < TS; by += brickH) {
            const brickRow = Math.floor(by / brickH);
            const off = brickRow % 2 === 0 ? 0 : brickW / 2;
            gfx.fillStyle(0x1e2e58, 0.5);
            gfx.fillRect(px + bx + off, py + by, 1, brickH);
          }
        }

        // Inner bevel - slightly darker center
        gfx.fillStyle(0x243264, 0.4);
        gfx.fillRect(px + 3, py + 3, TS - 6, TS - 6);

        // Top edge bright highlight (light from above-left)
        if (!this.isWall(col, row - 1)) {
          gfx.fillStyle(0x5a7abe, 0.7);
          gfx.fillRect(px, py, TS, 3);
          gfx.fillStyle(0x7a9ade, 0.3);
          gfx.fillRect(px, py, TS, 1);
        }

        // Left edge highlight
        if (!this.isWall(col - 1, row)) {
          gfx.fillStyle(0x4a6aae, 0.5);
          gfx.fillRect(px, py, 3, TS);
        }

        // Bottom edge dark (no light hits the bottom)
        if (!this.isWall(col, row + 1)) {
          gfx.fillStyle(0x0a1428, 0.7);
          gfx.fillRect(px, py + TS - 2, TS, 2);
        }

        // Right edge dark
        if (!this.isWall(col + 1, row)) {
          gfx.fillStyle(0x0e1830, 0.5);
          gfx.fillRect(px + TS - 2, py, 2, TS);
        }
      }
    }

    // === AMBIENT OCCLUSION on floor near walls ===
    for (let row = 0; row < MAZE_ROWS; row++) {
      for (let col = 0; col < MAZE_COLS; col++) {
        if (this.isWall(col, row)) continue;
        const px = col * TS;
        const py = row * TS + HUD_HEIGHT;

        // Shadow from wall above (strongest)
        if (this.isWall(col, row - 1)) {
          for (let i = 0; i < 6; i++) {
            gfx.fillStyle(0x000000, 0.25 - i * 0.04);
            gfx.fillRect(px, py + i, TS, 1);
          }
        }
        // Shadow from wall to the left
        if (this.isWall(col - 1, row)) {
          for (let i = 0; i < 5; i++) {
            gfx.fillStyle(0x000000, 0.18 - i * 0.03);
            gfx.fillRect(px + i, py, 1, TS);
          }
        }
        // Corner darkening (wall above AND to the left)
        if (this.isWall(col - 1, row) && this.isWall(col, row - 1)) {
          gfx.fillStyle(0x000000, 0.3);
          gfx.fillRect(px, py, 4, 4);
        }
      }
    }
  }

  // ==================== CONTRABAND ====================
  private pickWeightedDrug(): DrugType {
    const totalWeight = DRUG_TYPES.reduce((sum, d) => sum + d.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const drug of DRUG_TYPES) {
      roll -= drug.weight;
      if (roll <= 0) return drug;
    }
    return DRUG_TYPES[0];
  }

  private createContraband(): void {
    const pathTiles = getPathTiles();

    // Only place drugs on ~50% of path tiles so 15s is enough to grab a good haul
    const shuffled = Phaser.Utils.Array.Shuffle([...pathTiles]);
    const count = Math.floor(shuffled.length * 0.5);

    for (let i = 0; i < count; i++) {
      const tile = shuffled[i];
      const drug = this.pickWeightedDrug();

      const px = this.tileToPixelX(tile.x);
      const py = this.tileToPixelY(tile.y);

      const container = this.add.container(px, py);

      // Colored dot underneath
      const dot = this.add.circle(0, 0, drug.size, drug.color, 0.8);
      container.add(dot);

      // Drug emoji label on top
      const label = this.add.text(0, 0, drug.emoji, {
        fontSize: '12px',
      }).setOrigin(0.5);
      container.add(label);

      this.contraband.push({
        sprite: container, gridX: tile.x, gridY: tile.y,
        value: 1, collected: false, drugType: drug,
      });
    }
  }

  // ==================== CRACK PICKUPS ====================
  private createCrackPickups(): void {
    const positions = findBribePositions();
    for (const pos of positions) {
      const px = this.tileToPixelX(pos.x);
      const py = this.tileToPixelY(pos.y);

      // Jagged crack rock shape using graphics
      const rockGfx = this.add.graphics();
      rockGfx.fillStyle(0xeeeedd);
      rockGfx.fillCircle(0, 0, 6);
      rockGfx.fillCircle(-3, -2, 4);
      rockGfx.fillCircle(3, -1, 4);
      rockGfx.fillCircle(1, 3, 3);
      // Highlight
      rockGfx.fillStyle(0xffffff, 0.7);
      rockGfx.fillCircle(-1, -2, 3);

      const container = this.add.container(px, py);
      container.add(rockGfx);

      // Glow ring
      const glow = this.add.circle(0, 0, 10, 0xffffff, 0.15);
      container.add(glow);

      container.setVisible(false); // hidden during collect phase

      this.tweens.add({
        targets: glow,
        scaleX: 1.4, scaleY: 1.4, alpha: 0.05,
        duration: 500, yoyo: true, repeat: -1,
      });

      this.crackPickups.push({
        sprite: container as unknown as Phaser.GameObjects.Arc,
        gridX: pos.x, gridY: pos.y, collected: false,
      });
    }
  }

  // ==================== POWER-UPS ====================
  private createPowerUps(): void {
    const pathTiles = getPathTiles();
    const shuffled = Phaser.Utils.Array.Shuffle([...pathTiles]);
    const playerSpawn = findPlayerSpawn();
    const count = 4 + Math.floor(Math.random() * 3); // 4-6 power-ups per map

    let placed = 0;
    for (const tile of shuffled) {
      if (placed >= count) break;
      // Don't place near spawn
      if (Math.abs(tile.x - playerSpawn.x) + Math.abs(tile.y - playerSpawn.y) < 3) continue;

      const def = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];
      const px = this.tileToPixelX(tile.x);
      const py = this.tileToPixelY(tile.y);

      const container = this.add.container(px, py);

      // Glowing base circle
      const glow = this.add.circle(0, 0, 12, def.color, 0.15);
      container.add(glow);

      // Colored ring
      const ring = this.add.graphics();
      ring.lineStyle(2, def.color, 0.7);
      ring.strokeCircle(0, 0, 10);
      container.add(ring);

      // Emoji icon
      const icon = this.add.text(0, 0, def.emoji, {
        fontSize: '14px',
      }).setOrigin(0.5);
      container.add(icon);

      // Pulse animation
      this.tweens.add({
        targets: glow,
        scaleX: 1.3, scaleY: 1.3, alpha: 0.05,
        duration: 600, yoyo: true, repeat: -1,
      });

      // Bob animation
      this.tweens.add({
        targets: container,
        y: py - 3,
        duration: 800 + Math.random() * 400,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });

      this.powerUpPickups.push({
        container, gridX: tile.x, gridY: tile.y,
        collected: false, def,
      });
      placed++;
    }
  }

  private checkPowerUpCollection(): void {
    for (const pu of this.powerUpPickups) {
      if (pu.collected) continue;

      // Magnet effect: auto-collect within 2 tiles
      const magnetActive = this.activePowerUps.some(a => a.type === PowerUpType.MAGNET);
      const dist = Math.abs(pu.gridX - this.player.gridX) + Math.abs(pu.gridY - this.player.gridY);
      const inRange = magnetActive ? dist <= 2 : dist === 0;

      if (inRange) {
        pu.collected = true;
        pu.container.setVisible(false);
        this.activatePowerUp(pu.def);
      }
    }
  }

  private activatePowerUp(def: PowerUpDef): void {
    // Check if already active — refresh timer
    const existing = this.activePowerUps.find(a => a.type === def.type);
    if (existing) {
      existing.timer = def.duration;
      return;
    }

    this.activePowerUps.push({ type: def.type, timer: def.duration, def });

    // Apply immediate effects
    if (def.type === PowerUpType.SPEED_BOOST && !this.player.isHighOnCrack) {
      this.player.speed = this.player.baseSpeed * 1.5;
    }

    // Visual feedback
    this.cameras.main.flash(200,
      (def.color >> 16) & 0xff,
      (def.color >> 8) & 0xff,
      def.color & 0xff,
    );

    // Show pickup text
    const txt = this.add.text(
      this.player.container.x, this.player.container.y - 30,
      `${def.emoji} ${def.name.toUpperCase()}!`, {
        fontSize: '16px', fontFamily: 'monospace', color: `#${def.color.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      },
    ).setOrigin(0.5).setDepth(85);
    this.tweens.add({
      targets: txt, y: txt.y - 35, alpha: 0, scaleX: 1.2, scaleY: 1.2,
      duration: 1000, onComplete: () => txt.destroy(),
    });
  }

  private updatePowerUps(delta: number): void {
    for (let i = this.activePowerUps.length - 1; i >= 0; i--) {
      const pu = this.activePowerUps[i];
      pu.timer -= delta;

      if (pu.timer <= 0) {
        // Deactivate
        this.activePowerUps.splice(i, 1);

        if (pu.type === PowerUpType.SPEED_BOOST && !this.player.isHighOnCrack) {
          this.player.speed = this.player.baseSpeed;
        }

        // Show expiry text
        const txt = this.add.text(
          CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60,
          `${pu.def.emoji} ${pu.def.name} wore off`, {
            fontSize: '12px', fontFamily: 'monospace', color: '#888888', fontStyle: 'italic',
          },
        ).setOrigin(0.5).setDepth(85);
        this.tweens.add({
          targets: txt, alpha: 0, duration: 1000,
          onComplete: () => txt.destroy(),
        });
      }
    }

    // Magnet effect: pull nearby contraband during collect phase
    if (this.hasPowerUp(PowerUpType.MAGNET) && this.phase === GamePhase.COLLECT) {
      for (const item of this.contraband) {
        if (item.collected) continue;
        const dist = Math.abs(item.gridX - this.player.gridX) + Math.abs(item.gridY - this.player.gridY);
        if (dist <= 2 && dist > 0) {
          // Visually pull item toward player
          const dx = this.player.container.x - item.sprite.x;
          const dy = this.player.container.y - item.sprite.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 2) {
            item.sprite.x += (dx / len) * 2;
            item.sprite.y += (dy / len) * 2;
          }
          // Auto-collect if very close
          if (dist <= 1) {
            item.collected = true;
            item.sprite.setVisible(false);
            this.player.inventory++;
          }
        }
      }
    }
  }

  private hasPowerUp(type: PowerUpType): boolean {
    return this.activePowerUps.some(a => a.type === type);
  }

  // ==================== CUSTOMERS ====================
  private createCustomers(): void {
    const pathTiles = getPathTiles();
    const count = getCustomerCount(BASE_CUSTOMERS, this.gameState.advertisingTier);
    const shuffled = Phaser.Utils.Array.Shuffle([...pathTiles]);
    const playerSpawn = findPlayerSpawn();

    let placed = 0;
    for (const tile of shuffled) {
      if (placed >= count) break;
      if (Math.abs(tile.x - playerSpawn.x) + Math.abs(tile.y - playerSpawn.y) < 4) continue;
      // Don't place on cop spawn area
      if (MAZE_DATA[tile.y][tile.x] === COP_SPAWN) continue;

      const container = this.add.container(
        this.tileToPixelX(tile.x), this.tileToPixelY(tile.y),
      );

      // Draw a little person (customer)
      const custGfx = this.add.graphics();
      // Shadow
      custGfx.fillStyle(0x000000, 0.25);
      custGfx.fillEllipse(1, 14, 14, 5);
      // Body (hoodie - random dark color)
      const hoodieColors = [0x444444, 0x2a4a2a, 0x4a2a2a, 0x2a2a4a, 0x3a3a3a];
      const hc = hoodieColors[Math.floor(Math.random() * hoodieColors.length)];
      custGfx.fillStyle(hc);
      custGfx.fillRect(-6, 0, 12, 10);
      // Head
      custGfx.fillStyle(0xc9a07a);
      custGfx.fillCircle(0, -5, 6);
      // Beanie/cap
      custGfx.fillStyle(hc);
      custGfx.fillRect(-6, -10, 12, 4);
      // Eyes
      custGfx.fillStyle(0xffffff);
      custGfx.fillCircle(-2, -5, 2);
      custGfx.fillCircle(2, -5, 2);
      custGfx.fillStyle(0x000000);
      custGfx.fillCircle(-2, -5, 1);
      custGfx.fillCircle(2, -5, 1);
      // Legs
      custGfx.fillStyle(0x222244);
      custGfx.fillRect(-5, 10, 4, 4);
      custGfx.fillRect(1, 10, 4, 4);
      container.add(custGfx);

      // Floating $ above them
      const dollar = this.add.text(0, -16, '$', {
        fontSize: '12px', fontFamily: 'monospace', color: '#00FF00', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5);
      container.add(dollar);

      this.tweens.add({
        targets: container, y: container.y - 3,
        duration: 1000 + Math.random() * 500,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });

      this.customers.push({ container, gridX: tile.x, gridY: tile.y, active: true });
      placed++;
    }
  }

  // ==================== PLAYER ====================
  private createPlayer(): void {
    const spawn = findPlayerSpawn();
    const container = this.add.container(
      this.tileToPixelX(spawn.x), this.tileToPixelY(spawn.y),
    );

    const speedMult = getSpeedMultiplier(this.gameState.upgrades.speedShoes);
    const baseSpeed = BASE_PLAYER_SPEED * speedMult;

    // Resolve skin
    const skinDef = SKINS.find(s => s.id === this.gameState.selectedSkin) || SKINS[0];

    this.player = {
      container,
      gridX: spawn.x, gridY: spawn.y,
      targetGridX: spawn.x, targetGridY: spawn.y,
      direction: Direction.NONE,
      queuedDirection: Direction.NONE,
      speed: baseSpeed,
      isMoving: false,
      inventory: 0,
      crackStash: 0,
      isHighOnCrack: false,
      crackTimer: 0,
      baseSpeed,
      skinColor: skinDef.color,
      skinRainbow: skinDef.rainbow || false,
      skinGlow: skinDef.glow || false,
      skinTrail: skinDef.trail ?? null,
    };

    const gfx = this.add.graphics();
    this.drawPacMan(gfx, 0, 0, Direction.RIGHT, 35, false);
    container.add(gfx);
  }

  private drawPacMan(gfx: Phaser.GameObjects.Graphics, x: number, y: number, dir: Direction, mouthAngle: number, isHigh: boolean): void {
    gfx.clear();

    const R = 13; // main body radius — nice round Pac-Man

    // Determine color: crack high > rainbow skin > normal skin
    let color = this.player.skinColor;
    if (isHigh) {
      const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff, 0xffff00, 0x00ffff, 0xffffff];
      color = colors[Math.floor(Date.now() / 80) % colors.length];
    } else if (this.player.skinRainbow) {
      const hue = (Date.now() / 15) % 360;
      color = Phaser.Display.Color.HSLToColor(hue / 360, 1, 0.55).color;
    }

    // Glow effect
    if (isHigh) {
      const glowColor = [0xff0000, 0xff00ff, 0x00ffff][Math.floor(Date.now() / 150) % 3];
      gfx.fillStyle(glowColor, 0.2);
      gfx.fillCircle(x, y, R + 8);
    } else if (this.player.skinGlow) {
      const glowAlpha = 0.15 + Math.sin(Date.now() / 300) * 0.1;
      gfx.fillStyle(color, glowAlpha);
      gfx.fillCircle(x, y, R + 8);
    }

    // Direction angles for the Pac-Man mouth
    const facingRight = dir === Direction.RIGHT || dir === Direction.NONE;
    const facingLeft = dir === Direction.LEFT;
    const facingUp = dir === Direction.UP;
    const facingDown = dir === Direction.DOWN;

    let baseAngle = 0; // radians, mouth faces right
    if (facingLeft) baseAngle = Math.PI;
    else if (facingUp) baseAngle = -Math.PI / 2;
    else if (facingDown) baseAngle = Math.PI / 2;

    // Animated mouth opening
    const mouthOpen = (this.player.isMoving || isHigh)
      ? Math.abs(Math.sin(Date.now() / 120)) * 0.65
      : 0.15; // slightly open when idle

    // === DROP SHADOW ===
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillEllipse(x + 1, y + R + 3, R * 1.6, 5);

    // === TINY LEGS (sticking out the bottom of the ball) ===
    const walkCycle = Math.sin(Date.now() / 120) * 2;
    const legSpread = this.player.isMoving ? walkCycle : 0;
    // Jeans
    gfx.fillStyle(0x2244aa);
    gfx.fillRect(x - 5, y + R - 2, 4, 6 + legSpread);
    gfx.fillRect(x + 1, y + R - 2, 4, 6 - legSpread);
    // Jordans (red)
    gfx.fillStyle(0xcc0000);
    gfx.fillRect(x - 6, y + R + 3 + legSpread, 6, 3);
    gfx.fillRect(x, y + R + 3 - legSpread, 6, 3);
    // White soles
    gfx.fillStyle(0xffffff);
    gfx.fillRect(x - 6, y + R + 5 + legSpread, 6, 1);
    gfx.fillRect(x, y + R + 5 - legSpread, 6, 1);

    // === MAIN PAC-MAN BODY (round!) ===
    gfx.fillStyle(color);
    gfx.slice(x, y, R, baseAngle + mouthOpen, baseAngle + Math.PI * 2 - mouthOpen, false);
    gfx.fillPath();

    // 3D highlight on body (top-left light)
    gfx.fillStyle(0xffffff, 0.15);
    gfx.fillCircle(x - 3, y - 4, R * 0.5);

    // === LEATHER JACKET (dark band on lower half of the ball) ===
    const jacketColor = isHigh ? 0x333333 : 0x1a1a1a;
    // Draw jacket as a lower-half arc that wraps the body
    gfx.fillStyle(jacketColor, 0.7);
    gfx.slice(x, y, R, Math.PI * 0.15, Math.PI * 0.85, false);
    gfx.fillPath();
    // Collar on the sides (small rectangles)
    gfx.fillStyle(0x2a2a2a);
    gfx.fillRect(x - R + 1, y - 3, 4, 5);
    gfx.fillRect(x + R - 5, y - 3, 4, 5);
    // Zipper line
    gfx.fillStyle(0xaaaaaa, 0.5);
    gfx.fillRect(x, y + 2, 1, R - 4);

    // === GOLD CHAIN (dangles from the ball) ===
    gfx.fillStyle(0xffd700);
    const chainAngle = baseAngle + Math.PI * 0.7;
    const cx1 = x + Math.cos(chainAngle) * (R - 2);
    const cy1 = y + Math.sin(chainAngle) * (R - 2);
    gfx.fillCircle(cx1, cy1, 1.5);
    gfx.fillCircle(cx1 + 1, cy1 + 2, 1.5);
    gfx.fillCircle(cx1 + 0, cy1 + 4, 2); // pendant

    // === BASEBALL CAP (sits on top) ===
    const capColor = isHigh ? color : 0x880000;
    // Cap crown on top of the ball
    gfx.fillStyle(capColor);
    gfx.fillCircle(x, y - R + 2, R * 0.7);
    gfx.fillRect(x - R * 0.7, y - R - 2, R * 1.4, 5);
    // Cap highlight
    gfx.fillStyle(isHigh ? 0xffffff : 0xaa2222, 0.3);
    gfx.fillCircle(x - 2, y - R, 4);
    // Flat brim (extends in facing direction)
    gfx.fillStyle(0x111111);
    if (facingLeft) {
      gfx.fillRect(x - R - 4, y - R + 1, R, 3);
    } else if (facingUp) {
      gfx.fillRect(x - 5, y - R - 5, 10, 3);
    } else if (facingDown) {
      gfx.fillRect(x - 5, y - R + 5, 10, 3);
    } else {
      gfx.fillRect(x + 4, y - R + 1, R, 3);
    }
    // Cap button
    gfx.fillStyle(capColor);
    gfx.fillCircle(x, y - R - 1, 1.5);

    // === SUNGLASSES ===
    if (!isHigh) {
      // Position glasses on the face
      const ey = y - 2;
      const ex = x;

      gfx.fillStyle(0x111111);
      // Left lens
      gfx.fillRect(ex - 7, ey - 2, 6, 4);
      // Right lens
      gfx.fillRect(ex + 1, ey - 2, 6, 4);
      // Bridge
      gfx.fillRect(ex - 1, ey - 1, 2, 2);
      // Lens shine
      gfx.fillStyle(0x4444ff, 0.3);
      gfx.fillRect(ex - 6, ey - 2, 2, 2);
      gfx.fillRect(ex + 2, ey - 2, 2, 2);
    } else {
      // Crazy spinning eyes when high
      gfx.fillStyle(0xff0000);
      gfx.fillCircle(x - 4, y - 2, 3.5);
      gfx.fillCircle(x + 4, y - 2, 3.5);
      gfx.fillStyle(0xffffff);
      const spin = Date.now() / 80;
      gfx.fillCircle(x - 4 + Math.cos(spin) * 1.5, y - 2 + Math.sin(spin) * 1.5, 1.5);
      gfx.fillCircle(x + 4 + Math.cos(spin + 3) * 1.5, y - 2 + Math.sin(spin + 3) * 1.5, 1.5);
    }

    // === SMOKE EFFECT when high ===
    if (isHigh && Math.random() < 0.5) {
      gfx.fillStyle(0xffffff, 0.15 + Math.random() * 0.15);
      const smokeX = x + (Math.random() - 0.5) * 10;
      const smokeY = y - R - 6 - Math.random() * 8;
      gfx.fillCircle(smokeX, smokeY, 2 + Math.random() * 3);
    }
  }

  // ==================== COPS ====================
  private createCops(): void {
    const spawns = findCopSpawns();
    const copTypes = [CopType.BEAT, CopType.PATROL, CopType.UNDERCOVER];
    const day = this.gameState.day;
    const numCops = Math.min(3, 1 + Math.floor((day - 1) / 3));

    for (let i = 0; i < numCops && i < spawns.length; i++) {
      const spawn = spawns[i];
      const type = copTypes[i % copTypes.length];

      let color = COLORS.copBeat;
      if (type === CopType.PATROL) color = COLORS.copPatrol;
      else if (type === CopType.UNDERCOVER) color = COLORS.copUndercover;

      const container = this.add.container(
        this.tileToPixelX(spawn.x), this.tileToPixelY(spawn.y),
      );
      container.setVisible(false); // hidden during collect phase

      const graphics = this.add.graphics();
      this.drawCop(graphics, 0, 0, color);
      container.add(graphics);

      const detRange = getDetectionRange(BASE_DETECTION_RANGE, this.gameState.upgrades.streetSmarts);
      const speedScale = 1 + (day - 1) * 0.03;

      this.cops.push({
        container,
        gridX: spawn.x, gridY: spawn.y,
        targetGridX: spawn.x, targetGridY: spawn.y,
        direction: Direction.NONE,
        speed: (type === CopType.PATROL ? BASE_COP_SPEED * 1.3 : BASE_COP_SPEED) * speedScale,
        isMoving: false,
        type, state: CopState.IN_HOUSE,
        aiTimer: 0, detectionRange: detRange,
        homeX: spawn.x, homeY: spawn.y,
        exitTimer: i * 3000 + 1500, // stagger exits
        graphics, chaseLineSaid: false,
      });
    }
  }

  private drawCop(gfx: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
    gfx.clear();

    // Drop shadow
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillEllipse(x + 1, y + 16, 18, 6);

    // Legs (dark pants)
    gfx.fillStyle(0x0a0a22);
    gfx.fillRect(x - 6, y + 10, 5, 6);
    gfx.fillRect(x + 1, y + 10, 5, 6);
    // Shoes
    gfx.fillStyle(0x111111);
    gfx.fillRect(x - 7, y + 15, 6, 2);
    gfx.fillRect(x + 1, y + 15, 6, 2);

    // Body (blue uniform torso with 3D shading)
    gfx.fillStyle(0x1a2a6c);
    gfx.fillRect(x - 9, y - 2, 18, 13);
    // Highlight on left chest
    gfx.fillStyle(0x2a3a8c, 0.5);
    gfx.fillRect(x - 8, y - 1, 6, 10);
    // Dark shadow right side
    gfx.fillStyle(0x0a1a4c, 0.5);
    gfx.fillRect(x + 3, y - 1, 5, 10);

    // Belt
    gfx.fillStyle(0x222222);
    gfx.fillRect(x - 9, y + 8, 18, 3);
    gfx.fillStyle(0xcccc00);
    gfx.fillRect(x - 1, y + 8, 3, 3); // buckle

    // Badge on chest (gold star shape)
    gfx.fillStyle(0xffd700);
    gfx.fillCircle(x + 4, y + 2, 2.5);
    gfx.fillStyle(0xffaa00);
    gfx.fillCircle(x + 4, y + 2, 1.5);

    // Head (skin tone with 3D)
    gfx.fillStyle(0xc9a07a);
    gfx.fillCircle(x, y - 7, 8);
    gfx.fillStyle(0xddb896, 0.7);
    gfx.fillCircle(x - 2, y - 9, 5); // highlight

    // Cop hat (dark blue with visor)
    gfx.fillStyle(0x0a1a4c);
    gfx.fillRect(x - 9, y - 16, 18, 7);
    // Hat visor
    gfx.fillStyle(0x060e30);
    gfx.fillRect(x - 11, y - 10, 22, 3);
    // Hat highlight
    gfx.fillStyle(0x1a2a6c, 0.4);
    gfx.fillRect(x - 8, y - 15, 16, 2);

    // Hat badge (gold)
    gfx.fillStyle(0xffd700);
    gfx.fillCircle(x, y - 13, 2);

    // Eyes (looking at player direction)
    gfx.fillStyle(0xffffff);
    gfx.fillCircle(x - 3, y - 6, 2.5);
    gfx.fillCircle(x + 3, y - 6, 2.5);
    gfx.fillStyle(0x222222);
    gfx.fillCircle(x - 2.5, y - 5.5, 1.3);
    gfx.fillCircle(x + 3.5, y - 5.5, 1.3);

    // Mouth (stern expression)
    gfx.fillStyle(0x884444, 0.6);
    gfx.fillRect(x - 3, y - 1, 6, 1);

    // Red/blue siren flash for beat cops
    if (color === COLORS.copBeat) {
      const t = Date.now();
      const flash = Math.floor(t / 250) % 2 === 0;
      // Flashing glow
      gfx.fillStyle(flash ? 0xff0000 : 0x0000ff, 0.3);
      gfx.fillCircle(x, y - 16, 8);
      // Siren light
      gfx.fillStyle(flash ? 0xff0000 : 0x0000ff, 0.9);
      gfx.fillCircle(x, y - 17, 3);
    }
  }

  // ==================== INPUT ====================
  private setupInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.wasdKeys = {
        W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    // Always show touch controls so mobile works
    this.isTouchDevice = true;
    this.createTouchControls();
  }

  private createTouchControls(): void {
    const depth = 120;
    const alpha = 0.35;

    // === D-PAD (bottom-left) ===
    const padCenterX = 80;
    const padCenterY = CANVAS_HEIGHT - 80;
    const btnSize = 48;
    const gap = 2;

    // D-pad background circle
    const padBg = this.add.circle(padCenterX, padCenterY, 72, 0x000000, 0.2).setDepth(depth - 1);

    // UP
    const upBtn = this.add.rectangle(padCenterX, padCenterY - btnSize - gap, btnSize, btnSize, 0x444444, alpha)
      .setDepth(depth).setInteractive();
    const upArrow = this.add.text(padCenterX, padCenterY - btnSize - gap, '▲', {
      fontSize: '22px', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0.6);

    // DOWN
    const downBtn = this.add.rectangle(padCenterX, padCenterY + btnSize + gap, btnSize, btnSize, 0x444444, alpha)
      .setDepth(depth).setInteractive();
    const downArrow = this.add.text(padCenterX, padCenterY + btnSize + gap, '▼', {
      fontSize: '22px', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0.6);

    // LEFT
    const leftBtn = this.add.rectangle(padCenterX - btnSize - gap, padCenterY, btnSize, btnSize, 0x444444, alpha)
      .setDepth(depth).setInteractive();
    const leftArrow = this.add.text(padCenterX - btnSize - gap, padCenterY, '◄', {
      fontSize: '22px', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0.6);

    // RIGHT
    const rightBtn = this.add.rectangle(padCenterX + btnSize + gap, padCenterY, btnSize, btnSize, 0x444444, alpha)
      .setDepth(depth).setInteractive();
    const rightArrow = this.add.text(padCenterX + btnSize + gap, padCenterY, '►', {
      fontSize: '22px', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0.6);

    // D-pad event handlers
    const setDir = (dir: Direction) => { this.touchDirection = dir; };
    const clearDir = () => { this.touchDirection = Direction.NONE; };

    upBtn.on('pointerdown', () => setDir(Direction.UP));
    upBtn.on('pointerup', clearDir);
    upBtn.on('pointerout', clearDir);

    downBtn.on('pointerdown', () => setDir(Direction.DOWN));
    downBtn.on('pointerup', clearDir);
    downBtn.on('pointerout', clearDir);

    leftBtn.on('pointerdown', () => setDir(Direction.LEFT));
    leftBtn.on('pointerup', clearDir);
    leftBtn.on('pointerout', clearDir);

    rightBtn.on('pointerdown', () => setDir(Direction.RIGHT));
    rightBtn.on('pointerup', clearDir);
    rightBtn.on('pointerout', clearDir);

    // === CRACK BUTTON (bottom-right) ===
    const crackBtnX = CANVAS_WIDTH - 70;
    const crackBtnY = CANVAS_HEIGHT - 80;

    const crackBtn = this.add.circle(crackBtnX, crackBtnY, 36, 0xff00ff, alpha)
      .setDepth(depth).setInteractive().setStrokeStyle(2, 0xff00ff, 0.4);
    const crackLabel = this.add.text(crackBtnX, crackBtnY, '💎', {
      fontSize: '28px',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0.7);
    const crackSubLabel = this.add.text(crackBtnX, crackBtnY + 24, 'CRACK', {
      fontSize: '9px', fontFamily: 'monospace', color: '#FF00FF', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0.5);

    crackBtn.on('pointerdown', () => {
      this.smokeCrack();
      crackBtn.setFillStyle(0xff00ff, 0.6);
    });
    crackBtn.on('pointerup', () => crackBtn.setFillStyle(0xff00ff, alpha));
    crackBtn.on('pointerout', () => crackBtn.setFillStyle(0xff00ff, alpha));
  }

  private handleInput(): void {
    // Keyboard input (only if keyboard exists)
    if (this.cursors) {
      if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
        this.player.queuedDirection = Direction.UP;
      } else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
        this.player.queuedDirection = Direction.DOWN;
      } else if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
        this.player.queuedDirection = Direction.LEFT;
      } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
        this.player.queuedDirection = Direction.RIGHT;
      }
    }

    // Touch D-pad input
    if (this.touchDirection !== Direction.NONE) {
      this.player.queuedDirection = this.touchDirection;
    }

    // SPACE = smoke crack (only during sell phase, if you have some)
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.smokeCrack();
    }
  }

  // ==================== CRACK MECHANIC ====================
  private smokeCrack(): void {
    if (this.phase !== GamePhase.SELL) return;
    if (this.player.crackStash <= 0) return;
    if (this.player.isHighOnCrack) return; // already high

    this.player.crackStash--;
    this.player.isHighOnCrack = true;
    this.player.crackTimer = getCrackDuration(CRACK_DURATION, this.gameState.upgrades.crackTolerance);
    this.player.speed = this.player.baseSpeed * CRACK_SPEED_MULT;

    // Pick a random voice line
    const crackLine = CRACK_VOICE_LINES[Math.floor(Math.random() * CRACK_VOICE_LINES.length)];

    // Say it out loud with a hyped-up voice
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel(); // stop any in-progress speech
      const utterance = new SpeechSynthesisUtterance(crackLine);
      utterance.rate = 1.4;
      utterance.pitch = 1.5;
      utterance.volume = 1;
      // Try to pick a distinct voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes('Daniel') || v.name.includes('Alex') || v.name.includes('Fred'));
      if (preferred) utterance.voice = preferred;
      window.speechSynthesis.speak(utterance);
    }

    // CRAZY VISUAL EFFECTS
    this.cameras.main.shake(CRACK_DURATION, 0.008);
    this.cameras.main.flash(200, 255, 0, 255);

    // Tint overlay
    this.crackOverlay.setAlpha(0.15);

    // Zoom effect
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 1.08,
      duration: 300,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
    });

    // Show the voice line on screen
    const txt = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, crackLine, {
      fontSize: '24px', fontFamily: 'monospace', color: '#FF00FF',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: txt, alpha: 0, y: txt.y - 60, scaleX: 1.3, scaleY: 1.3,
      duration: 1200, onComplete: () => txt.destroy(),
    });
  }

  private updateCrackHigh(delta: number): void {
    if (!this.player.isHighOnCrack) return;

    this.player.crackTimer -= delta;

    // Spawn trail behind pac-man
    if (Math.random() < 0.4) {
      const colors = [0xff00ff, 0xffff00, 0x00ffff, 0xff0000, 0x00ff00];
      const trail = this.add.circle(
        this.player.container.x + (Math.random() - 0.5) * 10,
        this.player.container.y + (Math.random() - 0.5) * 10,
        6 + Math.random() * 4,
        colors[Math.floor(Math.random() * colors.length)],
        0.7,
      ).setDepth(5);

      this.tweens.add({
        targets: trail,
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: 300 + Math.random() * 200,
        onComplete: () => trail.destroy(),
      });
    }

    // Pulsing overlay color cycling
    this.screenTintTimer += delta;
    const hue = (this.screenTintTimer / 10) % 360;
    const color = Phaser.Display.Color.HSLToColor(hue / 360, 1, 0.5);
    this.crackOverlay.setFillStyle(color.color, 0.12);

    // Wearing off
    if (this.player.crackTimer <= 0) {
      this.player.isHighOnCrack = false;
      this.player.speed = this.player.baseSpeed;
      this.crackOverlay.setAlpha(0);
      this.cameras.main.setZoom(1);

      // Comedown flash
      this.cameras.main.flash(200, 100, 100, 100);

      const comedown = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 'coming down...', {
        fontSize: '16px', fontFamily: 'monospace', color: '#888888', fontStyle: 'italic',
      }).setOrigin(0.5).setDepth(100);
      this.tweens.add({
        targets: comedown, alpha: 0, duration: 1500,
        onComplete: () => comedown.destroy(),
      });
    }
  }

  // ==================== HUD ====================
  private createHUD(): void {
    this.add.rectangle(CANVAS_WIDTH / 2, HUD_HEIGHT / 2, CANVAS_WIDTH, HUD_HEIGHT, COLORS.hudBg);

    const ts: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '13px', fontFamily: 'monospace', color: '#FFFFFF',
    };

    this.phaseText = this.add.text(8, 4, '', { ...ts, fontSize: '14px', fontStyle: 'bold', color: '#FFD700' });
    this.timerText = this.add.text(8, 24, '', ts);
    this.dayText = this.add.text(8, 40, '', { ...ts, fontSize: '11px', color: '#888888' });
    this.cashText = this.add.text(160, 4, '', { ...ts, color: '#FFD700' });
    this.inventoryText = this.add.text(160, 22, '', ts);
    this.crackText = this.add.text(160, 40, '', { ...ts, fontSize: '11px', color: '#FF00FF' });
    this.livesText = this.add.text(320, 4, '', { ...ts, color: '#FF4444' });

    // Heat bar (only visible during sell phase)
    this.add.text(320, 24, 'HEAT', { ...ts, fontSize: '11px', color: '#FF6666' });
    this.heatBarBg = this.add.rectangle(370, 30, 100, 10, 0x333333).setOrigin(0, 0.5);
    this.heatBarFill = this.add.rectangle(370, 30, 0, 10, COLORS.heatLow).setOrigin(0, 0.5);

    // Power-up status
    this.powerUpText = this.add.text(320, 40, '', { ...ts, fontSize: '10px', color: '#FFFF00' });
  }

  private updateHUD(): void {
    const phaseLabel = this.phase === GamePhase.COLLECT ? '🏃 COLLECTING' : '💰 SELLING';
    this.phaseText.setText(phaseLabel);
    this.timerText.setText(`TIME ${Math.ceil(this.phaseTimer)}s`);
    this.dayText.setText(`DAY ${this.gameState.day} · ${this.currentMapName}`);
    this.cashText.setText(`$${this.gameState.cash}`);
    this.inventoryText.setText(`BAG ${this.player.inventory}`);
    this.livesText.setText('♥'.repeat(this.gameState.lives));

    // Crack stash
    if (this.player.isHighOnCrack) {
      this.crackText.setText('🔥 CRACKED OUT');
      this.crackText.setColor('#FF00FF');
    } else if (this.player.crackStash > 0) {
      this.crackText.setText(`💎 CRACK x${this.player.crackStash} [SPACE]`);
      this.crackText.setColor('#FFFFFF');
    } else {
      this.crackText.setText('');
    }

    // Heat bar
    if (this.phase === GamePhase.SELL) {
      this.heatBarBg.setVisible(true);
      this.heatBarFill.setVisible(true);
      const pct = this.heat / HEAT_MAX;
      this.heatBarFill.width = pct * 100;
      if (pct < 0.33) this.heatBarFill.fillColor = COLORS.heatLow;
      else if (pct < 0.66) this.heatBarFill.fillColor = COLORS.heatMid;
      else this.heatBarFill.fillColor = COLORS.heatHigh;
      if (pct > 0.75) {
        this.heatBarFill.alpha = 0.7 + Math.sin(this.time.now / 200) * 0.3;
      } else {
        this.heatBarFill.alpha = 1;
      }
    } else {
      this.heatBarBg.setVisible(false);
      this.heatBarFill.setVisible(false);
    }

    // Timer warning flash
    if (this.phaseTimer <= 5 && this.phaseTimer > 0) {
      this.timerText.setColor(Math.floor(this.phaseTimer * 3) % 2 === 0 ? '#FF4444' : '#FFFFFF');
    } else {
      this.timerText.setColor('#FFFFFF');
    }

    // Active power-ups
    if (this.activePowerUps.length > 0) {
      const puStr = this.activePowerUps.map(pu => {
        const secs = Math.ceil(pu.timer / 1000);
        return `${pu.def.emoji}${secs}s`;
      }).join(' ');
      this.powerUpText.setText(puStr);
    } else {
      this.powerUpText.setText('');
    }
  }

  // ==================== MOVEMENT ====================
  private tileToPixelX(gridX: number): number {
    return gridX * TILE_SIZE + TILE_SIZE / 2;
  }

  private tileToPixelY(gridY: number): number {
    return gridY * TILE_SIZE + TILE_SIZE / 2 + HUD_HEIGHT;
  }

  private moveEntity(entity: GridEntity, delta: number): void {
    if (!entity.isMoving) return;

    const targetPx = this.tileToPixelX(entity.targetGridX);
    const targetPy = this.tileToPixelY(entity.targetGridY);

    const dx = targetPx - entity.container.x;
    const dy = targetPy - entity.container.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = entity.speed * (delta / 1000);

    if (step >= dist) {
      entity.container.x = targetPx;
      entity.container.y = targetPy;
      entity.gridX = entity.targetGridX;
      entity.gridY = entity.targetGridY;
      entity.isMoving = false;
      this.checkTunnel(entity);
    } else {
      entity.container.x += (dx / dist) * step;
      entity.container.y += (dy / dist) * step;
    }
  }

  private tryMoveInDirection(entity: GridEntity, dir: Direction, isPlayer: boolean): boolean {
    if (dir === Direction.NONE) return false;
    const dd = DIR_DELTA[dir];
    const nextX = entity.gridX + dd.dx;
    const nextY = entity.gridY + dd.dy;

    // No X-wrapping here — tunnels are handled by checkTunnel after arrival
    if (isWalkableTile(nextX, nextY, isPlayer)) {
      entity.targetGridX = nextX;
      entity.targetGridY = nextY;
      entity.direction = dir;
      entity.isMoving = true;
      return true;
    }
    return false;
  }

  private updatePlayerMovement(delta: number): void {
    if (this.player.isMoving) {
      this.moveEntity(this.player, delta);
    }

    // Player just arrived at a new tile — collect items BEFORE continuing movement
    if (!this.player.isMoving) {
      this.checkContrabandCollection();
      this.checkCrackCollection();
      this.checkCustomerSales();
      this.checkPowerUpCollection();

      // Then try to continue moving
      if (this.player.queuedDirection !== Direction.NONE) {
        if (this.tryMoveInDirection(this.player, this.player.queuedDirection, true)) {
          this.player.queuedDirection = Direction.NONE;
          return;
        }
      }
      this.tryMoveInDirection(this.player, this.player.direction, true);
    }
  }

  private checkTunnel(entity: GridEntity): void {
    if (this.tunnelPositions.length < 2) return;
    for (const tunnel of this.tunnelPositions) {
      if (entity.gridX === tunnel.x && entity.gridY === tunnel.y) {
        const other = this.tunnelPositions.find(t => t.x !== tunnel.x || t.y !== tunnel.y);
        if (other) {
          entity.gridX = other.x;
          entity.gridY = other.y;
          entity.targetGridX = other.x;
          entity.targetGridY = other.y;
          entity.container.x = this.tileToPixelX(other.x);
          entity.container.y = this.tileToPixelY(other.y);
        }
        break;
      }
    }
  }

  // ==================== COP AI (SELL PHASE ONLY) ====================
  private updateCops(delta: number): void {
    if (this.phase !== GamePhase.SELL) return;

    for (const cop of this.cops) {
      // Exit ghost house on staggered timer
      if (cop.state === CopState.IN_HOUSE) {
        cop.exitTimer -= delta;
        if (cop.exitTimer <= 0) {
          cop.state = CopState.PATROL;
          const exit = findCopExitTile();
          cop.gridX = exit.x; cop.gridY = exit.y;
          cop.targetGridX = exit.x; cop.targetGridY = exit.y;
          cop.container.x = this.tileToPixelX(exit.x);
          cop.container.y = this.tileToPixelY(exit.y);
          cop.container.setVisible(true);
          cop.isMoving = false;
        }
        continue;
      }

      cop.container.setVisible(true);
      this.moveEntity(cop, delta);

      cop.aiTimer -= delta;
      if (cop.aiTimer <= 0 && !cop.isMoving) {
        cop.aiTimer = COP_AI_INTERVAL;
        this.decideCopAction(cop);
      }
    }
  }

  private decideCopAction(cop: CopEntity): void {
    const distToPlayer = Math.abs(cop.gridX - this.player.gridX) + Math.abs(cop.gridY - this.player.gridY);

    // If player is high on crack or has cop blind, cops are confused — random movement
    if (this.player.isHighOnCrack || this.hasPowerUp(PowerUpType.COP_BLIND)) {
      this.randomPatrolMove(cop);
      return;
    }

    // Detection: cops spot you based on distance + heat level
    const heatFactor = this.heat / HEAT_MAX;
    const effectiveRange = cop.detectionRange + heatFactor * 4; // heat makes detection easier
    const shouldChase = distToPlayer <= effectiveRange;

    if (shouldChase) {
      const wasChasing = cop.state === CopState.CHASE;
      cop.state = CopState.CHASE;

      // Cop yells when starting a chase
      if (!wasChasing && !cop.chaseLineSaid) {
        cop.chaseLineSaid = true;
        const line = COP_CHASE_LINES[Math.floor(Math.random() * COP_CHASE_LINES.length)];

        if (window.speechSynthesis) {
          const utt = new SpeechSynthesisUtterance(line);
          utt.rate = 1.1;
          utt.pitch = 0.6;
          utt.volume = 1;
          const voices = window.speechSynthesis.getVoices();
          const copVoice = voices.find(v => v.name.includes('Tom') || v.name.includes('Daniel') || v.name.includes('Ralph'));
          if (copVoice) utt.voice = copVoice;
          window.speechSynthesis.speak(utt);
        }

        // Speech bubble
        const bubbleBg = this.add.rectangle(
          cop.container.x, cop.container.y - 30,
          line.length * 7 + 16, 22, 0xffffff, 0.9,
        ).setDepth(81).setStrokeStyle(1, 0xff0000);
        const chaseTxt = this.add.text(
          cop.container.x, cop.container.y - 30, line,
          { fontSize: '11px', fontFamily: 'monospace', color: '#CC0000', fontStyle: 'bold' },
        ).setOrigin(0.5).setDepth(82);
        this.tweens.add({
          targets: [chaseTxt, bubbleBg], alpha: 0, y: `-=25`,
          duration: 1500, onComplete: () => { chaseTxt.destroy(); bubbleBg.destroy(); },
        });
      }

      const dir = this.findPathBFS(cop.gridX, cop.gridY, this.player.gridX, this.player.gridY, false);
      if (dir !== Direction.NONE) {
        this.tryMoveInDirection(cop, dir, false);
      }
    } else {
      cop.state = CopState.PATROL;
      cop.chaseLineSaid = false; // reset so they yell again next chase
      this.randomPatrolMove(cop);
    }

    // Update cop color based on state
    let color = cop.type === CopType.BEAT ? COLORS.copBeat :
                cop.type === CopType.PATROL ? COLORS.copPatrol : COLORS.copUndercover;
    if (cop.state === CopState.CHASE) {
      // Flashing red when chasing
      color = Math.floor(Date.now() / 200) % 2 === 0 ? 0xff0000 : 0xff4444;
    }
    this.drawCop(cop.graphics, 0, 0, color);
  }

  private randomPatrolMove(cop: CopEntity): void {
    const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    const validDirs: Direction[] = [];

    for (const dir of dirs) {
      if (dir === OPPOSITE_DIR[cop.direction]) continue;
      const d = DIR_DELTA[dir];
      if (isWalkableTile(cop.gridX + d.dx, cop.gridY + d.dy, false)) {
        validDirs.push(dir);
      }
    }
    // If no valid dirs without reversing, allow reverse
    if (validDirs.length === 0) {
      for (const dir of dirs) {
        const d = DIR_DELTA[dir];
        if (isWalkableTile(cop.gridX + d.dx, cop.gridY + d.dy, false)) {
          validDirs.push(dir);
        }
      }
    }

    if (validDirs.length > 0) {
      this.tryMoveInDirection(cop, validDirs[Math.floor(Math.random() * validDirs.length)], false);
    }
  }

  private findPathBFS(startX: number, startY: number, endX: number, endY: number, isPlayer: boolean): Direction {
    if (startX === endX && startY === endY) return Direction.NONE;

    const queue: { x: number; y: number; firstDir: Direction }[] = [];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    for (const dir of dirs) {
      const d = DIR_DELTA[dir];
      const nx = startX + d.dx;
      const ny = startY + d.dy;
      if (isWalkableTile(nx, ny, isPlayer) && !visited.has(`${nx},${ny}`)) {
        if (nx === endX && ny === endY) return dir;
        visited.add(`${nx},${ny}`);
        queue.push({ x: nx, y: ny, firstDir: dir });
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const dir of dirs) {
        const d = DIR_DELTA[dir];
        const nx = current.x + d.dx;
        const ny = current.y + d.dy;
        const key = `${nx},${ny}`;
        if (isWalkableTile(nx, ny, isPlayer) && !visited.has(key)) {
          if (nx === endX && ny === endY) return current.firstDir;
          visited.add(key);
          queue.push({ x: nx, y: ny, firstDir: current.firstDir });
        }
      }
    }

    return Direction.NONE;
  }

  // ==================== COLLISIONS ====================
  private checkContrabandCollection(): void {
    if (this.phase !== GamePhase.COLLECT) return;

    for (const item of this.contraband) {
      if (item.collected) continue;
      if (item.gridX === this.player.gridX && item.gridY === this.player.gridY) {
        item.collected = true;
        item.sprite.setVisible(false);
        this.player.inventory++;

        // No flash per-dot to keep it snappy — just gobble instantly
      }
    }
  }

  private checkCrackCollection(): void {
    if (this.phase !== GamePhase.SELL) return;

    for (const crack of this.crackPickups) {
      if (crack.collected) continue;
      if (crack.gridX === this.player.gridX && crack.gridY === this.player.gridY) {
        crack.collected = true;
        crack.sprite.setVisible(false);
        this.player.crackStash++;

        const txt = this.add.text(
          this.player.container.x, this.player.container.y - 20,
          '💎 +CRACK', {
            fontSize: '14px', fontFamily: 'monospace', color: '#FFFFFF', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 2,
          },
        ).setOrigin(0.5).setDepth(80);
        this.tweens.add({
          targets: txt, y: txt.y - 25, alpha: 0,
          duration: 700, onComplete: () => txt.destroy(),
        });
      }
    }
  }

  private checkCustomerSales(): void {
    if (this.phase !== GamePhase.SELL) return;
    if (this.player.inventory <= 0) return;

    for (const customer of this.customers) {
      if (!customer.active) continue;
      if (customer.gridX === this.player.gridX && customer.gridY === this.player.gridY) {
        // Customer buys a portion of the bag (1-5 units)
        const sellCount = Math.min(this.player.inventory, Math.ceil(Math.random() * 5));
        const multiplier = getSaleMultiplier(this.gameState.upgrades.betterProduct);
        const doubleCash = this.hasPowerUp(PowerUpType.DOUBLE_CASH) ? 2 : 1;
        const earnings = Math.floor(sellCount * 20 * multiplier * doubleCash);

        this.gameState.cash += earnings;
        this.gameState.totalCashEarned += earnings;
        this.player.inventory -= sellCount;
        this.heat = Math.min(HEAT_MAX, this.heat + HEAT_PER_SALE);

        const earnText = this.add.text(
          customer.container.x, customer.container.y - 20,
          `+$${earnings}`, {
            fontSize: '16px', fontFamily: 'monospace', color: '#00FF00', fontStyle: 'bold',
          },
        ).setOrigin(0.5).setDepth(80);

        this.tweens.add({
          targets: earnText, y: earnText.y - 30, alpha: 0,
          duration: 800, onComplete: () => earnText.destroy(),
        });

        customer.active = false;
        customer.container.setVisible(false);
      }
    }
  }

  private checkCopCollisions(): void {
    if (this.phase !== GamePhase.SELL) return;

    for (const cop of this.cops) {
      if (cop.state === CopState.IN_HOUSE) continue;
      if (cop.gridX !== this.player.gridX || cop.gridY !== this.player.gridY) continue;

      // If high on crack or cop blind, you blow right past cops
      if (this.player.isHighOnCrack || this.hasPowerUp(PowerUpType.COP_BLIND)) {
        // Cop says a line via TTS (deep authoritative cop voice)
        const line = COP_KNOCKOUT_LINES[Math.floor(Math.random() * COP_KNOCKOUT_LINES.length)];
        if (window.speechSynthesis) {
          const utt = new SpeechSynthesisUtterance(line);
          utt.rate = 0.9;
          utt.pitch = 0.5;
          utt.volume = 1;
          const voices = window.speechSynthesis.getVoices();
          const copVoice = voices.find(v => v.name.includes('Tom') || v.name.includes('Daniel') || v.name.includes('Ralph'));
          if (copVoice) utt.voice = copVoice;
          window.speechSynthesis.speak(utt);
        }

        // Show speech bubble with the line
        const bubbleBg = this.add.rectangle(
          cop.container.x, cop.container.y - 30,
          line.length * 7 + 16, 22, 0xffffff, 0.9,
        ).setDepth(81).setStrokeStyle(1, 0x000000);

        const knockText = this.add.text(
          cop.container.x, cop.container.y - 30, line,
          { fontSize: '11px', fontFamily: 'monospace', color: '#000000', fontStyle: 'bold' },
        ).setOrigin(0.5).setDepth(82);

        this.tweens.add({
          targets: [knockText, bubbleBg], alpha: 0, y: `-=25`,
          duration: 1200, onComplete: () => { knockText.destroy(); bubbleBg.destroy(); },
        });

        // Knocked out emoji
        const starText = this.add.text(
          cop.container.x, cop.container.y, '💫',
          { fontSize: '20px' },
        ).setOrigin(0.5).setDepth(80);
        this.tweens.add({
          targets: starText, alpha: 0, y: starText.y - 20,
          duration: 500, onComplete: () => starText.destroy(),
        });

        // Send cop back to station temporarily
        cop.state = CopState.IN_HOUSE;
        cop.exitTimer = 4000;
        cop.container.setVisible(false);
        cop.gridX = cop.homeX; cop.gridY = cop.homeY;
        cop.targetGridX = cop.homeX; cop.targetGridY = cop.homeY;
        cop.container.x = this.tileToPixelX(cop.homeX);
        cop.container.y = this.tileToPixelY(cop.homeY);
        cop.isMoving = false;
        continue;
      }

      // SHOOTOUT!
      this.startShootout();
      return;
    }
  }

  // ==================== SHOOTOUT TRANSITION ====================
  private startShootout(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.dayActive = false;

    // Getaway Car — one free escape per day
    if (this.gameState.upgrades.getawayCar && !this.gameState.getawayCarUsedToday) {
      this.gameState.getawayCarUsedToday = true;
      this.transitioning = false;
      this.dayActive = true;

      const spawn = findPlayerSpawn();
      this.player.gridX = spawn.x;
      this.player.gridY = spawn.y;
      this.player.targetGridX = spawn.x;
      this.player.targetGridY = spawn.y;
      this.player.container.x = this.tileToPixelX(spawn.x);
      this.player.container.y = this.tileToPixelY(spawn.y);
      this.player.isMoving = false;
      this.player.direction = Direction.NONE;

      this.cameras.main.flash(300, 255, 255, 0);
      const escTxt = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '🚗 GETAWAY CAR!', {
        fontSize: '28px', fontFamily: 'monospace', color: '#FFFF00', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(100);
      this.tweens.add({
        targets: escTxt, alpha: 0, y: escTxt.y - 40,
        duration: 1200, onComplete: () => escTxt.destroy(),
      });
      return;
    }

    // Dramatic slowdown + scene transition to shootout
    this.cameras.main.shake(300, 0.01);
    this.cameras.main.setZoom(1);
    this.crackOverlay.setAlpha(0);
    this.player.inventory = 0;

    // "CONFRONTATION" flash
    const confrontText = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '⚔️ CONFRONTATION!', {
      fontSize: '28px', fontFamily: 'monospace', color: '#FF4444', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance('Hold it right there!');
      utt.rate = 0.9; utt.pitch = 0.5; utt.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const copVoice = voices.find(v => v.name.includes('Tom') || v.name.includes('Daniel') || v.name.includes('Ralph'));
      if (copVoice) utt.voice = copVoice;
      window.speechSynthesis.speak(utt);
    }

    // Slow zoom and fade to shootout scene
    this.tweens.add({
      targets: this.cameras.main, zoom: 1.3,
      duration: 1200, ease: 'Sine.easeIn',
    });

    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
    });

    this.time.delayedCall(2000, () => {
      this.registry.set('gameState', this.gameState);
      this.scene.start('ShootoutScene');
    });
  }

  // ==================== GETTING CAUGHT (direct arrest, no shootout) ====================
  private getCaught(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.dayActive = false;

    this.player.inventory = 0;
    const cashLoss = Math.floor(this.gameState.cash * 0.25);
    this.gameState.cash -= cashLoss;
    this.gameState.lives--;

    this.cameras.main.shake(500, 0.02);
    this.cameras.main.flash(500, 255, 0, 0);
    this.cameras.main.setZoom(1);
    this.crackOverlay.setAlpha(0);

    // === ARREST ANIMATION ===
    // Find the cop that caught the player
    const arrestCop = this.cops.find(c =>
      c.state !== CopState.IN_HOUSE && c.gridX === this.player.gridX && c.gridY === this.player.gridY,
    );

    // "BUSTED" text
    const bustedText = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, '🚔 BUSTED! 🚔', {
      fontSize: '42px', fontFamily: 'monospace', color: '#FF0000', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);

    if (cashLoss > 0) {
      const lossText = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10, `-$${cashLoss}`, {
        fontSize: '24px', fontFamily: 'monospace', color: '#FF4444', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(100);
      this.tweens.add({ targets: lossText, alpha: 0, delay: 1500, duration: 500 });
    }

    // TTS: cop says something
    if (window.speechSynthesis) {
      const utt = new SpeechSynthesisUtterance("You're going to jail!");
      utt.rate = 0.9; utt.pitch = 0.5; utt.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const copVoice = voices.find(v => v.name.includes('Tom') || v.name.includes('Daniel') || v.name.includes('Ralph'));
      if (copVoice) utt.voice = copVoice;
      window.speechSynthesis.speak(utt);
    }

    // Handcuff effect on player — player turns grey and stops
    this.player.container.setAlpha(0.7);

    // Create a cop escort if we found the arresting cop
    const escortCop = arrestCop ? arrestCop.container : null;

    // Prison is off-screen to the right
    const prisonX = CANVAS_WIDTH + 40;
    const prisonY = this.player.container.y;

    // Show "handcuffs" text above player
    const cuffText = this.add.text(
      this.player.container.x, this.player.container.y - 30, '🔗',
      { fontSize: '16px' },
    ).setOrigin(0.5).setDepth(101);

    // Animate: cop drags player to prison (off screen right)
    const walkDuration = 2000;

    // Player walks to prison
    this.tweens.add({
      targets: this.player.container,
      x: prisonX, y: prisonY,
      duration: walkDuration,
      ease: 'Linear',
    });

    // Handcuff icon follows player
    this.tweens.add({
      targets: cuffText,
      x: prisonX, y: prisonY - 30,
      duration: walkDuration,
      ease: 'Linear',
    });

    // Cop follows right behind
    if (escortCop) {
      this.tweens.add({
        targets: escortCop,
        x: prisonX - 30, y: prisonY,
        duration: walkDuration,
        ease: 'Linear',
      });
    }

    // Red/blue flashing overlay during arrest
    let flashCount = 0;
    const flashTimer = this.time.addEvent({
      delay: 200,
      repeat: Math.floor(walkDuration / 200),
      callback: () => {
        flashCount++;
        const isRed = flashCount % 2 === 0;
        this.cameras.main.flash(100, isRed ? 255 : 0, 0, isRed ? 0 : 255);
      },
    });

    // Prison bars slide in from right
    this.time.delayedCall(walkDuration * 0.6, () => {
      // Draw prison bars at the right edge
      const barsGfx = this.add.graphics().setDepth(95);
      barsGfx.fillStyle(0x333333);
      for (let i = 0; i < 8; i++) {
        barsGfx.fillRect(CANVAS_WIDTH - 80 + i * 12, HUD_HEIGHT, 4, CANVAS_HEIGHT - HUD_HEIGHT);
      }
      // Cross bars
      barsGfx.fillRect(CANVAS_WIDTH - 80, HUD_HEIGHT + 40, 90, 4);
      barsGfx.fillRect(CANVAS_WIDTH - 80, CANVAS_HEIGHT - 80, 90, 4);
      barsGfx.setAlpha(0);
      this.tweens.add({ targets: barsGfx, alpha: 1, duration: 400 });
    });

    // Busted text fades, then scene transition
    this.tweens.add({
      targets: bustedText, alpha: 0,
      delay: walkDuration - 500, duration: 500,
    });

    // Fade to black then transition
    this.time.delayedCall(walkDuration + 500, () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
    });

    this.time.delayedCall(walkDuration + 1000, () => {
      flashTimer.destroy();
      this.gameState.day++;
      if (this.gameState.lives <= 0) {
        this.registry.set('gameState', this.gameState);
        this.scene.start('GameOverScene');
      } else {
        this.registry.set('gameState', this.gameState);
        this.scene.start('ShopScene');
      }
    });
  }

  // ==================== TIMER ====================
  private updateTimer(delta: number): void {
    this.phaseTimer -= delta / 1000;

    if (this.phaseTimer <= 0) {
      this.phaseTimer = 0;
      if (this.phase === GamePhase.COLLECT) {
        this.startSellPhase();
      } else {
        this.endDay();
      }
    }
  }

  private endDay(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.dayActive = false;
    this.cameras.main.setZoom(1);
    this.crackOverlay.setAlpha(0);

    const completeText = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 'DAY COMPLETE', {
      fontSize: '36px', fontFamily: 'monospace', color: '#00FF00', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);

    this.cameras.main.flash(300, 0, 255, 0);

    this.time.delayedCall(1500, () => {
      completeText.destroy();
      this.gameState.day++;
      this.registry.set('gameState', this.gameState);
      this.scene.start('ShopScene');
    });
  }

  // ==================== ANIMATIONS ====================
  private updatePlayerAnimation(): void {
    if (!this.player.container.first) return;
    const gfx = this.player.container.first as Phaser.GameObjects.Graphics;
    const mouthAngle = 10 + Math.abs(Math.sin(this.time.now / 150)) * 40;
    const dir = this.player.direction === Direction.NONE ? Direction.RIGHT : this.player.direction;
    this.drawPacMan(gfx, 0, 0, dir, mouthAngle, this.player.isHighOnCrack);

    // Skin trail effect (only when moving)
    if (this.player.skinTrail && this.player.isMoving && Math.random() < 0.3) {
      const trail = this.add.circle(
        this.player.container.x, this.player.container.y,
        5, this.player.skinTrail, 0.5,
      ).setDepth(3);
      this.tweens.add({
        targets: trail, alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 350, onComplete: () => trail.destroy(),
      });
    }
  }

  private updateCopVisibility(): void {
    if (this.phase !== GamePhase.SELL) return;
    const hasLookout = this.gameState.upgrades.lookout;

    for (const cop of this.cops) {
      if (cop.state === CopState.IN_HOUSE) {
        cop.container.setVisible(false);
        continue;
      }

      cop.container.setVisible(true);
      if (hasLookout) cop.container.setAlpha(0.7);

      // Redraw cops every frame (so beat cop siren flashes)
      if (cop.type === CopType.UNDERCOVER && cop.state === CopState.PATROL) {
        const dist = Math.abs(cop.gridX - this.player.gridX) + Math.abs(cop.gridY - this.player.gridY);
        if (dist > 3) {
          this.drawCop(cop.graphics, 0, 0, COLORS.copUndercover);
        } else {
          this.drawCop(cop.graphics, 0, 0, COLORS.copBeat);
        }
      } else if (cop.state === CopState.CHASE) {
        this.drawCop(cop.graphics, 0, 0, COLORS.copBeat);
      } else {
        const color = cop.type === CopType.PATROL ? COLORS.copPatrol : COLORS.copBeat;
        this.drawCop(cop.graphics, 0, 0, color);
      }
    }
  }

  // ==================== MAIN UPDATE ====================
  update(_time: number, rawDelta: number): void {
    if (!this.dayActive) return;

    // Clamp delta to prevent huge jumps when tab loses focus
    const delta = Math.min(rawDelta, 100);

    this.handleInput();
    this.updatePlayerMovement(delta);
    this.updatePlayerAnimation();
    this.updateCrackHigh(delta);
    this.updatePowerUps(delta);
    this.updateCops(delta);
    this.updateCopVisibility();
    this.updateTimer(delta);

    // Cop collisions checked every frame (collection is handled in updatePlayerMovement)
    this.checkCopCollisions();

    // Passive heat during sell phase
    if (this.phase === GamePhase.SELL) {
      this.heat = Math.min(HEAT_MAX, this.heat + HEAT_PASSIVE_RATE * (delta / 1000));
    }

    this.updateHUD();
  }
}
