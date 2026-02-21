import Phaser from 'phaser';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, COLORS,
  GameState, GUNS, GunDef,
  SHOOTOUT_WIN_LINES, SHOOTOUT_LOSE_LINES,
  SKINS,
} from '../config/constants';

enum ShootoutPhase {
  INTRO = 'INTRO',
  STAREDOWN = 'STAREDOWN',
  DRAW = 'DRAW',
  RESULT = 'RESULT',
}

export class ShootoutScene extends Phaser.Scene {
  private gameState!: GameState;
  private phase: ShootoutPhase = ShootoutPhase.INTRO;
  private gun!: GunDef;
  private drawTimer: number = 0;
  private drawWindowActive: boolean = false;
  private playerShot: boolean = false;
  private result: 'win' | 'lose' | null = null;
  private flashTimer: number = 0;

  constructor() {
    super({ key: 'ShootoutScene' });
  }

  create(): void {
    this.gameState = this.registry.get('gameState') as GameState;
    this.phase = ShootoutPhase.INTRO;
    this.drawTimer = 0;
    this.drawWindowActive = false;
    this.playerShot = false;
    this.result = null;
    this.flashTimer = 0;

    // Find current gun
    this.gun = GUNS.find(g => g.id === this.gameState.currentGun) || GUNS[0];

    // Dark background
    this.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x0a0a0a);

    // Ground line
    const groundY = CANVAS_HEIGHT * 0.7;
    this.add.rectangle(CANVAS_WIDTH / 2, groundY, CANVAS_WIDTH, 2, 0x333333);
    // Dirty ground below
    this.add.rectangle(CANVAS_WIDTH / 2, groundY + (CANVAS_HEIGHT - groundY) / 2, CANVAS_WIDTH, CANVAS_HEIGHT - groundY, 0x1a1410);

    // Draw the scene characters
    this.drawStandoff(groundY);

