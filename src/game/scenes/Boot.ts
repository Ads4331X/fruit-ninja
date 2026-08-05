import { Scene } from "phaser";

export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    create() {
        this.add
            .text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                "Fruit Ninja",
                {
                    fontFamily: "Arial Black",
                    fontSize: "48px",
                    color: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 6,
                },
            )
            .setOrigin(0.5);
    }
}

