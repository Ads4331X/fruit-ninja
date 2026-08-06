import { useEffect, useRef, useState } from "react";
import { connectToDesktop } from "./game/scenes/MobilePeer";

export default function MobileController() {
    const param = new URLSearchParams(window.location.search);
    const peerId = String(param.get("id"));
    const connRef = useRef<any>(null);

    type Status = "connecting" | "connected" | "active";
    const [status, setStatus] = useState<Status>("connecting");

    useEffect(() => {
        async function connect() {
            const result = await connectToDesktop(peerId);
            connRef.current = result;
            setStatus("connected");
        }
        connect();
    }, []);

    async function handleEnableMotion() {
        // iOS requires this permission request, triggered directly by a tap
        if (
            "DeviceOrientationEvent" in window &&
            typeof (window as any).DeviceOrientationEvent.requestPermission ===
                "function"
        ) {
            const permission = await (
                window as any
            ).DeviceOrientationEvent.requestPermission();
            if (permission !== "granted") return;
        }
        setStatus("active");
        // motion listener setup goes here next
    }

    if (status === "connecting") return "Connecting...";
    if (status === "connected")
        return <button onClick={handleEnableMotion}>Tap to Start</button>;
    return "Connected — go slice!";
}

