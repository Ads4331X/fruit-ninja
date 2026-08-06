import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import * as Phaser from "phaser";
import { Blade } from "./Blade";
import { GameSettings } from "./GameSettings";
import { bladePosition, isMobileConnected } from "./DesktopPeer";

function segmentIntersectsCircle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cx: number,
    cy: number,
    radius: number,
): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
        const distSq = (cx - x1) ** 2 + (cy - y1) ** 2;
        return distSq <= radius * radius;
    }

    let t = ((cx - x1) * dx + (cy - y1) * dy) / lengthSq;
    t = Phaser.Math.Clamp(t, 0, 1);

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    const distSq = (cx - closestX) ** 2 + (cy - closestY) ** 2;
    return distSq <= radius * radius;
}

const SPLASH_COLOR_MAP: Record<string, string> = {
    apple: "splash_red",
    watermelon: "splash_red",
    banana: "splash_yellow",
    pineapple: "splash_yellow",
    orange: "splash_orange",
    coconut: "splash_transparent",
};

export class Game extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    scoreText: Phaser.GameObjects.Text;
    healthBar: number = 3;
    maxHealth: number = 3;
    score: number = 0;

    // private lastMobileX: number | null = null;
    // private lastMobileY: number | null = null;
    // private lastMobileMoveTime = 0;

    private heartIcons: Phaser.GameObjects.Image[] = [];

    private blade!: Blade;
    private isPointerDown = false;
    private bgm!: Phaser.Sound.BaseSound;
    private unsubscribeSettings?: () => void;

    private lastWhooshTime = 0;
    private whooshCooldown = 250;
    private minSwipeSpeed = 300;

    private fruitKeys = [
        "apple",
        "banana",
        "orange",
        "coconut",
        "watermelon",
        "pineapple",
    ];

    private hazardKeys = ["bomb"];

    private sliceKeys = ["slice1", "slice2", "slice3", "slice4"];
    private splatterKeys = ["splatter1", "splatter2"];

    private fruitImpactMap: Record<string, string> = {
        apple: "impact_apple",
        banana: "impact_banana",
        orange: "impact_orange",
        coconut: "impact_coconut",
        watermelon: "impact_watermelon",
        pineapple: "impact_pineapple",
    };

    private spawnTimer!: Phaser.Time.TimerEvent;

    // Dedicated group for fruits/bombs only, so slice-detection and the
    // offscreen check don't have to scan every object in the scene
    // (background, text, hearts, splash/half decorations, etc).
    private spawnables!: Phaser.Physics.Arcade.Group;

    // ------------------------------------------------------------------
    // DIFFICULTY SCALING CONFIG
    // ------------------------------------------------------------------
    // Score at which difficulty reaches its maximum (100% ramped).
    private difficultyRampScore = 8000;
    // How much faster fruits move (launch/fall speed) at max difficulty.
    private maxSpeedMultiplier = 1.8;
    // Spawn cadence: starts at baseSpawnDelay ms, eases down to minSpawnDelay ms.
    private baseSpawnDelay = 1000;
    private minSpawnDelay = 420;

    constructor() {
        super("Game");
    }

    create() {
        this.camera = this.cameras.main;

        this.background = this.add
            .image(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                "background",
            )
            .setOrigin(0.5, 0.5)
            .setDepth(0)
            .setDisplaySize(this.cameras.main.width, this.cameras.main.height);

        this.spawnables = this.physics.add.group();

        this.spawnTimer = this.time.addEvent({
            delay: this.baseSpawnDelay,
            loop: true,
            callback: () => this.spawnFruit(),
        });

        this.scoreText = this.add
            .text(10, 10, `Score: ${this.score}`)
            .setColor("Yellow")
            .setScale(1.4)
            .setDepth(200);

        this.createHealthBar();

        this.blade = new Blade(this);
        this.setupBladeInput();
        this.hideSystemCursor();

        this.playSfx("game_start", { volume: 0.7 });

        if (this.cache.audio.exists("bgm")) {
            this.bgm = this.sound.add("bgm", { loop: true, volume: 0.35 });
            this.bgm.play();
            this.applyMusicMute();
        }

        // Keep bgm mute state in sync if the player changes it from the
        // Settings scene (or anywhere else) while this scene is active.
        this.unsubscribeSettings = GameSettings.onChange(() =>
            this.applyMusicMute(),
        );
        this.events.once("shutdown", () => this.unsubscribeSettings?.());

        EventBus.emit("current-scene-ready", this);
    }

    // ------------------------------------------------------------------
    // AUDIO / SETTINGS
    // ------------------------------------------------------------------
    /** Plays a one-shot sound effect, respecting the sfx mute setting. */
    private playSfx(key: string, config?: Phaser.Types.Sound.SoundConfig) {
        if (GameSettings.sfxMuted) return;
        if (this.cache.audio.exists(key)) {
            this.sound.play(key, config);
        }
    }

    private applyMusicMute() {
        if (this.bgm && "setMute" in this.bgm) {
            (this.bgm as Phaser.Sound.WebAudioSound).setMute(
                GameSettings.musicMuted,
            );
        }
    }

    // ------------------------------------------------------------------
    // DIFFICULTY
    // ------------------------------------------------------------------
    /** 0 -> 1 progress toward max difficulty, eased with smoothstep for a gradual ramp. */
    private getDifficultyProgress(): number {
        const raw = Phaser.Math.Clamp(
            this.score / this.difficultyRampScore,
            0,
            1,
        );
        return raw * raw * (3 - 2 * raw); // smoothstep easing
    }

    /** Multiplier applied to fruit launch/fall speed. 1 = base speed. */
    private getSpeedMultiplier(): number {
        const t = this.getDifficultyProgress();
        return 1 + t * (this.maxSpeedMultiplier - 1);
    }

    /** Spawn timer delay in ms, eased down as difficulty increases. */
    private getSpawnDelay(): number {
        const t = this.getDifficultyProgress();
        return Phaser.Math.Linear(this.baseSpawnDelay, this.minSpawnDelay, t);
    }

    /**
     * TimerEvent.delay is read-only in current Phaser versions, so instead
     * we scale how fast the timer's internal clock progresses via timeScale.
     * timeScale = baseSpawnDelay / desiredDelay, e.g. desiredDelay shrinking
     * toward minSpawnDelay makes timeScale grow above 1, firing more often.
     */
    private applySpawnRate() {
        const desiredDelay = this.getSpawnDelay();
        this.spawnTimer.timeScale = this.baseSpawnDelay / desiredDelay;
    }

    // ------------------------------------------------------------------
    // BLADE INPUT
    // ------------------------------------------------------------------
    private setupBladeInput() {
        this.input.on("pointerdown", () => {
            this.isPointerDown = true;
        });

        this.input.on("pointerup", () => {
            this.isPointerDown = false;
        });

        this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            this.blade.addPoint(pointer.x, pointer.y);

            if (pointer.isDown) {
                this.tryPlayWhoosh(pointer);
            }

            if (this.isPointerDown || pointer.isDown) {
                this.checkSlice();
            }
        });
    }

    private updateBladeFromMobile() {
        if (!isMobileConnected) return;

        const { width, height } = this.cameras.main;
        const maxTilt = 45;
        const clampedX = Phaser.Math.Clamp(bladePosition.x, -maxTilt, maxTilt);
        const clampedY = Phaser.Math.Clamp(bladePosition.y, -maxTilt, maxTilt);

        const screenX = width / 2 + (clampedX / maxTilt) * (width / 2);
        const screenY = height / 2 - (clampedY / maxTilt) * (height / 2);

        this.blade.addPoint(screenX, screenY);
        this.checkSlice();
    }

    private hideSystemCursor() {
        this.input.setDefaultCursor("none");
    }

    private tryPlayWhoosh(pointer: Phaser.Input.Pointer) {
        const now = this.time.now;
        if (now - this.lastWhooshTime < this.whooshCooldown) return;

        const speed = Math.hypot(pointer.velocity.x, pointer.velocity.y);
        if (speed < this.minSwipeSpeed) return;

        this.lastWhooshTime = now;

        const whooshKey = Phaser.Utils.Array.GetRandom(this.sliceKeys);
        this.playSfx(whooshKey, { volume: 0.3 });
    }

    private checkSlice() {
        const segment = this.blade.getLatestSegment();
        if (!segment) return;

        this.spawnables.getChildren().forEach((child) => {
            const obj = child as Phaser.Physics.Arcade.Image;
            if (!obj.active) return;
            if (obj.getData("sliced")) return;

            const radius = Math.max(obj.displayWidth, obj.displayHeight) / 2.5;

            const hit = segmentIntersectsCircle(
                segment.x1,
                segment.y1,
                segment.x2,
                segment.y2,
                obj.x,
                obj.y,
                radius,
            );

            if (hit) {
                const isBomb = obj.getData("isHazard");
                const sliceDx = segment.x2 - segment.x1;
                const sliceDy = segment.y2 - segment.y1;

                if (isBomb) {
                    this.sliceBomb(obj);
                } else {
                    this.sliceFruit(obj, sliceDx, sliceDy);
                }
            }
        });
    }

    private sliceFruit(
        fruit: Phaser.Physics.Arcade.Image,
        sliceDx: number,
        sliceDy: number,
    ) {
        fruit.setData("sliced", true);
        this.increaseScore();

        const fruitKey = fruit.texture.key;

        const sliceSound = Phaser.Utils.Array.GetRandom(this.sliceKeys);
        this.playSfx(sliceSound, { volume: 0.5 });

        const impactKey = this.fruitImpactMap[fruitKey];
        if (impactKey) {
            this.playSfx(impactKey, { volume: 0.6 });
        }

        const splatterSound = Phaser.Utils.Array.GetRandom(this.splatterKeys);
        this.time.delayedCall(40, () => {
            this.playSfx(splatterSound, { volume: 0.4 });
        });

        const x = fruit.x;
        const y = fruit.y;
        const currentVelocity =
            fruit.body?.velocity ?? new Phaser.Math.Vector2(0, 0);
        const currentAngle = fruit.angle;
        const scale = fruit.scale;

        this.spawnSplash(fruitKey, x, y, scale);
        this.spawnFruitHalves(
            fruitKey,
            x,
            y,
            currentVelocity,
            currentAngle,
            scale,
            sliceDx,
            sliceDy,
        );

        fruit.destroy();
    }

    private spawnFruitHalves(
        fruitKey: string,
        x: number,
        y: number,
        inheritedVelocity: Phaser.Math.Vector2,
        angle: number,
        scale: number,
        sliceDx: number,
        sliceDy: number,
    ) {
        const half1Key = `${fruitKey}_half_1`;
        const half2Key = `${fruitKey}_half_2`;

        if (
            !this.textures.exists(half1Key) ||
            !this.textures.exists(half2Key)
        ) {
            console.warn(`[Game] missing half textures for "${fruitKey}"`);
            return;
        }

        const len = Math.hypot(sliceDx, sliceDy) || 1;
        const perpX = -sliceDy / len;
        const perpY = sliceDx / len;

        const separationSpeed = 220;

        const half1 = this.physics.add
            .image(x, y, half1Key)
            .setScale(scale)
            .setAngle(angle)
            .setDepth(18);
        half1.setVelocity(
            inheritedVelocity.x + perpX * separationSpeed,
            inheritedVelocity.y + perpY * separationSpeed - 100,
        );
        half1.setAngularVelocity(Phaser.Math.Between(-150, 150));

        const half2 = this.physics.add
            .image(x, y, half2Key)
            .setScale(scale)
            .setAngle(angle)
            .setDepth(18);
        half2.setVelocity(
            inheritedVelocity.x - perpX * separationSpeed,
            inheritedVelocity.y - perpY * separationSpeed - 100,
        );
        half2.setAngularVelocity(Phaser.Math.Between(-150, 150));

        [half1, half2].forEach((half) => {
            this.tweens.add({
                targets: half,
                alpha: 0,
                delay: 500,
                duration: 400,
                onComplete: () => half.destroy(),
            });
        });
    }

    private spawnSplash(
        fruitKey: string,
        x: number,
        y: number,
        fruitScale: number,
    ) {
        const splashKey = SPLASH_COLOR_MAP[fruitKey] ?? "splash_transparent";

        if (!this.textures.exists(splashKey)) return;

        const splashScale = fruitScale * 1.6;

        const splash = this.add
            .image(x, y, splashKey)
            .setScale(splashScale * 0.4)
            .setAlpha(0.9)
            .setAngle(Phaser.Math.Between(0, 360))
            .setDepth(12);

        this.tweens.add({
            targets: splash,
            scale: splashScale,
            duration: 120,
            ease: "Back.easeOut",
        });

        this.tweens.add({
            targets: splash,
            alpha: 0,
            delay: 250,
            duration: 400,
            ease: "Sine.easeOut",
            onComplete: () => splash.destroy(),
        });
    }

    private sliceBomb(bomb: Phaser.Physics.Arcade.Image) {
        bomb.setData("sliced", true);

        this.playSfx("bomb_explode", { volume: 0.9 });

        // duck bgm briefly so the explosion cuts through clearly
        if (this.bgm && "setVolume" in this.bgm) {
            const webAudioBgm = this.bgm as Phaser.Sound.WebAudioSound;
            webAudioBgm.setVolume(0.1);
            this.time.delayedCall(600, () => {
                if (this.bgm.isPlaying) webAudioBgm.setVolume(0.35);
            });
        }

        const bombPenalty = 300;
        this.score -= bombPenalty;
        this.scoreText.setText(`Score: ${this.score}`);

        this.cameras.main.shake(200, 0.01);
        this.decreaseHealth();

        const explosion = this.add
            .image(bomb.x, bomb.y, "explosion")
            .setScale(0.3)
            .setDepth(20);

        this.tweens.add({
            targets: explosion,
            scale: explosion.scale * 1.8,
            alpha: 0,
            duration: 350,
            ease: "Sine.easeOut",
            onComplete: () => explosion.destroy(),
        });

        bomb.destroy();
    }

    // ------------------------------------------------------------------
    // HEALTH BAR
    // ------------------------------------------------------------------
    createHealthBar() {
        const { width, height } = this.cameras.main;

        const marginTop = height * 0.02;
        const rightOffset = width * 0.015;

        const heartSizeFraction = 0.06;
        const heartSize = width * heartSizeFraction;

        this.heartIcons = [];

        for (let i = 0; i < this.maxHealth; i++) {
            const slotX = width + rightOffset - i * marginTop * 2;

            const heart = this.add
                .image(slotX, marginTop, "heart_full")
                .setOrigin(1, 0)
                .setDisplaySize(heartSize, heartSize)
                .setScrollFactor(0)
                .setDepth(200);

            this.heartIcons.push(heart);
        }
    }

    updateHealthBar() {
        this.heartIcons.forEach((heart, i) => {
            heart.setTexture(i < this.healthBar ? "heart_full" : "heart_empty");
        });
    }

    increaseScore() {
        this.score += 100;
        this.scoreText.setText(`Score: ${this.score}`);
    }

    decreaseScore() {
        this.score -= 500;
        this.scoreText.setText(`Score: ${this.score}`);
        this.decreaseHealth();
    }

    decreaseHealth() {
        this.healthBar--;
        this.updateHealthBar();

        if (this.healthBar <= 0) {
            this.playSfx("game_over", { volume: 0.8 });
            this.bgm?.stop();
            this.changeScene();
        }
    }

    // ------------------------------------------------------------------
    // FRUIT + BOMB SPAWNING
    // ------------------------------------------------------------------
    spawnFruit() {
        const { width, height } = this.cameras.main;

        const margin = Math.max(width * 0.08, 100);
        const x = Phaser.Math.Between(margin, width - margin);
        const y = height + 50;

        const bombChance = 0.15;
        const isBomb = Math.random() < bombChance;

        const key = isBomb
            ? Phaser.Utils.Array.GetRandom(this.hazardKeys)
            : Phaser.Utils.Array.GetRandom(this.fruitKeys);

        const item = this.physics.add.image(x, y, key).setScale(0.3);
        this.spawnables.add(item);

        // --- Difficulty-scaled speed, height stays capped exactly as before ---
        const speedMultiplier = this.getSpeedMultiplier();
        const worldGravityY = this.physics.world.gravity.y || 800;
        const effectiveGravityY = worldGravityY * speedMultiplier;

        const minPeakFraction = 0.6;
        const maxPeakFraction = 1;
        const targetPeakHeight =
            height * Phaser.Math.FloatBetween(minPeakFraction, maxPeakFraction);

        // h = v^2 / (2g). Solving for v using the SAME targetPeakHeight while
        // gravity is scaled up keeps the max spawn/peak height unchanged, but
        // makes the whole arc (ascent + descent) play out faster.
        const upwardSpeed = Math.sqrt(2 * effectiveGravityY * targetPeakHeight);

        const maxSideways = Math.min(width * 0.12, 150);
        const sidewaysSpeed =
            Phaser.Math.Between(-maxSideways, maxSideways) * speedMultiplier;

        item.setVelocity(sidewaysSpeed, -upwardSpeed);
        item.setAngularVelocity(Phaser.Math.Between(-200, 200));

        // Arcade Physics adds body gravity ON TOP of world gravity, so only
        // set the extra amount needed to reach effectiveGravityY overall.
        item.setGravityY(effectiveGravityY - worldGravityY);

        item.setData("checkOffscreen", true);
        item.setData("sliced", false);
        item.setData("isHazard", isBomb);

        // Ramp spawn cadence smoothly with difficulty too ("overall game speed").
        this.applySpawnRate();
    }

    update(_time: number, delta: number) {
        this.blade.update(delta);
        this.updateBladeFromMobile();

        this.spawnables.getChildren().forEach((child) => {
            const obj = child as Phaser.Physics.Arcade.Image;
            if (!obj.active) return;

            if (obj.y > this.cameras.main.height + 100) {
                const wasSliced = obj.getData("sliced");
                const isHazard = obj.getData("isHazard");

                if (!wasSliced && !isHazard) {
                    this.decreaseScore();
                }

                obj.destroy();
            }
        });
    }

    changeScene() {
        this.scene.start("GameOver");
    }
}

