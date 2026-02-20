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

    // Instructions
    this.add.text(cx, cy + 100, 'PRESS SPACE TO START', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#FFFFFF',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 140, 'ARROW KEYS / WASD to move', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#888888',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 165, 'SPACE to use power-up', {
      fontSize: '14px',
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

    // Blink "PRESS SPACE" text
    this.tweens.add({
      targets: this.children.list[3], // the press space text
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Input
    this.input.keyboard!.once('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
  }
}
