import { Boot } from "./scenes/Boot";
import { GameOver } from "./scenes/GameOver";
import { Game as MainGame } from "./scenes/Game";
import { MainMenu } from "./scenes/MainMenu";
import { Setting } from "./scenes/Setting";
import { AUTO, Game } from "phaser";
import { Preloader } from "./scenes/Preloader";
import "./scenes/MobilePeer";

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: "game-container",
    scene: [Boot, Preloader, MainMenu, Setting, MainGame, GameOver],
    physics: {
        default: "arcade",
        arcade: {
            gravity: { x: 0, y: 800 }, // pulls fruit back down
            debug: false,
        },
    },
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
