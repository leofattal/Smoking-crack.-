import Phaser from 'phaser';
import { createInitialGameState } from '../config/constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Initialize game state in registry
    this.registry.set('gameState', createInitialGameState());
    this.scene.start('MenuScene');
  }
}
