export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];
  icon: string;
}

export const UPGRADES: UpgradeDefinition[] = [
  {
    id: 'speedShoes',
    name: 'Speed Shoes',
    description: 'Move faster through the streets',
    maxLevel: 3,
    costs: [100, 250, 500],
    icon: '👟',
  },
  {
    id: 'streetSmarts',
    name: 'Street Smarts',
    description: 'Cops take longer to notice you',
    maxLevel: 2,
    costs: [200, 400],
    icon: '🧠',
  },
  {
    id: 'lookout',
    name: 'Lookout',
    description: 'See cop positions through walls',
    maxLevel: 1,
    costs: [300],
    icon: '👁',
  },
  {
    id: 'betterProduct',
    name: 'Better Product',
    description: 'Customers pay more per sale',
    maxLevel: 2,
    costs: [250, 500],
    icon: '💎',
  },
  {
    id: 'crackTolerance',
    name: 'Crack Tolerance',
    description: 'Crack high lasts longer',
    maxLevel: 2,
    costs: [200, 450],
    icon: '🔥',
  },
  {
    id: 'getawayCar',
    name: 'Getaway Car',
    description: 'Escape cops once per day for free',
    maxLevel: 1,
    costs: [400],
    icon: '🚗',
  },
];

export interface AdvertisingTier {
  name: string;
  cost: number;
  customerBonus: number;
  description: string;
}

export const ADVERTISING_TIERS: AdvertisingTier[] = [
  {
    name: 'Word of Mouth',
    cost: 100,
    customerBonus: 2,
    description: '+2 customers per day',
  },
  {
    name: 'Burner Phones',
    cost: 300,
    customerBonus: 5,
    description: '+5 customers per day',
  },
];

// Speed multiplier per upgrade level
export function getSpeedMultiplier(level: number): number {
  return 1 + level * 0.15;
}

// Detection range reduction per upgrade level
export function getDetectionRange(base: number, level: number): number {
  return Math.max(2, base - level * 1.5);
}

// Sale price multiplier per upgrade level
export function getSaleMultiplier(level: number): number {
  return 1 + level * 0.25; // 1x, 1.25x, 1.5x
}

// Crack duration bonus per level (ms)
export function getCrackDuration(base: number, level: number): number {
  return base + level * 2500; // +2.5s per level
}

// Total customers per day based on advertising tier
export function getCustomerCount(baseCust: number, adTier: number): number {
  let total = baseCust;
  for (let i = 0; i < adTier; i++) {
    total += ADVERTISING_TIERS[i].customerBonus;
  }
  return total;
}
