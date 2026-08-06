import { useEffect, useRef, useState } from "react";
import { connectToDesktop } from "./game/scenes/MobilePeer";

export default function MobileController() {
    const param = new URLSearchParams(window.location.search);
    const peerId = String(param.get("id"));
    const connRef = useRef<any>(null);

    type Status = "connecting" | "connected" | "active" | "try again";
    const [status, setStatus] = useState<Status>("connecting");

    async function connect() {
        setStatus("connecting");
        try {
            const result = await Promise.race([
                connectToDesktop(peerId),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error("connection timed out")),
                        5000,
                    ),
                ),
            ]);
            connRef.current = result;
            setStatus("connected");
        } catch (err) {
            console.error("connection failed:", err);
            setStatus("try again");
        }
    }

    useEffect(() => {
        connect();
    }, []);

    async function handleEnableMotion() {
        if (
            "DeviceOrientationEvent" in window &&
            typeof (window as any).DeviceOrientationEvent.requestPermission ===
                "function"
        ) {
            console.log("requesting permission...");
            const permission = await (
                window as any
            ).DeviceOrientationEvent.requestPermission();
            console.log("permission result:", permission);
            if (permission !== "granted") return;
        } else {
            console.log("requestPermission not available on this device");
        }
        setStatus("active");
        connRef.current.send({ type: "ready" });

        let lastSent = 0;
        let centerGamma: number | null = null;
        let centerBeta: number | null = null;

        function handleOrientation(event: DeviceOrientationEvent) {
            const gamma = event.gamma ?? 0;
            const beta = event.beta ?? 0;

            if (centerGamma === null) {
                centerGamma = gamma;
                centerBeta = beta;
                return;
            }
            const now = Date.now();
            if (now - lastSent < 30) return;
            lastSent = now;

            connRef.current?.send({
                type: "move",
                x: gamma - centerGamma,
                y: beta - (centerBeta as number),
            });
        }

        window.addEventListener("deviceorientation", handleOrientation);
    }

    if (status === "connecting") return "Connecting...";
    if (status === "try again")
        return <button onClick={connect}>Try Again</button>;
    if (status === "connected")
        return <button onClick={handleEnableMotion}>Tap to Start</button>;
    return "Connected — go slice!";
}

