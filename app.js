// app.js
import { SmartCubeBluetooth } from './bluetooth.js';
import { Cube3D } from './cubeLogic.js';

// Hàm sinh Scramble chuẩn WCA 20 bước
function generateWCAScramble() {
    const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
    const modifiers = ['', "'", '2'];
    const scramble = [];
    let lastFace = '';

    while (scramble.length < 20) {
        const face = faces[Math.floor(Math.random() * faces.length)];
        if (face !== lastFace) {
            const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
            scramble.push(face + modifier);
            lastFace = face;
        }
    }
    return scramble.join(' ');
}

function initApp() {
    console.log('Initializing Smart Cube Trainer...');

    const cube3D = new Cube3D();
    const connectBtn = document.getElementById('btn-connect') || document.getElementById('connectBtn') || document.querySelector('button');
    const calibrateBtn = document.getElementById('calibrateBtn') || document.querySelector('button:nth-of-type(2)');
    const hintsEl = document.querySelector('.hints') || document.getElementById('hints') || document.querySelector('h3');

    // Cập nhật Scramble lên giao diện
    function updateScramble() {
        const newScramble = generateWCAScramble();
        const scrambleDisplay = document.querySelector('h1, h2, header, .scramble') || document.body;
        
        // Tìm phần tử hiển thị scramble trên header
        const headerText = document.querySelector('header') || document.body.firstElementChild;
        if (headerText) {
            headerText.innerHTML = `<h2>${newScramble}</h2>`;
        }
    }

    // 1. Xử lý khi xoay Rubik thật -> Cập nhật 3D Cube
    function handleRealtimeMove(move) {
        console.log('🎯 Realtime move:', move);
        if (cube3D) {
            cube3D.applyMove(move);
        }
    }

    // 2. Xử lý khi Chưa kết nối / Ngắt kết nối
    function handleDisconnect() {
        console.log('Trạng thái: Chưa kết nối Rubik');
        if (cube3D) {
            cube3D.resetToSolved();
        }
        if (connectBtn) {
            connectBtn.textContent = '🔌 Connect Cube';
            connectBtn.classList.remove('connected');
        }
        if (hintsEl) {
            hintsEl.textContent = 'Kết nối Rubik và làm Cross...';
        }
    }

    // 3. Xử lý khi Kết nối thành công
    function handleConnectSuccess() {
        console.log('Trạng thái: ✅ Đã kết nối Rubik!');
        if (connectBtn) {
            connectBtn.textContent = '🚫 Disconnect Cube';
            connectBtn.classList.add('connected');
        }
        if (hintsEl) {
            hintsEl.textContent = '✅ Đã kết nối! Hãy xoay Rubik theo Scramble.';
        }
        // Tự động đổi Scramble mới khi kết nối
        updateScramble();
    }

    const bluetooth = new SmartCubeBluetooth(handleRealtimeMove, handleDisconnect);

    // Nút Connect / Disconnect
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            if (bluetooth.device && bluetooth.device.gatt && bluetooth.device.gatt.connected) {
                bluetooth.disconnect();
            } else {
                connectBtn.textContent = '⏳ Connecting...';
                const success = await bluetooth.connect();
                if (success) {
                    handleConnectSuccess();
                } else {
                    handleDisconnect();
                }
            }
        });
    }

    // NÚT MỚI: Reset / Calibrate 3D Cube khi xoay bị lệch
    if (calibrateBtn) {
        calibrateBtn.addEventListener('click', () => {
            console.log('🔄 Đang Calibrate / Reset mô hình 3D về ban đầu...');
            if (cube3D) {
                cube3D.resetToSolved();
            }
        });
    }

    // Sinh Scramble ban đầu khi mở Web
    updateScramble();
    handleDisconnect();
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
