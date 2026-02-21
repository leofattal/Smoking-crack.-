import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from '../config/constants';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Title
    this.add.text(cx, cy - 120, 'PAC-MAN', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 65, 'STREET HUSTLE', {
      fontSize: '36px',
      fontFamily: 'monospace',
      color: '#FF6B35',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Pac-Man graphic
    const gfx = this.add.graphics();
    gfx.fillStyle(COLORS.player);
    gfx.slice(cx, cy + 20, 24, Phaser.Math.DegToRad(35), Phaser.Math.DegToRad(325), false);
    gfx.fillPath();

    // Dots trailing behind pac-man
    for (let i = 1; i <= 4; i++) {
      gfx.fillStyle(0xffffff);
      gfx.fillCircle(cx + 40 + i * 22, cy + 20, 4);
    }

    // Start button (works on both mobile and desktop)
    const btnY = cy + 100;
    const startBtn = this.add.rectangle(cx, btnY, 280, 50, 0x006600)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x00ff00);

    const startText = this.add.text(cx, btnY, 'TAP TO START', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#00FF00',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Blink effect
    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    const startGame = () => {
      this.scene.start('GameScene');
    };

    startBtn.on('pointerover', () => startBtn.setFillStyle(0x008800));
    startBtn.on('pointerout', () => startBtn.setFillStyle(0x006600));
    startBtn.on('pointerdown', startGame);

    // Instructions
    this.add.text(cx, cy + 150, 'Arrow Keys / WASD to move', {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#888888',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 172, 'SPACE to smoke crack', {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#888888',
    }).setOrigin(0.5);

    // Flavor text
    this.add.text(cx, cy + 220, 'Collect. Sell. Evade. Upgrade.', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#FFD700',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Keyboard: SPACE also starts
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-SPACE', startGame);
    }
  }
}
