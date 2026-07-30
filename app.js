// app.js
import { SmartCubeBluetooth } from './bluetooth.js';
import { Cube3D } from './cubeLogic.js';

// Khởi tạo mô hình Rubik 3D
const cube3D = new Cube3D();

// Xử lý khi nhận nước xoay Real-time từ Rubik thật
function handleRealtimeMove(move) {
    console.log('Realtime move:', move);
    if (cube3D.applyMove) {
        cube3D.applyMove(move);
    }
}

// Xử lý khi Ngắt kết nối hoặc chưa kết nối
function handleDisconnect() {
    console.log('Disconnected -> Reset Rubik 3D về trạng thái ban đầu');
    if (cube3D.resetToSolved) {
        cube3D.resetToSolved();
    }
    
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.textContent = '🔌 Connect Cube';
        connectBtn.classList.remove('connected');
    }
}

// Khai báo kết nối Bluetooth
const bluetooth = new SmartCubeBluetooth(handleRealtimeMove, handleDisconnect);

// Sự kiện bấm nút Connect / Disconnect
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

// Đảm bảo ban đầu 3D Rubik luôn ở trạng thái bình thường
handleDisconnect();
