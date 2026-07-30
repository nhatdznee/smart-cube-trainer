// app.js
import { SmartCubeBluetooth } from './bluetooth.js';
import { CubeTracker } from './cubeLogic.js';

// Sử dụng gói ESM CDN ổn định cho Scrambler
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

// 1. Tạo chuỗi Scramble WCA
async function generateScramble() {
    try {
        ui.scrambleText.innerText = "Generating scramble...";
        const scramble = await randomScrambleForEvent("333");
        const scrambleStr = scramble.toString();
        ui.scrambleText.innerText = scrambleStr;
        if (ui.twistyPlayer) {
            ui.twistyPlayer.alg = scrambleStr;
        }
    } catch (err) {
        console.error("Lỗi tạo scramble:", err);
        // Fallback chuỗi scramble mặc định nếu mất mạng
        ui.scrambleText.innerText = "D1 F2 U L2 R2 U' B2 U' R2 B2 R2 B' L' R' U' B F' L R2 U'";
    }
}

// 2. Vòng lặp cập nhật Timer UI
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

// 3. Xử lý tín hiệu xoay từ Rubik
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

// 4. Khởi tạo kết nối Bluetooth
const cubeBluetooth = new SmartCubeBluetooth(handleCubeMove);

ui.connectBtn.addEventListener('click', async () => {
    ui.connectBtn.innerText = 'Đang kết nối...';
    const isConnected = await cubeBluetooth.connect();
    if (isConnected) {
        ui.connectBtn.innerText = '✅ Đã kết nối Cube';
        ui.connectBtn.classList.remove('primary');
        ui.connectBtn.classList.add('secondary');
        ui.calibrateBtn.disabled = false;
    } else {
        ui.connectBtn.innerText = '🔌 Connect Cube';
    }
});

// Chạy lần đầu
generateScramble();
