import { GameObjects, Scene } from "phaser";

export class MainMenu extends Scene {
    background: GameObjects.Image;
    logo: GameObjects.Image;

    constructor() {
        super("MainMenu");
    }

    create() {
        this.background = this.add
            .image(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                "background",
            )
            .setOrigin(0.5, 0.5)
            .setDepth(0)
            .setDisplaySize(this.cameras.main.width, this.cameras.main.height);

        this.logo = this.add
            .image(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                "logo",
            )
            .setOrigin(0.5)
            .setDepth(100);
    }
}

