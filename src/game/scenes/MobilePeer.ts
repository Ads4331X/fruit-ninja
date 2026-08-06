import { Peer } from "peerjs";

const mobilePeer = new Peer();
const params = new URLSearchParams(window.location.search);
const peerId = params.get("id");

if (peerId) connectToDesktop(peerId);
mobilePeer.on("error", (err) => console.log("mobile peer error:", err));
export function connectToDesktop(desktopId: string) {
    const connect = () => {
        const conn = mobilePeer.connect(desktopId);

        conn.on("error", (err) => console.log("conn error:", err));

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

