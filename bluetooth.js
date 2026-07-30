// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback) {
        this.device = null;
        this.server = null;
        this.onMove = onMoveCallback;
        
        // Danh sách mở rộng Service UUIDs của các dòng Smart Cube
        this.optionalServices = [
            '0000fff0-0000-1000-8000-00805f9b34fb', // GAN Gen 1 / Giiker
            '0000ffe0-0000-1000-8000-00805f9b34fb', // QiYi / MoYu / MG356
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // GoCube / Rubik's Connected
            '0000aaaa-0000-1000-8000-00805f9b34fb', // GAN i / i2 / i3 / i Carry / 12 ui
            '0000aab0-0000-1000-8000-00805f9b34fb', // QiYi Smart Cube v2
            '0000180a-0000-1000-8000-00805f9b34fb', // Device Info Standard
            '0000180f-0000-1000-8000-00805f9b34fb'  // Battery Service
        ];
    }

    async connect() {
        if (!navigator.bluetooth) {
            alert('Trình duyệt không hỗ trợ Web Bluetooth API!');
            return false;
        }

        try {
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: this.optionalServices
            });

            this.device.addEventListener('gattserverdisconnected', () => {
                console.warn('Smart Cube đã ngắt kết nối!');
            });

            this.server = await this.device.gatt.connect();

            let targetCharacteristic = null;

            // Cách 1: Thử tự động lấy TẤT CẢ Primary Services từ thiết bị
            try {
                const services = await this.server.getPrimaryServices();
                for (const service of services) {
                    try {
                        const characteristics = await service.getCharacteristics();
                        const found = characteristics.find(c => c.properties.notify || c.properties.indicate);
                        if (found) {
                            targetCharacteristic = found;
                            break;
                        }
                    } catch (err) {
                        continue;
                    }
                }
            } catch (e) {
                console.log("Không thể quét tự động toàn bộ services, chuyển sang danh sách fallback...");
            }

            // Cách 2: Fallback quét theo mảng optionalServices nếu Cách 1 bị trình duyệt chặn
            if (!targetCharacteristic) {
                for (const uuid of this.optionalServices) {
                    try {
                        const service = await this.server.getPrimaryService(uuid);
                        const characteristics = await service.getCharacteristics();
                        const found = characteristics.find(c => c.properties.notify || c.properties.indicate);
                        if (found) {
                            targetCharacteristic = found;
                            break;
                        }
                    } catch (e) {
                        // Tiếp tục thử UUID khác
                    }
                }
            }

            if (!targetCharacteristic) {
                alert('Đã kết nối nhưng không tìm thấy kênh dữ liệu tương thích!\nHãy kiểm tra lại mẫu Rubik bạn đang sử dụng.');
                return false;
            }

            // Đăng ký nhận tín hiệu real-time
            await targetCharacteristic.startNotifications();
            targetCharacteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));
            return true;

        } catch (error) {
            console.error('Lỗi Bluetooth:', error);
            if (error.name !== 'NotFoundError') {
                alert('Lỗi Bluetooth: ' + error.message);
            }
            return false;
        }
    }

    handleData(event) {
        const value = event.target.value;
        if (!value || value.byteLength === 0) return;

        const moveData = value.getUint8(0);
        const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
        const faceIndex = (moveData >> 1) & 0x07;
        const direction = moveData & 0x01;

        if (faceIndex < faces.length) {
            let wcaMove = faces[faceIndex];
            if (direction === 1) wcaMove += "'";
            if (this.onMove) this.onMove(wcaMove);
        }
    }
}
