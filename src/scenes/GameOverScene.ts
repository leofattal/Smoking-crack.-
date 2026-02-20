import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GameState, createInitialGameState } from '../config/constants';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(): void {
    const gameState = this.registry.get('gameState') as GameState;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Dark background
    this.add.rectangle(cx, cy, CANVAS_WIDTH, CANVAS_HEIGHT, 0x0a0a0a);

    // Red flash
    this.cameras.main.flash(500, 255, 0, 0);

    // Game Over title
    this.add.text(cx, cy - 140, 'GAME OVER', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#FF0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 85, 'You got locked up.', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#888888',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Stats
    const statsStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#FFFFFF',
    };

    this.add.text(cx, cy - 30, `Days Survived: ${gameState.day}`, statsStyle).setOrigin(0.5);
    this.add.text(cx, cy, `Total Cash Earned: $${gameState.totalCashEarned}`, {
      ...statsStyle,
      color: '#FFD700',
    }).setOrigin(0.5);
    this.add.text(cx, cy + 30, `Cash on Hand: $${gameState.cash}`, statsStyle).setOrigin(0.5);

    // Upgrades summary
    let upgradeCount = 0;
    const ups = gameState.upgrades;
    upgradeCount += ups.speedShoes + ups.streetSmarts + ups.betterProduct + ups.crackTolerance;
    if (ups.lookout) upgradeCount++;
    if (ups.getawayCar) upgradeCount++;

    this.add.text(cx, cy + 60, `Upgrades Purchased: ${upgradeCount}`, {
      ...statsStyle,
      color: '#AAAAAA',
      fontSize: '14px',
    }).setOrigin(0.5);

    // Rating
    let rating = 'Corner Boy';
    if (gameState.totalCashEarned >= 5000) rating = 'Block Captain';
    if (gameState.totalCashEarned >= 15000) rating = 'Kingpin';
    if (gameState.totalCashEarned >= 30000) rating = 'Legend';

    this.add.text(cx, cy + 100, `Street Rank: ${rating}`, {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Play Again button
    const btnY = cy + 170;
    const btn = this.add.rectangle(cx, btnY, 220, 40, 0x440000)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0xff0000);

    const btnText = this.add.text(cx, btnY, 'PLAY AGAIN', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#FF4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btn.on('pointerover', () => {
      btn.setFillStyle(0x660000);
      btnText.setColor('#FF6666');
    });
    btn.on('pointerout', () => {
      btn.setFillStyle(0x440000);
      btnText.setColor('#FF4444');
    });
    btn.on('pointerdown', () => {
      this.registry.set('gameState', createInitialGameState());
      this.scene.start('MenuScene');
    });

    // Also allow SPACE to restart
    this.input.keyboard!.once('keydown-SPACE', () => {
      this.registry.set('gameState', createInitialGameState());
      this.scene.start('MenuScene');
    });

    // Blinking prompt
    const restartHint = this.add.text(cx, cy + 220, 'Press SPACE to try again', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#666666',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: restartHint,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }
}
