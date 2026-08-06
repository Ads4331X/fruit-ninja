import MobileController from "./MobileController";
import { PhaserGame } from "./PhaserGame";

const params = new URLSearchParams(window.location.search);
const peerId = params.get("id") || null;

function App() {
    return <div id="app">{peerId ? <MobileController /> : <PhaserGame />}</div>;
}

export default App;
