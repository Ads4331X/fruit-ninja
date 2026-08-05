import { Scene } from "phaser";

export class Preloader extends Scene {
    constructor() {
        super("Preloader");
    }

    init() {
        this.add
            .image(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                "background",
            )
            .setOrigin(0.5, 0.5)
            .setDepth(0)
            .setDisplaySize(this.cameras.main.width, this.cameras.main.height);
    }

    preload() {
        this.load.setPath("assets/test");
        this.load.image("watermelon", "watermelon.png");
        this.load.image("pineapple", "pineapple.png");
        this.load.image("apple", "apple.png");
        this.load.image("banana", "banana.png");
        this.load.image("coconut", "coconut.png");
        this.load.image("orange", "orange.png");
        this.load.image("bomb", "bomb.png");

        this.load.image("apple_half_1", "apple_half_1.png");
        this.load.image("apple_half_2", "apple_half_2.png");
        this.load.image("banana_half_1", "banana_half_1.png");
        this.load.image("banana_half_2", "banana_half_2.png");
        this.load.image("orange_half_1", "orange_half_1.png");
        this.load.image("orange_half_2", "orange_half_2.png");
        this.load.image("coconut_half_1", "coconut_half_1.png");
        this.load.image("coconut_half_2", "coconut_half_2.png");
        this.load.image("watermelon_half_1", "watermelon_half_1.png");
        this.load.image("watermelon_half_2", "watermelon_half_2.png");
        this.load.image("pineapple_half_1", "pineapple_half_1.png");
        this.load.image("pineapple_half_2", "pineapple_half_2.png");

        this.load.image("splash_red", "splash_red.png");
        this.load.image("splash_yellow", "splash_yellow.png");
        this.load.image("splash_orange", "splash_orange.png");
        this.load.image("splash_transparent", "splash_transparent.png");

        this.load.image("explosion", "explosion.png");

        this.load.setPath("assets");
        this.load.image("heart_full", "heart.png");
        this.load.image("heart_empty", "empty_heart.png");
        this.load.image("logo", "logo.png");

        this.load.on("loaderror", (file: Phaser.Loader.File) => {
            console.error(
                `[Preloader] FAILED to load "${file.key}" from: ${file.src}`,
            );
        });
    }

    create() {
        this.scene.start("MainMenu");
    }
}

