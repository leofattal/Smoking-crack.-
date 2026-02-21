import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GameState, SKINS, SkinDef, GUNS, GunDef } from '../config/constants';
import { UPGRADES, ADVERTISING_TIERS } from '../config/upgrades';

export class ShopScene extends Phaser.Scene {
  private gameState!: GameState;
  private cashText!: Phaser.GameObjects.Text;
  private scrollY: number = 0;
  private content!: Phaser.GameObjects.Container;
  private contentHeight: number = 0;

  // Touch scroll state
  private dragStartY: number = 0;
  private dragScrollStart: number = 0;
  private isDragging: boolean = false;
  private scrollVelocity: number = 0;
  private lastPointerY: number = 0;
  private lastMoveTime: number = 0;

  constructor() {
    super({ key: 'ShopScene' });
  }

  create(): void {
    this.gameState = this.registry.get('gameState') as GameState;
    this.scrollY = 0;

    // Fixed background
    this.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x111122);

    // Fixed header
    this.add.rectangle(CANVAS_WIDTH / 2, 40, CANVAS_WIDTH, 80, 0x111122).setDepth(10);

    this.add.text(CANVAS_WIDTH / 2, 16, 'THE HIDEOUT', {
      fontSize: '24px', fontFamily: 'monospace', color: '#FFD700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);

    this.add.text(CANVAS_WIDTH / 2, 42, `Day ${this.gameState.day} | ${this.gameState.lives} lives`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#AAAAAA',
    }).setOrigin(0.5).setDepth(11);

    this.cashText = this.add.text(CANVAS_WIDTH / 2, 63, `$${this.gameState.cash}`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#00FF00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);

    // Scrollable content container
    this.content = this.add.container(0, 85);

    let y = 0;
    const ROW = 48;

    // === UPGRADES SECTION ===
    this.addSectionHeader('UPGRADES', y);
    y += 22;

    for (let i = 0; i < UPGRADES.length; i++) {
      this.createUpgradeRow(UPGRADES[i], y, i);
      y += ROW;
    }

    y += 10;

    // === ADVERTISING SECTION ===
    this.addSectionHeader('ADVERTISING', y);
    y += 22;

    for (let i = 0; i < ADVERTISING_TIERS.length; i++) {
      this.createAdRow(ADVERTISING_TIERS[i], y, i);
      y += ROW;
    }

    y += 10;

    // === WEAPONS SECTION ===
    this.addSectionHeader('WEAPONS', y);
    y += 22;

    for (let i = 0; i < GUNS.length; i++) {
      this.createGunRow(GUNS[i], y);
      y += ROW;
    }

    y += 10;

    // === COSMETICS SECTION ===
    this.addSectionHeader('SKINS', y);
    y += 22;

    const COLS = 2;
    const SKIN_W = (CANVAS_WIDTH - 50) / COLS;
    const SKIN_H = 52;

    for (let i = 0; i < SKINS.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = 20 + col * (SKIN_W + 10);
      const sy = y + row * SKIN_H;
      this.createSkinCard(SKINS[i], sx, sy, SKIN_W, SKIN_H - 4);
    }

    y += Math.ceil(SKINS.length / COLS) * SKIN_H + 10;

    this.contentHeight = y;
    this.isDragging = false;
    this.scrollVelocity = 0;

    const maxScroll = () => Math.max(0, this.contentHeight - (CANVAS_HEIGHT - 140));
    const applyScroll = () => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, maxScroll());
      this.content.y = 85 - this.scrollY;
    };

