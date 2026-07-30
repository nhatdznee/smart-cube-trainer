// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback, onDisconnectCallback) {
        this.device = null;
        this.server = null;
        this.onMove = onMoveCallback;
        this.onDisconnect = onDisconnectCallback;

        // Địa chỉ MAC khối GAN iCarry của bạn
        this.macAddress = '0C:3D:5E:99:23:29';
        this.ganKey = this.deriveGanKey(this.macAddress);

        // Service UUIDs của GAN
        this.optionalServices = [
            '0000fff0-0000-1000-8000-00805f9b34fb', // GAN Primary Service
            '0000aaaa-0000-1000-8000-00805f9b34fb', // GAN v2 Service
            '0000ffe0-0000-1000-8000-00805f9b34fb', // Fallback QiYi/MoYu
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e'  // Fallback GoCube
        ];

        window.addEventListener('beforeunload', () => this.disconnect());
        window.addEventListener('pagehide', () => this.disconnect());
    }

    // Tạo AES Key 128-bit từ địa chỉ MAC (Thuật toán chuẩn của GAN)
    deriveGanKey(mac) {
        const macBytes = mac.split(':').map(hex => parseInt(hex, 16));
        // Đảo ngược chuỗi MAC byte để khớp với GAN Key Spec
        const reversedMac = [...macBytes].reverse();
        
        // Key 16 bytes lặp lại từ MAC
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

            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: this.optionalServices
            });

            this.device.addEventListener('gattserverdisconnected', () => {
                console.warn('GAN Cube đã ngắt kết nối!');
                if (this.onDisconnect) this.onDisconnect();
            });

            console.log(`Kết nối tới GAN Cube: ${this.device.name}`);
            this.server = await this.device.gatt.connect();

            await new Promise(resolve => setTimeout(resolve, 400));

            let targetCharacteristic = null;

            // Tìm kênh Characteristic giao tiếp của GAN (FFF5 hoặc AAAA-0001)
            for (const uuid of this.optionalServices) {
                try {
                    const service = await this.server.getPrimaryService(uuid);
                    const characteristics = await service.getCharacteristics();
                    
                    const found = characteristics.find(c => 
                        c.properties.notify || c.properties.indicate
                    );
                    
                    if (found) {
                        targetCharacteristic = found;
                        console.log(`✅ Đã kết nối GAN Service: ${uuid}`);
                        break;
                    }
                } catch (e) {
                    // Tiếp tục thử service tiếp theo
                }
            }

            if (!targetCharacteristic) {
                alert('Không thể kết nối kênh dữ liệu GAN Cube!');
                return false;
            }

            await targetCharacteristic.startNotifications();
            targetCharacteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));
            return true;

        } catch (error) {
            console.error('Lỗi Bluetooth:', error);
            if (error.name !== 'NotFoundError') {
                alert('Lỗi GATT GAN Bluetooth:\n1. Đảm bảo đã XÓA/UNPAIR Rubik trong Cài đặt Bluetooth máy tính.\n2. Tắt/bật lại Bluetooth máy tính.');
            }
            return false;
        }
    }

    disconnect() {
        if (this.device && this.device.gatt && this.device.gatt.connected) {
            this.device.gatt.disconnect();
            console.log('Đã ngắt kết nối Bluetooth.');
        }
        this.device = null;
        this.server = null;
    }

    // Giải mã gói tin xoay từ GAN iCarry
    handleData(event) {
        const value = event.target.value;
        if (!value || value.byteLength === 0) return;

        // Byte đầu hoặc cấu trúc gói tin của GAN
        const rawBytes = new Uint8Array(value.buffer);

        // Đọc dữ liệu xoay GAN (Phân tích byte sự kiện)
        const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
        
        // GAN iCarry đệm dữ liệu mặt xoay ở byte thứ 0 hoặc byte thứ 12
        let moveByte = rawBytes[0];
        if (rawBytes.length >= 16) {
            // Nếu là gói mã hóa GAN v2, lấy byte sự kiện xoay
            moveByte = rawBytes[12] ^ this.ganKey[0]; 
        }

        const faceIndex = (moveByte >> 1) & 0x07;
        const direction = moveByte & 0x01;

        if (faceIndex < faces.length) {
            let wcaMove = faces[faceIndex];
            if (direction === 1) wcaMove += "'";
            
            console.log(`GAN Move Detected: ${wcaMove}`);
            if (this.onMove) this.onMove(wcaMove);
        }
    }
}
