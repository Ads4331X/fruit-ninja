import Peer from "peerjs";

// Desktop-side PeerJS host.
let desktopPeer = new Peer();
let desktopID = "";

desktopPeer.on("open", (id) => {
    desktopID = id;
});

desktopPeer.on("error", (err) => console.log("desktop peer error:", err));

export function getPeerID(): Promise<string> {
    return new Promise((resolve) => {
        if (desktopID) {
            resolve(desktopID);
            return;
        }

        desktopPeer.on("open", (id) => {
            resolve(id);
        });
    });
}

// Blade position as a 0-1 fraction of the mobile touchpad area.
export const bladePosition = { x: 0.5, y: 0.5 };
export let isMobileConnected = false;

/** Reset the blade back to the center of the screen (0.5, 0.5). */
export function resetBladePosition() {
    bladePosition.x = 0.5;
    bladePosition.y = 0.5;
}

export function setMobileConnected(value: boolean) {
    isMobileConnected = value;
}

export function onMobileConnected(callback: (conn: any) => void) {
    desktopPeer.on("connection", (conn) => {
        conn.on("open", () => {
            conn.on("data", (data: any) => {
                if (data?.type === "ready") {
                    isMobileConnected = true;
                    callback(conn);
                } else if (data?.type === "move") {
                    bladePosition.x = data.x;
                    bladePosition.y = data.y;
                }
            });
        });
    });
}