    // Mouse wheel scrolling
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[], deltaY: number) => {
      this.scrollVelocity = 0;
      this.scrollY += deltaY * 0.5;
      applyScroll();
    });

    // Touch / mouse drag scrolling
    const DRAG_THRESHOLD = 8;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragStartY = pointer.y;
      this.dragScrollStart = this.scrollY;
      this.isDragging = false;
      this.scrollVelocity = 0;
      this.lastPointerY = pointer.y;
      this.lastMoveTime = Date.now();
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const dy = this.dragStartY - pointer.y;

      // Start dragging once past threshold
      if (!this.isDragging && Math.abs(dy) > DRAG_THRESHOLD) {
        this.isDragging = true;
      }

      if (this.isDragging) {
        // Track velocity for momentum
        const now = Date.now();
        const dt = now - this.lastMoveTime;
        if (dt > 0) {
          this.scrollVelocity = (this.lastPointerY - pointer.y) / dt * 16; // per-frame velocity
        }
        this.lastPointerY = pointer.y;
        this.lastMoveTime = now;

        this.scrollY = this.dragScrollStart + dy;
        applyScroll();
      }
    });

    this.input.on('pointerup', () => {
      // If was dragging, keep momentum going
      if (this.isDragging) {
        // scrollVelocity is already set from pointermove
      }
      this.isDragging = false;
    });

    // === FIXED BOTTOM BAR with START NEXT DAY button ===
    const bottomBarY = CANVAS_HEIGHT - 30;
    this.add.rectangle(CANVAS_WIDTH / 2, bottomBarY, CANVAS_WIDTH, 60, 0x111122).setDepth(10);
    this.add.rectangle(CANVAS_WIDTH / 2, bottomBarY - 30, CANVAS_WIDTH, 1, 0x333355).setDepth(10);

    const nextBtn = this.add.rectangle(CANVAS_WIDTH / 2, bottomBarY, 250, 40, 0x006600)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x00ff00)
      .setDepth(11);

    const btnText = this.add.text(CANVAS_WIDTH / 2, bottomBarY, 'START NEXT DAY', {
      fontSize: '16px', fontFamily: 'monospace', color: '#00FF00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);

    nextBtn.on('pointerover', () => nextBtn.setFillStyle(0x008800));
    nextBtn.on('pointerout', () => nextBtn.setFillStyle(0x006600));
    nextBtn.on('pointerup', () => {
      if (this.isDragging) return;
      this.registry.set('gameState', this.gameState);
      this.scene.start('GameScene');
    });
  }

  // === HELPERS ===

  private addSectionHeader(title: string, y: number): void {
    const txt = this.add.text(15, y, title, {
      fontSize: '13px', fontFamily: 'monospace', color: '#FFFFFF', fontStyle: 'bold',
    });
    this.content.add(txt);
    const line = this.add.rectangle(CANVAS_WIDTH / 2, y + 16, CANVAS_WIDTH - 30, 1, 0x333355);
    this.content.add(line);
  }

  private createUpgradeRow(def: typeof UPGRADES[0], y: number, idx: number): void {
    const currentLevel = this.getLevel(def.id);
    const maxed = currentLevel >= def.maxLevel;
    const cost = maxed ? 0 : def.costs[currentLevel];

    const bg = this.add.rectangle(CANVAS_WIDTH / 2, y + 18, CANVAS_WIDTH - 24, 42, 0x1c1c38)
      .setStrokeStyle(1, 0x333355);
    this.content.add(bg);

    const nameT = this.add.text(18, y + 6, `${def.icon} ${def.name}`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#FFFFFF', fontStyle: 'bold',
    });
    this.content.add(nameT);

    const descT = this.add.text(18, y + 22, def.description, {
      fontSize: '10px', fontFamily: 'monospace', color: '#888888',
    });
    this.content.add(descT);

    const lvlT = this.add.text(CANVAS_WIDTH - 15, y + 22, `Lv${currentLevel}/${def.maxLevel}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#666666',
    }).setOrigin(1, 0);
    this.content.add(lvlT);

    const costT = this.add.text(CANVAS_WIDTH - 15, y + 6, maxed ? 'MAX' : `$${cost}`, {
      fontSize: '13px', fontFamily: 'monospace',
      color: maxed ? '#555555' : (this.gameState.cash >= cost ? '#FFD700' : '#FF4444'),
      fontStyle: 'bold',
    }).setOrigin(1, 0);
    this.content.add(costT);

    if (!maxed) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x282850));
      bg.on('pointerout', () => bg.setFillStyle(0x1c1c38));
      bg.on('pointerup', () => {
        if (this.isDragging) return;
        if (this.gameState.cash < cost) { this.flashCash(); return; }
        this.gameState.cash -= cost;
        this.setLevel(def.id, currentLevel + 1);
        this.cameras.main.flash(150, 0, 255, 0);
        this.refreshShop();
      });
    }
  }

  private createAdRow(tier: typeof ADVERTISING_TIERS[0], y: number, idx: number): void {
    const owned = this.gameState.advertisingTier > idx;
    const canBuy = this.gameState.advertisingTier === idx;

    const bg = this.add.rectangle(CANVAS_WIDTH / 2, y + 18, CANVAS_WIDTH - 24, 42, 0x1c1c38)
      .setStrokeStyle(1, 0x333355);
    this.content.add(bg);

    this.content.add(this.add.text(18, y + 6, `📢 ${tier.name}`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#FFFFFF', fontStyle: 'bold',
    }));

    this.content.add(this.add.text(18, y + 22, tier.description, {
      fontSize: '10px', fontFamily: 'monospace', color: '#888888',
    }));

    this.content.add(this.add.text(CANVAS_WIDTH - 15, y + 6, owned ? 'OWNED' : `$${tier.cost}`, {
      fontSize: '13px', fontFamily: 'monospace',
      color: owned ? '#555555' : (this.gameState.cash >= tier.cost ? '#FFD700' : '#FF4444'),
      fontStyle: 'bold',
    }).setOrigin(1, 0));

    if (canBuy && !owned) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x282850));
      bg.on('pointerout', () => bg.setFillStyle(0x1c1c38));
      bg.on('pointerup', () => {
        if (this.isDragging) return;
        if (this.gameState.cash < tier.cost) { this.flashCash(); return; }
        this.gameState.cash -= tier.cost;
        this.gameState.advertisingTier = idx + 1;
        this.cameras.main.flash(150, 0, 255, 0);
        this.refreshShop();
      });
    }
  }

  private createGunRow(gun: GunDef, y: number): void {
    const owned = this.gameState.ownedGuns.includes(gun.id);
    const equipped = this.gameState.currentGun === gun.id;

    const bg = this.add.rectangle(CANVAS_WIDTH / 2, y + 18, CANVAS_WIDTH - 24, 42, 0x1c1c38)
      .setStrokeStyle(1, equipped ? 0xffd700 : 0x333355);
    this.content.add(bg);

    const nameT = this.add.text(18, y + 6, `${gun.emoji} ${gun.name}`, {
      fontSize: '13px', fontFamily: 'monospace',
      color: equipped ? '#FFD700' : '#FFFFFF', fontStyle: 'bold',
    });
    this.content.add(nameT);

    const descT = this.add.text(18, y + 22, `${gun.description} · ${Math.round(gun.accuracy * 100)}% accuracy`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#888888',
    });
    this.content.add(descT);

    let statusText = `$${gun.cost}`;
    let statusColor = this.gameState.cash >= gun.cost ? '#FFD700' : '#FF4444';
    if (owned && equipped) { statusText = 'EQUIPPED'; statusColor = '#FFD700'; }
    else if (owned) { statusText = 'EQUIP'; statusColor = '#00FF00'; }

    const costT = this.add.text(CANVAS_WIDTH - 15, y + 6, statusText, {
      fontSize: '13px', fontFamily: 'monospace', color: statusColor, fontStyle: 'bold',
    }).setOrigin(1, 0);
    this.content.add(costT);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x282850));
    bg.on('pointerout', () => bg.setFillStyle(equipped ? 0x2a2a44 : 0x1c1c38));
    bg.on('pointerup', () => {
      if (this.isDragging) return;
      if (owned) {
        this.gameState.currentGun = gun.id;
        this.refreshShop();
      } else {
        if (this.gameState.cash < gun.cost) { this.flashCash(); return; }
        this.gameState.cash -= gun.cost;
        this.gameState.ownedGuns.push(gun.id);
        this.gameState.currentGun = gun.id;
        this.cameras.main.flash(150, 0, 255, 0);
        this.refreshShop();
      }
    });
  }

  private createSkinCard(skin: SkinDef, x: number, y: number, w: number, h: number): void {
    const owned = this.gameState.ownedSkins.includes(skin.id);
    const selected = this.gameState.selectedSkin === skin.id;

    const borderColor = selected ? 0xffd700 : (owned ? 0x444466 : 0x333355);
    const bg = this.add.rectangle(x + w / 2, y + h / 2, w, h, selected ? 0x2a2a44 : 0x1c1c38)
      .setStrokeStyle(selected ? 2 : 1, borderColor);
    this.content.add(bg);

    // Pac-man preview circle
    const previewGfx = this.add.graphics();
    let previewColor = skin.color;
    if (skin.rainbow) {
      previewColor = 0xff00ff; // show magenta as preview for rainbow
    }
    previewGfx.fillStyle(previewColor);
    previewGfx.slice(x + 22, y + h / 2, 10, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(330), false);
    previewGfx.fillPath();
    if (skin.glow) {
      previewGfx.fillStyle(previewColor, 0.2);
      previewGfx.fillCircle(x + 22, y + h / 2, 15);
    }
    this.content.add(previewGfx);

    this.content.add(this.add.text(x + 40, y + 6, skin.name, {
      fontSize: '11px', fontFamily: 'monospace',
      color: selected ? '#FFD700' : '#FFFFFF', fontStyle: 'bold',
    }));

    // Status text
    let statusText = `$${skin.cost}`;
    let statusColor = this.gameState.cash >= skin.cost ? '#FFD700' : '#FF4444';
    if (owned && selected) { statusText = 'EQUIPPED'; statusColor = '#FFD700'; }
    else if (owned) { statusText = 'EQUIP'; statusColor = '#00FF00'; }

    this.content.add(this.add.text(x + 40, y + 22, statusText, {
      fontSize: '10px', fontFamily: 'monospace', color: statusColor, fontStyle: 'bold',
    }));

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x282850));
    bg.on('pointerout', () => bg.setFillStyle(selected ? 0x2a2a44 : 0x1c1c38));
    bg.on('pointerup', () => {
      if (this.isDragging) return;
      if (owned) {
        this.gameState.selectedSkin = skin.id;
        this.refreshShop();
      } else {
        if (this.gameState.cash < skin.cost) { this.flashCash(); return; }
        this.gameState.cash -= skin.cost;
        this.gameState.ownedSkins.push(skin.id);
        this.gameState.selectedSkin = skin.id;
        this.cameras.main.flash(150, 0, 255, 0);
        this.refreshShop();
      }
    });
  }

  // === MOMENTUM SCROLL ===
  update(): void {
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.2) {
      this.scrollY += this.scrollVelocity;
      this.scrollVelocity *= 0.92; // friction
      const maxScroll = Math.max(0, this.contentHeight - (CANVAS_HEIGHT - 140));
      this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, maxScroll);
      this.content.y = 85 - this.scrollY;

      // Stop at edges
      if (this.scrollY <= 0 || this.scrollY >= maxScroll) {
        this.scrollVelocity = 0;
      }
    } else if (!this.isDragging) {
      this.scrollVelocity = 0;
    }
  }

  // === STATE HELPERS ===

  private getLevel(id: string): number {
    const val = (this.gameState.upgrades as Record<string, number | boolean>)[id];
    return typeof val === 'boolean' ? (val ? 1 : 0) : (val as number);
  }

  private setLevel(id: string, level: number): void {
    const ups = this.gameState.upgrades as Record<string, number | boolean>;
    if (typeof ups[id] === 'boolean') ups[id] = level > 0;
    else ups[id] = level;
  }

  private flashCash(): void {
    this.cashText.setColor('#FF0000');
    this.time.delayedCall(300, () => this.cashText.setColor('#00FF00'));
    this.cameras.main.shake(200, 0.005);
  }

  private refreshShop(): void {
    this.cashText.setText(`$${this.gameState.cash}`);
    // Rebuild the shop content
    this.content.removeAll(true);
    this.scene.restart();
  }
}
