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
                this.cameras.main.height * 0.3,
                "logo",
            )
            .setOrigin(0.5)
            .setDepth(100);

        this.createMenuButton(
            this.cameras.main.centerX,
            this.cameras.main.height * 0.6,
            "PLAY",
            () => this.scene.start("Game"),
        );

        this.createMenuButton(
            this.cameras.main.centerX,
            this.cameras.main.height * 0.72,
            "SETTINGS",
            () => this.scene.start("Setting"),
        );
    }

    private createMenuButton(
        x: number,
        y: number,
        label: string,
        onClick: () => void,
    ) {
        const button = this.add
            .text(x, y, label, {
                fontFamily: "Arial Black",
                fontSize: "32px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 5,
            })
            .setOrigin(0.5)
            .setDepth(100)
            .setInteractive({ useHandCursor: true });

        button.on("pointerover", () => button.setScale(1.1));
        button.on("pointerout", () => button.setScale(1));
        button.on("pointerdown", onClick);
    }
}

