// app.js
import { SmartCubeBluetooth } from './bluetooth.js';
import { CubeTracker } from './cubeLogic.js';
import { randomScrambleForEvent } from 'https://cdn.jsdelivr.net/npm/cubing@0.27.0/scramble/+esm';

const ui = {
    connectBtn: document.getElementById('btn-connect'),
    calibrateBtn: document.getElementById('btn-calibrate'),
    scrambleText: document.getElementById('scramble-text'),
    timerDisplay: document.getElementById('timer'),
    twistyPlayer: document.getElementById('cube-3d'),
    stats: {
        tps: document.getElementById('tps-val'),
        turns: document.getElementById('turns-val'),
        fluency: document.getElementById('fluency-val')
    },
    splits: {
        cross: document.querySelector('#split-cross span'),
        f2l: document.querySelector('#split-f2l span'),
        oll: document.querySelector('#split-oll span'),
        pll: document.querySelector('#split-pll span')
    }
};

let tracker = new CubeTracker();
let isConnectedState = false;

// Callback khi bị ngắt kết nối (chủ động hoặc ngoài ý muốn)
function handleDisconnectUI() {
    isConnectedState = false;
    ui.connectBtn.innerText = '🔌 Connect Cube';
    ui.connectBtn.classList.remove('secondary');
    ui.connectBtn.classList.add('primary');
    ui.calibrateBtn.disabled = true;
}

function handleCubeMove(move) {
    if (ui.twistyPlayer && ui.twistyPlayer.experimentalAddMove) {
        ui.twistyPlayer.experimentalAddMove(move);
    }

    const currentState = ui.twistyPlayer ? ui.twistyPlayer.experimentalCurrentState() : null;
    tracker.registerMove(move, currentState);

    if (tracker.moves === 1) {
        requestAnimationFrame(updateTimerUI);
    }

    ui.splits.cross.innerText = tracker.splits.cross > 0 ? tracker.splits.cross + 's' : '--';
    ui.splits.f2l.innerText = tracker.splits.f2l > 0 ? tracker.splits.f2l + 's' : '--';
    ui.splits.oll.innerText = tracker.splits.oll > 0 ? tracker.splits.oll + 's' : '--';
    ui.splits.pll.innerText = tracker.splits.pll > 0 ? tracker.splits.pll + 's' : '--';

    if (tracker.phase === 'SOLVED') {
        ui.timerDisplay.innerText = tracker.getFinalTime();
        generateScramble();
    }
}

async function generateScramble() {
    try {
        ui.scrambleText.innerText = "Generating scramble...";
        const scramble = await randomScrambleForEvent("333");
        const scrambleStr = scramble.toString();
        ui.scrambleText.innerText = scrambleStr;
        if (ui.twistyPlayer) ui.twistyPlayer.alg = scrambleStr;
    } catch (err) {
        ui.scrambleText.innerText = "D1 F2 U L2 R2 U' B2 U' R2 B2 R2 B' L' R' U' B F' L R2 U'";
    }
}

function updateTimerUI() {
    if (tracker.isSolving) {
        const now = performance.now();
        const timeElapsed = ((now - tracker.startTime) / 1000).toFixed(3);
        ui.timerDisplay.innerText = timeElapsed;
        
        const stats = tracker.getStats();
        ui.stats.tps.innerText = stats.tps;
        ui.stats.turns.innerText = stats.turns;
        ui.stats.fluency.innerText = stats.fluency;
        
        requestAnimationFrame(updateTimerUI);
    }
}

// Khởi tạo Bluetooth class với 2 callback: onMove và onDisconnect
const cubeBluetooth = new SmartCubeBluetooth(handleCubeMove, handleDisconnectUI);

// Xử lý sự kiện click toggle Connect / Disconnect
ui.connectBtn.addEventListener('click', async () => {
    if (isConnectedState) {
        // Nếu đang kết nối -> Ngắt kết nối
        cubeBluetooth.disconnect();
        handleDisconnectUI();
    } else {
        // Nếu chưa kết nối -> Kết nối
        ui.connectBtn.innerText = 'Đang kết nối...';
        const connected = await cubeBluetooth.connect();
        if (connected) {
            isConnectedState = true;
            ui.connectBtn.innerText = '🚫 Disconnect Cube';
            ui.connectBtn.classList.remove('primary');
            ui.connectBtn.classList.add('secondary');
            ui.calibrateBtn.disabled = false;
        } else {
            handleDisconnectUI();
        }
    }
});

generateScramble();
