# 🍉 Fruit Ninja

A fast-paced, physics-based **Fruit Ninja** clone built with **Phaser 4**, **React 19**, **TypeScript**, and **Vite**. Slice fruit, dodge bombs, rack up combos, and chase the high score — playing either with your mouse on desktop or by tilting your phone as a motion controller.

![screenshot](screenshot.png)

## ✨ Features

- **Classic Fruit Ninja gameplay** — slice fruit that arcs across the screen with realistic physics, and avoid the bombs that cost you points and a life.
- **Dynamic difficulty** — the game reads your score and smoothly ramps up spawn rate and fruit speed as you play, so it always stays challenging.
- **Persistent high score** — your best score is saved to `localStorage`, shown live in the in-game HUD (it tracks your current run as soon as you pass your record) and highlighted on the game-over screen with a **NEW HIGH SCORE!** banner.
- **3 lives / heart HUD** — lose a heart for every fruit you drop or bomb you slice; lose all three and it's game over.
- **Juicy juice** — splash effects, fruit halves that fly apart, screen shake, slice/whoosh/impact sound effects, and a full soundtrack.
- **On-device settings** — toggle music and sound effects from an in-game Settings panel; your choices persist across reloads.
- **Mobile motion controller** — host a QR code in Settings so a phone can connect via WebRTC (PeerJS) and control the blade by tilting (device orientation), complete with calibration and a recenter button.
- **Responsive full-screen canvas** — the game fills the browser window and adapts its HUD and spawn logic to any screen size.

## 🚀 Getting Started

### Requirements

[Node.js](https://nodejs.org) is required to install dependencies and run the scripts.

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

The dev server runs at **http://localhost:8080** by default. Vite hot-reloads your changes, so editing any file in `src` updates the browser automatically.

### Production build

```bash
npm run build
```

This produces an optimized bundle in the `dist/` folder — upload the entire `dist` directory to any static web server to deploy.

## 🎮 How to Play

**Desktop (mouse):**

- Move the mouse to move the blade.
- Click and drag / sweep to slice fruit.
- Don't slice the bombs 💣, and don't let fruit fall past the bottom.

**Mobile (motion controller):**

1. Open **Settings** and tap **Play on Mobile** — a QR code appears.
2. Scan it with your phone (it must be on the same network / reachable host).
3. Tap **Start** on the phone, then **tilt your phone** to aim the blade.
4. Use the **Recenter** button on the phone to reset the calibration center.

## 📦 Available Commands

| Command               | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `npm install`         | Install project dependencies                              |
| `npm run dev`         | Launch the development server with hot-reload             |
| `npm run build`       | Create a production build in the `dist` folder            |
| `npm run dev-nolog`   | Dev server without the anonymous template log (see below) |
| `npm run build-nolog` | Production build without the anonymous template log       |

## 🗂 Project Structure

```
├── index.html                     # HTML entry point
├── package.json                   # Dependencies + scripts
├── tsconfig.json                  # TypeScript config
├── vite/                          # Vite build config (dev + prod)
└── src/
    ├── main.tsx                   # React entry point
    ├── App.tsx                    # Top-level React component
    ├── PhaserGame.tsx             # React ↔ Phaser bridge component
    ├── MobileController.tsx       # Mobile tilt controller UI (phone side)
    └── game/
        ├── main.ts                # Phaser game config + scene registration
        ├── EventBus.ts            # Event emitter bridging React and Phaser
        └── scenes/
            ├── Boot.ts            # Background load + audio unlock
            ├── Preloader.ts       # Loads all game assets
            ├── MainMenu.ts        # Animated title screen + menu buttons
            ├── Setting.ts         # Music/SFX toggles + mobile QR pairing
            ├── Game.ts            # Core gameplay (spawning, slicing, scoring, HUD)
            ├── GameOver.ts        # Final score, high score, play again
            ├── HighScore.ts       # Persistent high-score store (localStorage)
            ├── GameSettings.ts    # Persistent settings store (localStorage)
            ├── Blade.ts           # Blade trail + swipe segment logic
            ├── DesktopPeer.ts     # PeerJS host (desktop side of mobile pairing)
            └── MobilePeer.ts      # PeerJS client (phone side of mobile pairing)
```

### Scene flow

```
Boot → Preloader → MainMenu → Game → GameOver → (Play Again ⇒ Game | Main Menu)
                 └──→ Setting (music/SFX toggles, mobile pairing)
```

## 🔌 React ↔ Phaser Bridge

The **`PhaserGame.tsx`** component initializes the Phaser game and acts as the bridge between React and Phaser. Communication is handled through the **`EventBus`**:

```ts
// From React
import { EventBus } from "./game/EventBus";
EventBus.emit("my-event", data);

// Inside a Phaser scene
EventBus.on("my-event", (data) => {
    // handle it
});
```

Each scene also emits `"current-scene-ready"` with itself, so React can grab a reference to the currently active scene via the `PhaserGame` ref.

## 🧠 Gameplay Details Worth Knowing

- **Scoring** — each fruit sliced is `+100`; each bomb sliced is `-300` plus a lost heart.
- **Difficulty ramp** — difficulty eases from score `0` to `8000`, scaling fruit speed up to `1.8×` and shortening the spawn interval. The scale uses a smoothstep curve for a natural feel.
- **High score** — stored under the `fruit-ninja-high-score` key in `localStorage`.
- **Settings** — stored under the `fruit-slice-settings` key in `localStorage`.

## About `log.js`

The `dev` and `build` scripts call `log.js`, which makes a single silent, anonymous API call to `gryzor.co` (owned by Phaser Studio Inc.) to report the template name, build type, and Phaser version. No personal data is collected. If you'd rather not send this, use the `-nolog` variants or delete the call from `package.json`.

## 📄 License

This project is built on the [Phaser React TypeScript Template](https://github.com/phaserjs/template-react-ts) and is licensed under the **MIT License**. The Phaser logo and characters are © 2011–2025 Phaser Studio Inc.
