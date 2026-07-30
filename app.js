// app.js
import { SmartCubeBluetooth } from './bluetooth.js';
import { Cube3D } from './cubeLogic.js';

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM ready, initializing Smart Cube Trainer...');

    const cube3D = new Cube3D();

    // Tìm nút bấm hỗ trợ cả 2 ID 'btn-connect' và 'connectBtn'
    const connectBtn = document.getElementById('btn-connect') || document.getElementById('connectBtn');

    if (!connectBtn) {
        console.error('❌ Không tìm thấy nút Connect trong index.html! Hãy kiểm tra thẻ <button>');
        return;
    }

    function handleRealtimeMove(move) {
        console.log('Realtime move:', move);
        if (cube3D && typeof cube3D.applyMove === 'function') {
            cube3D.applyMove(move);
        }
    }

    function handleDisconnect() {
        console.log('Disconnected -> Reset Rubik 3D');
        if (cube3D && typeof cube3D.resetToSolved === 'function') {
            cube3D.resetToSolved();
        }
        if (connectBtn) {
            connectBtn.textContent = '🔌 Connect Cube';
            connectBtn.classList.remove('connected');
        }
    }

    const bluetooth = new SmartCubeBluetooth(handleRealtimeMove, handleDisconnect);

    connectBtn.addEventListener('click', async () => {
        console.log('Bấm nút Connect Cube...');
        if (bluetooth.device && bluetooth.device.gatt && bluetooth.device.gatt.connected) {
            bluetooth.disconnect();
        } else {
            connectBtn.textContent = '⏳ Connecting...';
            const success = await bluetooth.connect();
            if (success) {
                connectBtn.textContent = '🚫 Disconnect Cube';
                connectBtn.classList.add('connected');
            } else {
                handleDisconnect();
            }
        }
    });

    handleDisconnect();
});
