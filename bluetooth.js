// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback) {
        this.device = null;
        this.server = null;
        this.onMove = onMoveCallback;
        
        // Danh sách mở rộng toàn bộ Service UUIDs của các dòng Smart Cube hiện nay
        this.optionalServices = [
            // GAN Cubes (GAN i3, iCarry, iCarry2, 12 ui, 13 ui, Monster Go 3i, GAN Gen 1/2)
            '0000fff0-0000-1000-8000-00805f9b34fb',
            '0000aaaa-0000-1000-8000-00805f9b34fb',
            '0000fff3-0000-1000-8000-00805f9b34fb',
            '0000ffb0-0000-1000-8000-00805f9b34fb',
            
            // QiYi / MoYu / NexCube / Smart v1 & v2
            '0000ffe0-0000-1000-8000-00805f9b34fb',
            '0000aab0-0000-1000-8000-00805f9b34fb',
            '0000ffff-0000-1000-8000-00805f9b34fb',
            '00001000-0000-1000-8000-00805f9b34fb',
            '0000a000-0000-1000-8000-00805f9b34fb',

            // Giiker / SuperCube
            '0000aadc-0000-1000-8000-00805f9b34fb',

            // GoCube / Rubik's Connected (Nordic UART Service)
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e',

            // Standard Bluetooth Services
            '0000180a-0000-1000-8000-00805f9b34fb',
            '0000180f-0000-1000-8000-00805f9b34fb',
            '00001800-0000-1000-8000-00805f9b34fb',
            '00001801-0000-1000-8000-00805f9b34fb'
        ];
    }

    async connect() {
        if (!navigator.bluetooth) {
            alert('Trình duyệt không hỗ trợ Web Bluetooth API!');
            return false;
        }

        try {
            // Yêu cầu kết nối thiết bị Bluetooth
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: this.optionalServices
            });

            this.device.addEventListener('gattserverdisconnected', () => {
                console.warn('Smart Cube đã ngắt kết nối!');
            });

            console.log(`Đã chọn thiết bị: ${this.device.name || 'Smart Cube'}`);
            this.server = await this.device.gatt.connect();

            let targetCharacteristic = null;

            // Quét an toàn lần lượt từng Service trong danh sách optionalServices đã đăng ký
            for (const uuid of this.optionalServices) {
                try {
                    const service = await this.server.getPrimaryService(uuid);
                    const characteristics = await service.getCharacteristics();
                    
                    // Tìm Characteristic hỗ trợ Notify hoặc Indicate
                    const found = characteristics.find(c => c.properties.notify || c.properties.indicate);
                    if (found) {
                        targetCharacteristic = found;
                        console.log(`✅ Kết nối thành công Service: ${uuid}`);
                        break;
                    }
                } catch (e) {
                    // Bỏ qua nếu service không tồn tại trên mẫu Rubik này
                }
            }

            if (!targetCharacteristic) {
                alert(`Đã kết nối với "${this.device.name || 'Thiết bị'}" nhưng không tìm thấy kênh dữ liệu phù hợp.\n\nHãy mở F12 Console để kiểm tra UUID thực tế của mẫu Rubik này.`);
                return false;
            }

            // Đăng ký nhận tín hiệu xoay real-time
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

        // Parse dữ liệu xoay
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
