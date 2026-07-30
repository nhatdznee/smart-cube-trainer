// app.js
import { SmartCubeBluetooth } from './bluetooth.js';
import { CubeTracker } from './cubeLogic.js';
import { randomScrambleForEvent } from 'https://cdn.cubing.net/js/cubing/scramble'; // WCA Official Scrambler
import { Kpuzzle } from 'https://cdn.cubing.net/js/cubing/kpuzzle';

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
let currentScramble = "";
let timerInterval;

// 1. Tạo chuỗi Scramble chuẩn WCA
async function generateScramble() {
    // Tạo scramble 3x3 chuẩn WCA (~20-22 moves)
    const scramble = await randomScrambleForEvent("333");
    currentScramble = scramble.toString();
    ui.scrambleText.innerText = currentScramble;
    
    // Áp dụng scramble vào mô hình 3D
    ui.twistyPlayer.alg = currentScramble;
}

// 2. Vòng lặp Timer UI
function updateTimerUI() {
    if (tracker.isSolving) {
        const now = performance.now();
        const timeElapsed = ((now - tracker.startTime) / 1000).toFixed(3);
        ui.timerDisplay.innerText = timeElapsed;
        
        // Cập nhật thống kê real-time
        const stats = tracker.getStats();
        ui.stats.tps.innerText = stats.tps;
        ui.stats.turns.innerText = stats.turns;
        ui.stats.fluency.innerText = stats.fluency;
        
        requestAnimationFrame(updateTimerUI);
    }
}

// 3. Xử lý khi nhận nước đi từ Smart Cube
function handleCubeMove(move) {
    // A. Áp dụng chuyển động vào mô hình 3D (Đồng bộ Real-time)
    ui.twistyPlayer.experimentalAddMove(move);

    // B. Đưa vào Tracker để tính toán Timer & Split CFOP
    const currentState = ui.twistyPlayer.experimentalCurrentState(); // Lấy trạng thái hiện tại
    tracker.registerMove(move, currentState);

    // C. Cập nhật UI nếu mới bắt đầu giải
    if (tracker.moves === 1) {
        requestAnimationFrame(updateTimerUI);
    }

    // D. Cập nhật Split Time lên màn hình
    ui.splits.cross.innerText = tracker.splits.cross > 0 ? tracker.splits.cross + 's' : '--';
    ui.splits.f2l.innerText = tracker.splits.f2l > 0 ? tracker.splits.f2l + 's' : '--';
    ui.splits.oll.innerText = tracker.splits.oll > 0 ? tracker.splits.oll + 's' : '--';
    ui.splits.pll.innerText = tracker.splits.pll > 0 ? tracker.splits.pll + 's' : '--';

    // E. Nếu giải xong
    if (tracker.phase === 'SOLVED') {
        ui.timerDisplay.innerText = tracker.getFinalTime();
        ui.timerDisplay.style.color = 'var(--success)';
        generateScramble(); // Chuẩn bị ván mới
    }
}

// 4. Khởi tạo Bluetooth & Sự kiện nút bấm
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
        ui.connectBtn.innerText = '❌ Lỗi kết nối. Thử lại';
    }
});

// Chạy lần đầu
generateScramble();