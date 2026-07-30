// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback) {
        this.device = null;
        this.server = null;
        this.onMove = onMoveCallback;
        
        // Các UUID dịch vụ Bluetooth phổ biến của GAN, QiYi, MoYu, Giiker, GoCube
        this.optionalServices = [
            '0000fff0-0000-1000-8000-00805f9b34fb', // GAN / Giiker
            '0000ffe0-0000-1000-8000-00805f9b34fb', // QiYi / MoYu
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e'  // GoCube / Rubik's Connected
        ];
    }

    async connect() {
        // Kiểm tra trình duyệt có hỗ trợ Web Bluetooth không
        if (!navigator.bluetooth) {
            alert('Trình duyệt của bạn chưa bật hoặc không hỗ trợ Web Bluetooth API!\nNếu dùng Brave, hãy bật flag: chrome://flags/#enable-web-bluetooth-new-permissions-backend');
            return false;
        }

        try {
            // Mở popup quét tất cả thiết bị Bluetooth xung quanh
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: this.optionalServices
            });

            this.device.addEventListener('gattserverdisconnected', () => {
                console.warn('Smart Cube đã ngắt kết nối!');
            });

            this.server = await this.device.gatt.connect();
            
            // Tìm Service tương thích
            let service = null;
            for (const uuid of this.optionalServices) {
                try {
                    service = await this.server.getPrimaryService(uuid);
                    if (service) break;
                } catch (e) {
                    // Thử UUID tiếp theo
                }
            }

            if (!service) {
                alert('Đã kết nối thiết bị nhưng không tìm thấy Service Rubik tương thích!');
                return false;
            }

            // Lấy kênh nhận dữ liệu (Notify Characteristic)
            const characteristics = await service.getCharacteristics();
            const characteristic = characteristics.find(c => c.properties.notify || c.properties.indicate);

            if (characteristic) {
                await characteristic.startNotifications();
                characteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));
                return true;
            } else {
                alert('Không tìm thấy kênh dữ liệu tín hiệu từ Rubik!');
                return false;
            }

        } catch (error) {
            console.error('Lỗi Bluetooth:', error);
            if (error.name !== 'NotFoundError') { // Người dùng bấm Cancel thì bỏ qua
                alert('Lỗi Bluetooth: ' + error.message);
            }
            return false;
        }
    }

    handleData(event) {
        const value = event.target.value;
        if (!value || value.byteLength === 0) return;

        // Parse dữ liệu xoay thô
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
