// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback, onDisconnectCallback) {
        this.device = null;
        this.server = null;
        this.characteristic = null;
        this.onMove = onMoveCallback;
        this.onDisconnect = onDisconnectCallback;

        // Địa chỉ MAC khối GAN iCarry của bạn
        this.macAddress = '0C:3D:5E:99:23:29';
        this.ganKey = this.deriveGanKey(this.macAddress);

        // Khai báo các Service UUID của GAN & Fallback
        this.optionalServices = [
            '0000fff0-0000-1000-8000-00805f9b34fb', // GAN iCarry / i3 Service chính
            '0000aaaa-0000-1000-8000-00805f9b34fb', // GAN v2 / 12ui Service
            '0000ffe0-0000-1000-8000-00805f9b34fb', // QiYi / MoYu Fallback
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e'  // GoCube Fallback
        ];

        window.addEventListener('beforeunload', () => this.disconnect());
        window.addEventListener('pagehide', () => this.disconnect());
    }

    // Tạo AES Key 16-byte từ MAC address (Chuẩn GAN Protocol)
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

            // 1. Mở popup quét thiết bị
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: this.optionalServices
            });

            this.device.addEventListener('gattserverdisconnected', () => {
                console.warn('GAN Cube đã ngắt kết nối!');
                if (this.onDisconnect) this.onDisconnect();
            });

            console.log(`Đang kết nối tới: ${this.device.name || 'GAN Cube'}`);
            this.server = await this.device.gatt.connect();

            // Chờ 300ms cho luồng GATT ổn định
            await new Promise(r => setTimeout(r, 300));

            // 2. Định vị Service chính của GAN iCarry
            let service = null;
            try {
                service = await this.server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
            } catch (e) {
                // Dự phòng thử các Service khác nếu là đời GAN mới hơn
                for (const uuid of this.optionalServices) {
                    try {
                        service = await this.server.getPrimaryService(uuid);
                        if (service) break;
                    } catch (err) {}
                }
            }

            if (!service) {
                alert('Không tìm thấy Service của GAN Cube!\nLý do: Rubik đang bị ghép nối trong Cài đặt Bluetooth Laptop. Hãy Xóa/Remove thiết bị khỏi Cài đặt Laptop rồi thử lại.');
                this.disconnect(); // Ngắt kết nối sạch sẽ khi báo lỗi
                return false;
            }

            // 3. Lấy Characteristic fff5 truyền dữ liệu xoay của GAN
            const characteristics = await service.getCharacteristics();
            this.characteristic = characteristics.find(c => 
                c.uuid.includes('fff5') || c.uuid.includes('aaaa-0001') || c.properties.notify || c.properties.indicate
            );

            if (!this.characteristic) {
                alert('Không thể kết nối kênh dữ liệu GAN Cube!');
                this.disconnect(); // Ngắt kết nối sạch sẽ khi báo lỗi
                return false;
            }

            // 4. Kích hoạt nhận dữ liệu real-time
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));
            
            console.log('✅ Đã kết nối thành công kênh truyền dữ liệu GAN iCarry!');
            return true;

        } catch (error) {
            console.error('Lỗi kết nối Bluetooth:', error);
            this.disconnect(); // Ngắt kết nối khi catch bất kỳ lỗi nào
            if (error.name !== 'NotFoundError') {
                alert('Lỗi Bluetooth: ' + error.message);
            }
            return false;
        }
    }

    // Hàm chủ động và tự động ngắt kết nối
    disconnect() {
        if (this.device && this.device.gatt && this.device.gatt.connected) {
            this.device.gatt.disconnect();
            console.log('Đã ngắt kết nối Bluetooth.');
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

        // Parse byte xoay từ GAN iCarry
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
