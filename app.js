import { SmartCubeBluetooth } from './bluetooth.js';
import { Cube3D } from './cubeLogic.js';

// Khởi tạo 3D Rubik
const cube3D = new Cube3D();

// Xử lý khi có bước xoay Real-time từ khối Rubik thật
function handleRealtimeMove(move) {
    console.log('Xoay real-time:', move);
    if (cube3D && typeof cube3D.applyMove === 'function') {
        cube3D.applyMove(move);
    }
}

// Xử lý khi ngắt kết nối hoặc chưa kết nối
function handleDisconnect() {
    console.log('Trạng thái: Chưa/Ngắt kết nối -> Reset Rubik 3D về mặc định');
    if (cube3D && typeof cube3D.resetToSolved === 'function') {
        cube3D.resetToSolved();
    }

    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.textContent = '🔌 Connect Cube';
        connectBtn.classList.remove('connected');
    }
}

// Khởi tạo đối tượng Bluetooth
const bluetooth = new SmartCubeBluetooth(handleRealtimeMove, handleDisconnect);

// Gán sự kiện cho nút Connect / Disconnect
const connectBtn = document.getElementById('connectBtn');
if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
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
}

// Trạng thái ban đầu khi chưa bấm kết nối
handleDisconnect();
