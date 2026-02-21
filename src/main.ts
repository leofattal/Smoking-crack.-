import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { ShopScene } from './scenes/ShopScene';
import { GameOverScene } from './scenes/GameOverScene';
import { ShootoutScene } from './scenes/ShootoutScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  parent: 'game-container',
  backgroundColor: `#${COLORS.background.toString(16).padStart(6, '0')}`,
  pixelArt: true,
  input: {
    activePointers: 3,
    touch: { capture: true },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, ShopScene, GameOverScene, ShootoutScene],
};

new Phaser.Game(config);