    // Start the sequence
    this.runIntro(groundY);
  }

  private drawStandoff(groundY: number): void {
    // === PLAYER (left side) ===
    const playerX = CANVAS_WIDTH * 0.25;
    const playerY = groundY - 40;
    const playerGfx = this.add.graphics();
    const skinDef = SKINS.find(s => s.id === this.gameState.selectedSkin) || SKINS[0];
    const skinColor = skinDef.color;

    // Shadow
    playerGfx.fillStyle(0x000000, 0.4);
    playerGfx.fillEllipse(playerX, groundY - 2, 50, 12);

    // Pac-Man body (big, facing right)
    const R = 30;
    playerGfx.fillStyle(skinColor);
    playerGfx.slice(playerX, playerY, R, 0.3, Math.PI * 2 - 0.3, false);
    playerGfx.fillPath();

    // Highlight
    playerGfx.fillStyle(0xffffff, 0.15);
    playerGfx.fillCircle(playerX - 8, playerY - 10, R * 0.4);

    // Cap
    playerGfx.fillStyle(0x880000);
    playerGfx.fillCircle(playerX, playerY - R + 4, R * 0.65);
    playerGfx.fillRect(playerX - R * 0.65, playerY - R - 2, R * 1.3, 5);
    // Brim
    playerGfx.fillStyle(0x111111);
    playerGfx.fillRect(playerX + 6, playerY - R + 2, R * 0.7, 3);

    // Sunglasses
    playerGfx.fillStyle(0x111111);
    playerGfx.fillRect(playerX - 12, playerY - 6, 10, 7);
    playerGfx.fillRect(playerX + 2, playerY - 6, 10, 7);
    playerGfx.fillRect(playerX - 2, playerY - 4, 4, 3);
    playerGfx.fillStyle(0x4444ff, 0.3);
    playerGfx.fillRect(playerX - 10, playerY - 6, 4, 4);
    playerGfx.fillRect(playerX + 4, playerY - 6, 4, 4);

    // Jacket band
    playerGfx.fillStyle(0x1a1a1a, 0.7);
    playerGfx.slice(playerX, playerY, R, Math.PI * 0.15, Math.PI * 0.85, false);
    playerGfx.fillPath();

    // Gold chain
    playerGfx.fillStyle(0xffd700);
    playerGfx.fillCircle(playerX + R - 6, playerY + 8, 2);
    playerGfx.fillCircle(playerX + R - 5, playerY + 11, 2);
    playerGfx.fillCircle(playerX + R - 6, playerY + 14, 3);

    // Legs
    playerGfx.fillStyle(0x2244aa);
    playerGfx.fillRect(playerX - 10, playerY + R - 4, 8, 14);
    playerGfx.fillRect(playerX + 2, playerY + R - 4, 8, 14);
    playerGfx.fillStyle(0xcc0000);
    playerGfx.fillRect(playerX - 12, playerY + R + 8, 12, 5);
    playerGfx.fillRect(playerX, playerY + R + 8, 12, 5);

    // Gun in hand (or fist)
    if (this.gun.id !== 'fists') {
      playerGfx.fillStyle(0x333333);
      playerGfx.fillRect(playerX + R - 2, playerY + 2, 16, 5);
      playerGfx.fillRect(playerX + R + 8, playerY + 5, 4, 8);
      // Gun label
      this.add.text(playerX + R + 20, playerY - 4, this.gun.emoji, { fontSize: '18px' }).setOrigin(0.5);
    }

    // Player name
    this.add.text(playerX, groundY + 16, 'YOU', {
      fontSize: '14px', fontFamily: 'monospace', color: '#FFD700', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Gun name
    this.add.text(playerX, groundY + 32, `${this.gun.emoji} ${this.gun.name}`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5);

    // === COP (right side) ===
    const copX = CANVAS_WIDTH * 0.75;
    const copY = groundY - 40;
    const copGfx = this.add.graphics();

    // Shadow
    copGfx.fillStyle(0x000000, 0.4);
    copGfx.fillEllipse(copX, groundY - 2, 50, 12);

    // Legs
    copGfx.fillStyle(0x0a0a22);
    copGfx.fillRect(copX - 12, copY + 20, 10, 16);
    copGfx.fillRect(copX + 2, copY + 20, 10, 16);
    copGfx.fillStyle(0x111111);
    copGfx.fillRect(copX - 14, copY + 34, 14, 5);
    copGfx.fillRect(copX, copY + 34, 14, 5);

    // Body
    copGfx.fillStyle(0x1a2a6c);
    copGfx.fillRect(copX - 18, copY - 6, 36, 28);
    copGfx.fillStyle(0x2a3a8c, 0.5);
    copGfx.fillRect(copX - 16, copY - 4, 14, 24);

    // Belt
    copGfx.fillStyle(0x222222);
    copGfx.fillRect(copX - 18, copY + 18, 36, 5);
    copGfx.fillStyle(0xcccc00);
    copGfx.fillRect(copX - 2, copY + 18, 5, 5);

    // Badge
    copGfx.fillStyle(0xffd700);
    copGfx.fillCircle(copX + 8, copY + 4, 5);
    copGfx.fillStyle(0xffaa00);
    copGfx.fillCircle(copX + 8, copY + 4, 3);

    // Head
    copGfx.fillStyle(0xc9a07a);
    copGfx.fillCircle(copX, copY - 16, 16);
    copGfx.fillStyle(0xddb896, 0.5);
    copGfx.fillCircle(copX - 4, copY - 20, 10);

    // Hat
    copGfx.fillStyle(0x0a1a4c);
    copGfx.fillRect(copX - 18, copY - 34, 36, 14);
    copGfx.fillStyle(0x060e30);
    copGfx.fillRect(copX - 22, copY - 22, 44, 4);
    copGfx.fillStyle(0xffd700);
    copGfx.fillCircle(copX, copY - 28, 4);

    // Eyes (looking at player)
    copGfx.fillStyle(0xffffff);
    copGfx.fillCircle(copX - 6, copY - 14, 4);
    copGfx.fillCircle(copX + 6, copY - 14, 4);
    copGfx.fillStyle(0x222222);
    copGfx.fillCircle(copX - 7, copY - 13, 2);
    copGfx.fillCircle(copX + 5, copY - 13, 2);

    // Angry mouth
    copGfx.fillStyle(0x884444);
    copGfx.fillRect(copX - 5, copY - 5, 10, 2);

    // Cop's gun (pointing at player)
    copGfx.fillStyle(0x222222);
    copGfx.fillRect(copX - R - 10, copY + 2, 18, 5);
    copGfx.fillRect(copX - R - 4, copY + 5, 5, 8);

    // Siren flash
    const sirenGfx = this.add.graphics();
    this.time.addEvent({
      delay: 250,
      repeat: -1,
      callback: () => {
        if (this.phase === ShootoutPhase.RESULT) return;
        sirenGfx.clear();
        const flash = Math.floor(Date.now() / 250) % 2 === 0;
        sirenGfx.fillStyle(flash ? 0xff0000 : 0x0000ff, 0.25);
        sirenGfx.fillCircle(copX, copY - 34, 16);
        sirenGfx.fillStyle(flash ? 0xff0000 : 0x0000ff, 0.9);
        sirenGfx.fillCircle(copX, copY - 36, 5);
      },
    });

    // Cop label
    this.add.text(copX, groundY + 16, 'COP', {
      fontSize: '14px', fontFamily: 'monospace', color: '#FF4444', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(copX, groundY + 32, '🔫 Service Pistol', {
      fontSize: '11px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5);

    // VS text
    this.add.text(CANVAS_WIDTH / 2, playerY - 10, 'VS', {
      fontSize: '28px', fontFamily: 'monospace', color: '#FF4444', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
  }

  private runIntro(groundY: number): void {
    // Dramatic intro
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Title
    const title = this.add.text(CANVAS_WIDTH / 2, 30, '⚔️ SHOOTOUT ⚔️', {
      fontSize: '32px', fontFamily: 'monospace', color: '#FF0000', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: title, alpha: 1, duration: 500,
    });

    // TTS: dramatic standoff
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance("It's a standoff!");
      utt.rate = 0.8; utt.pitch = 0.4; utt.volume = 1;
      window.speechSynthesis.speak(utt);
    }

    // After intro, start staredown
    this.time.delayedCall(1500, () => {
      this.phase = ShootoutPhase.STAREDOWN;
      this.runStaredown();
    });
  }

  private runStaredown(): void {
    // Countdown dots: 3... 2... 1... DRAW!
    const centerY = CANVAS_HEIGHT * 0.42;

    const countText = this.add.text(CANVAS_WIDTH / 2, centerY, '', {
      fontSize: '48px', fontFamily: 'monospace', color: '#FFFFFF', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    const counts = ['3', '2', '1'];
    let i = 0;

    const countTimer = this.time.addEvent({
      delay: 800,
      repeat: 2,
      callback: () => {
        countText.setText(counts[i]);
        countText.setScale(1.5);
        this.tweens.add({
          targets: countText, scaleX: 1, scaleY: 1,
          duration: 300, ease: 'Back.easeOut',
        });
        this.cameras.main.shake(100, 0.003);
        i++;
      },
    });

    // After countdown, DRAW!
    this.time.delayedCall(800 * 3 + 200, () => {
      countText.setText('DRAW!');
      countText.setColor('#FF0000');
      countText.setFontSize(56);
      countText.setScale(2);
      this.tweens.add({
        targets: countText, scaleX: 1, scaleY: 1,
        duration: 200,
      });

      this.cameras.main.flash(200, 255, 0, 0);

      // Instruction
      const instructText = this.add.text(CANVAS_WIDTH / 2, centerY + 50, 'CLICK / TAP NOW!', {
        fontSize: '20px', fontFamily: 'monospace', color: '#FFFF00', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(10);

      // Start blinking
      this.tweens.add({
        targets: instructText, alpha: 0.3,
        duration: 200, yoyo: true, repeat: -1,
      });

      // Activate draw phase
      this.phase = ShootoutPhase.DRAW;
      this.drawWindowActive = true;
      this.drawTimer = 0;

      // Listen for click/tap
      const cleanup = () => {
        this.input.off('pointerdown', clickHandler);
        if (this.input.keyboard) {
          this.input.keyboard.off('keydown', keyHandler as any);
        }
      };

      const handleShot = () => {
        if (!this.drawWindowActive || this.playerShot) return;
        this.playerShot = true;
        this.drawWindowActive = false;
        cleanup();
        const won = Math.random() < this.gun.accuracy;
        this.resolveShootout(won, countText, instructText);
      };

      const clickHandler = () => handleShot();
      const keyHandler = () => handleShot();

      this.input.on('pointerdown', clickHandler);
      if (this.input.keyboard) {
        this.input.keyboard.on('keydown', keyHandler);
      }

      // If player doesn't click in time, they lose
      this.time.delayedCall(this.gun.drawWindow, () => {
        if (this.playerShot) return;
        this.drawWindowActive = false;
        cleanup();
        this.resolveShootout(false, countText, instructText);
      });
    });
  }

  private resolveShootout(won: boolean, countText: Phaser.GameObjects.Text, instructText: Phaser.GameObjects.Text): void {
    this.phase = ShootoutPhase.RESULT;
    this.result = won ? 'win' : 'lose';

    countText.destroy();
    instructText.destroy();

    const centerY = CANVAS_HEIGHT * 0.42;

    if (won) {
      // === PLAYER WINS ===
      this.cameras.main.flash(300, 255, 200, 0);
      this.cameras.main.shake(400, 0.015);

      // Muzzle flash
      const muzzle = this.add.circle(CANVAS_WIDTH * 0.38, CANVAS_HEIGHT * 0.7 - 42, 20, 0xffff00, 0.9).setDepth(15);
      this.tweens.add({ targets: muzzle, alpha: 0, scaleX: 2, scaleY: 2, duration: 200, onComplete: () => muzzle.destroy() });

      // Gunshot sound effect via TTS
      const line = SHOOTOUT_WIN_LINES[Math.floor(Math.random() * SHOOTOUT_WIN_LINES.length)];
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(line);
        utt.rate = 1.3; utt.pitch = 1.4; utt.volume = 1;
        window.speechSynthesis.speak(utt);
      }

      // Big "YOU WIN" text
      const winText = this.add.text(CANVAS_WIDTH / 2, centerY, '💥 YOU WIN! 💥', {
        fontSize: '36px', fontFamily: 'monospace', color: '#00FF00', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(20);

      // Voice line text
      this.add.text(CANVAS_WIDTH / 2, centerY + 40, `"${line}"`, {
        fontSize: '16px', fontFamily: 'monospace', color: '#FFD700', fontStyle: 'italic',
      }).setOrigin(0.5).setDepth(20);

      // Cop spins and falls (X over eyes)
      const copX = CANVAS_WIDTH * 0.75;
      const copDeadGfx = this.add.graphics().setDepth(18);
      copDeadGfx.fillStyle(0xff0000, 0.6);
      copDeadGfx.fillCircle(copX, CANVAS_HEIGHT * 0.7 - 56, 12);
      // X eyes
      const xText = this.add.text(copX, CANVAS_HEIGHT * 0.7 - 56, 'X X', {
        fontSize: '16px', fontFamily: 'monospace', color: '#FF0000', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(19);

      // After delay, go back to game (escaped!)
      this.time.delayedCall(2500, () => {
        this.cameras.main.fadeOut(500, 0, 0, 0);
      });

      this.time.delayedCall(3000, () => {
        // Player escapes — continue the day
        this.registry.set('gameState', this.gameState);
        this.scene.start('GameScene');
      });

    } else {
      // === PLAYER LOSES ===
      this.cameras.main.flash(300, 255, 0, 0);
      this.cameras.main.shake(500, 0.02);

      // Cop muzzle flash
      const muzzle = this.add.circle(CANVAS_WIDTH * 0.62, CANVAS_HEIGHT * 0.7 - 42, 20, 0xff4444, 0.9).setDepth(15);
      this.tweens.add({ targets: muzzle, alpha: 0, scaleX: 2, scaleY: 2, duration: 200, onComplete: () => muzzle.destroy() });

      const line = SHOOTOUT_LOSE_LINES[Math.floor(Math.random() * SHOOTOUT_LOSE_LINES.length)];
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(line);
        utt.rate = 0.9; utt.pitch = 0.5; utt.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        const copVoice = voices.find(v => v.name.includes('Tom') || v.name.includes('Daniel') || v.name.includes('Ralph'));
        if (copVoice) utt.voice = copVoice;
        window.speechSynthesis.speak(utt);
      }

      // "BUSTED" text
      const loseText = this.add.text(CANVAS_WIDTH / 2, centerY, '🚔 BUSTED! 🚔', {
        fontSize: '36px', fontFamily: 'monospace', color: '#FF0000', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(20);

      // Voice line
      this.add.text(CANVAS_WIDTH / 2, centerY + 40, `"${line}"`, {
        fontSize: '16px', fontFamily: 'monospace', color: '#FF6666', fontStyle: 'italic',
      }).setOrigin(0.5).setDepth(20);

      // Lose a life, lose cash
      this.gameState.lives--;
      const cashLoss = Math.floor(this.gameState.cash * 0.25);
      this.gameState.cash -= cashLoss;
      this.gameState.day++;

      if (cashLoss > 0) {
        this.add.text(CANVAS_WIDTH / 2, centerY + 65, `-$${cashLoss}`, {
          fontSize: '18px', fontFamily: 'monospace', color: '#FF4444', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(20);
      }

      // Red/blue flashing
      const flashEvent = this.time.addEvent({
        delay: 200,
        repeat: 12,
        callback: () => {
          this.flashTimer++;
          const isRed = this.flashTimer % 2 === 0;
          this.cameras.main.flash(100, isRed ? 255 : 0, 0, isRed ? 0 : 255);
        },
      });

      // Prison bars slide in
      this.time.delayedCall(1500, () => {
        const barsGfx = this.add.graphics().setDepth(25);
        barsGfx.fillStyle(0x444444);
        for (let i = 0; i < 12; i++) {
          barsGfx.fillRect(i * (CANVAS_WIDTH / 12) + 10, 0, 6, CANVAS_HEIGHT);
        }
        // Horizontal bars
        barsGfx.fillRect(0, CANVAS_HEIGHT * 0.3, CANVAS_WIDTH, 6);
        barsGfx.fillRect(0, CANVAS_HEIGHT * 0.7, CANVAS_WIDTH, 6);
        barsGfx.setAlpha(0);
        this.tweens.add({ targets: barsGfx, alpha: 0.7, duration: 600 });

        // "Going to jail" TTS
        if (window.speechSynthesis) {
          const utt2 = new SpeechSynthesisUtterance("You're going to jail!");
          utt2.rate = 0.8; utt2.pitch = 0.4; utt2.volume = 1;
          window.speechSynthesis.speak(utt2);
        }
      });

      // Fade out and transition
      this.time.delayedCall(3500, () => {
        this.cameras.main.fadeOut(800, 0, 0, 0);
      });

      this.time.delayedCall(4300, () => {
        flashEvent.destroy();
        this.registry.set('gameState', this.gameState);
        if (this.gameState.lives <= 0) {
          this.scene.start('GameOverScene');
        } else {
          this.scene.start('ShopScene');
        }
      });
    }
  }
}
