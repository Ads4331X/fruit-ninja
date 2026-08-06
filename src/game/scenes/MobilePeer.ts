import { Peer } from "peerjs";

const mobilePeer = new Peer();
const params = new URLSearchParams(window.location.search);
const peerId = params.get("id");

if (peerId) connectToDesktop(peerId);
export function connectToDesktop(desktopId: string) {
    const connect = () => {
        const conn = mobilePeer.connect(desktopId);

        conn.on("open", () => {
            console.log("Connected!");
        });
    };

    if (mobilePeer.id) {
        connect(); // Peer is already open
    } else {
        mobilePeer.once("open", connect); // Wait for it to open
    }
}

