import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import * as Phaser from "phaser";
import { Blade } from "./Blade";

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

    private heartIcons: Phaser.GameObjects.Image[] = [];

    private blade!: Blade;
    private isPointerDown = false;

    private fruitKeys = [
        "apple",
        "banana",
        "orange",
        "coconut",
        "watermelon",
        "pineapple",
    ];

    private hazardKeys = ["bomb"];

    private spawnables!: Phaser.Physics.Arcade.Group;

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

        this.time.addEvent({
            delay: 1000,
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

        EventBus.emit("current-scene-ready", this);
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

            if (this.isPointerDown || pointer.isDown) {
                this.checkSlice();
            }
        });
    }

    private hideSystemCursor() {
        this.input.setDefaultCursor("none");
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
            this.changeScene();
        }
    }

    // ------------------------------------------------------------------
    // FRUIT SPAWNING
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

        const worldGravityY = this.physics.world.gravity.y || 800;

        const minPeakFraction = 0.6;
        const maxPeakFraction = 1;
        const targetPeakHeight =
            height * Phaser.Math.FloatBetween(minPeakFraction, maxPeakFraction);

        const upwardSpeed = Math.sqrt(2 * worldGravityY * targetPeakHeight);

        const maxSideways = Math.min(width * 0.12, 150);
        const sidewaysSpeed = Phaser.Math.Between(-maxSideways, maxSideways);

        item.setVelocity(sidewaysSpeed, -upwardSpeed);
        item.setAngularVelocity(Phaser.Math.Between(-200, 200));

        item.setData("checkOffscreen", true);
        item.setData("sliced", false);
        item.setData("isHazard", isBomb);
    }

    update(_time: number, delta: number) {
        this.blade.update(delta);

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

