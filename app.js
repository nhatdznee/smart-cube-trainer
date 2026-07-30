// app.js
import { SmartCubeBluetooth } from './bluetooth.js';
import { Cube3D } from './cubeLogic.js'; // Hoặc class quản lý 3D của bạn

// Khởi tạo mô hình Rubik 3D
const cube3D = new Cube3D();

// Xử lý khi nhận nước xoay Real-time từ Rubik thật
function handleRealtimeMove(move) {
    console.log('Xoay real-time:', move);
    cube3D.applyMove(move); // Cập nhật màn hình theo real-time
}

// Xử lý khi Ngắt kết nối hoặc chưa kết nối
function handleDisconnect() {
    console.log('Đã ngắt kết nối -> Reset Rubik 3D về trạng thái ban đầu');
    cube3D.resetToSolved(); // Đưa Rubik 3D về trạng thái bình thường chuẩn
    
    // Cập nhật giao diện nút bấm
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

// Đảm bảo khi mới vào trang (chưa kết nối), 3D Rubik luôn ở trạng thái bình thường
handleDisconnect();
