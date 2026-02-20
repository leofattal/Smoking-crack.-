# PRD: Pac-Man Street Hustle

## Overview
A darkly comedic arcade game that reimagines classic Pac-Man as a street-level hustle simulator. Each day cycle, the player controls Pac-Man navigating maze-like city streets to collect contraband, sell it to customers, evade police, and reinvest profits into upgrades and advertising to grow their operation.

## Core Gameplay Loop

### 1. The Daily Hustle (Main Gameplay Phase)
- Pac-Man navigates a top-down maze representing city streets, alleys, and neighborhoods
- **Collect phase:** Dots are replaced with various contraband items scattered across the map (baggies, vials, pills, mystery packages)
- **Sell phase:** Customers (NPCs) appear at fixed or semi-random locations on the map — navigate to them to make sales
- Different contraband types have different street values
- Each "day" is a timed round (e.g., 60-90 seconds)

### 2. Police Chases (Threat System)
- Cops patrol the streets like ghosts in classic Pac-Man — they follow patrol routes and chase Pac-Man if they get too close
- **Heat meter:** The more you collect and sell, the higher your heat rises
- At certain heat thresholds, more cops spawn and they become faster/smarter
- Getting caught by a cop ends the day early and you lose a portion of your stash and cash
- **Power-ups:** Grabbing a "bribe" power-up temporarily makes cops ignore you (like the classic power pellet)
- Other evasion tools: smoke bombs (temporary invisibility), shortcuts (tunnels/alleyways), decoys

### 3. End-of-Day Shop (Progression Phase)
After each day, Pac-Man returns to his hideout where the player can spend profits:

#### Upgrades
| Upgrade | Effect |
|---------|--------|
| **Speed Shoes** | Pac-Man moves faster |
| **Bigger Pockets** | Carry more contraband at once |
| **Street Smarts** | Cops take longer to notice you |
| **Lookout** | Shows cop positions on the minimap |
| **Bulk Connect** | Higher-value contraband spawns on the map |
| **Getaway Car** | One free escape from a cop per day |
| **Safe House** | Stash overflow items between days |
| **Better Product** | Customers pay more per sale |

#### Advertising
- Spend cash to "advertise" and attract more customers to the streets
- Tiers: Word of Mouth → Burner Phone Network → Social Media → Billboard (increasingly absurd)
- More advertising = more customers = more sales opportunities (but also more heat)

## Map & Setting
- The map is a procedurally arranged or hand-crafted city maze with streets, alleys, dead ends, parks, and tunnels
- Visual style: retro pixel art with a gritty urban color palette — neon signs, graffiti, flickering streetlights
- Multiple neighborhoods unlock as you progress, each with different layouts, cop density, and contraband values
- Warp tunnels connect distant parts of the map (like classic Pac-Man side tunnels)

## Progression & Difficulty
- **Day 1-5:** Tutorial zone — few cops, simple maze, low-value items
- **Day 6-15:** City expands, more cop types introduced (beat cops, patrol cars, undercover)
- **Day 16-30:** Full city unlocked, SWAT teams, helicopter surveillance
- **Day 30+:** Endless mode — difficulty scales continuously, leaderboard-driven
- Each day gets progressively harder: smarter cops, more of them, higher stakes

## Cop Types
| Type | Behavior |
|------|----------|
| **Beat Cop** | Slow, predictable patrol route |
| **Patrol Car** | Fast but limited to streets (can't enter alleys) |
| **Undercover** | Looks like a customer until you get close |
| **K-9 Unit** | Tracks your recent path |
| **SWAT** | Fast, aggressive, appears at max heat |
| **Helicopter** | Flies over walls, spotlights areas of the map |

## Scoring & Economy
- **Cash:** Earned from sales, used in the shop
- **Reputation:** Earned from successful days — unlocks new neighborhoods and items
- **High Score:** Total cash earned across a run for leaderboards
- Losing all lives (3 arrests = game over) ends the run

## Controls
- **Arrow keys / WASD / Swipe:** Move Pac-Man through the maze
- **Spacebar / Tap:** Use active item (smoke bomb, decoy, etc.)
- Simple two-button arcade-style controls — accessible to anyone

## Visual & Audio Style
- Retro pixel art with a modern twist — think *Hotline Miami* meets classic Pac-Man
- Soundtrack: lo-fi beats, trap instrumentals, chiptune remixes
- SFX: cash register cha-ching on sales, police sirens growing louder as heat rises, "waka waka" reimagined as footsteps on pavement

## Platform
- **Primary:** Web (browser-based)
- **Tech stack:** HTML5 Canvas or Phaser.js for 2D rendering
- **Stretch:** Mobile (PWA or native wrapper)

## MVP Scope (v1.0)
1. Single maze map with Pac-Man movement and collision
2. Contraband collection (dots) and customer sales (power pellet locations)
3. 3 cop types with basic AI (patrol, chase, catch)
4. Heat meter system
5. End-of-day shop with 4-5 upgrades
6. Basic advertising system (2 tiers)
7. Day counter and game-over after 3 arrests
8. Score tracking

## Stretch Goals (v2.0+)
- Multiple city maps / neighborhoods
- Boss encounters (DEA raids)
- Multiplayer: competitive hustling on the same map
- Daily challenges with unique modifiers
- Cosmetic skins for Pac-Man (hoodie, trench coat, disguises)
- Story mode with cutscenes between days
