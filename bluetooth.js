// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback, onDisconnectCallback) {
        this.device = null;
        this.server = null;
        this.characteristic = null;
        this.onMove = onMoveCallback;
        this.onDisconnect = onDisconnectCallback;

        this.macAddress = '0C:3D:5E:99:23:29';
        this.ganKey = this.deriveGanKey(this.macAddress);

        // Khai báo sẵn các Service phổ biến để Chrome cho phép truy cập
        this.optionalServices = [
            '0000fff0-0000-1000-8000-00805f9b34fb', // GAN iCarry / i3
            '0000aaaa-0000-1000-8000-00805f9b34fb', // GAN v2 / 12ui
            '0000ffe0-0000-1000-8000-00805f9b34fb', // QiYi / MoYu
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e'  // GoCube
        ];

        window.addEventListener('beforeunload', () => this.disconnect());
        window.addEventListener('pagehide', () => this.disconnect());
    }

    deriveGanKey(mac) {
        const macBytes = mac.split(':').map(hex => parseInt(hex, 16));
        const reversedMac = [...macBytes].reverse();
        const key = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            key[i] = reversedMac[i % 6];
        }
        return key;
    }

    async connect() {
        if (!navigator.bluetooth) {
            alert('Trình duyệt không hỗ trợ Web Bluetooth API!');
            return false;
        }

        try {
            this.disconnect();

            // 1. Quét thiết bị
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: this.optionalServices
            });

            this.device.addEventListener('gattserverdisconnected', () => {
                console.warn('Đã ngắt kết nối Rubik!');
                this.disconnect();
            });

            console.log(`Đang kết nối: ${this.device.name || 'Smart Cube'}`);
            this.server = await this.device.gatt.connect();

            await new Promise(r => setTimeout(r, 300));

            // 2. TỰ ĐỘNG DÒ QUÉT TẤT CẢ SERVICE KHẢ DỤNG
            const services = await this.server.getPrimaryServices();
            
            if (!services || services.length === 0) {
                alert('Không tìm thấy Service nào!\nLý do: Rubik đang bị ghép nối trong Cài đặt Bluetooth Laptop. Hãy Xóa/Remove thiết bị khỏi Cài đặt Laptop rồi thử lại.');
                this.disconnect();
                return false;
            }

            // 3. TỰ ĐỘNG DÒ TÌM CHARACTERISTIC NHẬN DỮ LIỆU XOAY
            for (const service of services) {
                try {
                    const characteristics = await service.getCharacteristics();
                    // Tìm characteristic hỗ trợ notify hoặc indicate
                    const found = characteristics.find(c => c.properties.notify || c.properties.indicate);
                    if (found) {
                        this.characteristic = found;
                        console.log(`✅ Tự động kết nối thành công kênh: ${found.uuid}`);
                        break;
                    }
                } catch (e) {
                    // Tiếp tục thử service khác nếu bị từ chối
                }
            }

            if (!this.characteristic) {
                alert('Không thể bắt được kênh truyền dữ liệu từ Rubik!');
                this.disconnect();
                return false;
            }

            // 4. Kích hoạt nhận dữ liệu real-time
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));
            
            return true;

        } catch (error) {
            console.error('Lỗi Bluetooth:', error);
            this.disconnect();
            if (error.name !== 'NotFoundError') {
                alert('Lỗi Bluetooth: ' + error.message);
            }
            return false;
        }
    }

    disconnect() {
        if (this.device && this.device.gatt && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        this.device = null;
        this.server = null;
        this.characteristic = null;
        if (this.onDisconnect) this.onDisconnect();
    }

    handleData(event) {
        const value = event.target.value;
        if (!value || value.byteLength === 0) return;

        const rawBytes = new Uint8Array(value.buffer);
        const faces = ['U', 'R', 'F', 'D', 'L', 'B'];

        let moveByte = rawBytes[0];
        if (rawBytes.length >= 16) {
            moveByte = rawBytes[12] ^ this.ganKey[0];
        }

        const faceIndex = (moveByte >> 1) & 0x07;
        const direction = moveByte & 0x01;

        if (faceIndex < faces.length) {
            let wcaMove = faces[faceIndex];
            if (direction === 1) wcaMove += "'";
            
            console.log(`GAN Move: ${wcaMove}`);
            if (this.onMove) this.onMove(wcaMove);
        }
    }
}
