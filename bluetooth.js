// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback, onDisconnectCallback) {
        this.device = null;
        this.server = null;
        this.notifyCharacteristic = null;
        this.onMove = onMoveCallback;
        this.onDisconnect = onDisconnectCallback;

        // Địa chỉ MAC khối GAN iCarry của bạn
        this.macAddress = '0C:3D:5E:99:23:29';
        this.ganKey = this.deriveGanKey(this.macAddress);

        this.SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
        this.NOTIFY_UUID  = '0000fff5-0000-1000-8000-00805f9b34fb';

        window.addEventListener('beforeunload', () => this.disconnect());
        window.addEventListener('pagehide', () => this.disconnect());
    }

    // Sinh AES Key từ MAC Address (GAN Protocol)
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

            // 1. Quét thiết bị với Name Prefix để tránh lỗi GATT trên Windows
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: 'GAN' },
                    { namePrefix: 'MG' },
                    { namePrefix: 'AiCube' }
                ],
                optionalServices: [
                    this.SERVICE_UUID,
                    '0000aaaa-0000-1000-8000-00805f9b34fb',
                    '0000ffe0-0000-1000-8000-00805f9b34fb'
                ]
            });

            this.device.addEventListener('gattserverdisconnected', () => {
                console.warn('GAN Cube đã ngắt kết nối!');
                this.disconnect();
            });

            console.log(`Đang kết nối GATT với: ${this.device.name}`);
            this.server = await this.device.gatt.connect();

            // Tạm hoãn 300ms cho stack Bluetooth trên OS ổn định
            await new Promise(r => setTimeout(r, 300));

            // 2. Lấy Primary Service
            const service = await this.server.getPrimaryService(this.SERVICE_UUID);

            // 3. Lấy Notify Characteristic fff5
            this.notifyCharacteristic = await service.getCharacteristic(this.NOTIFY_UUID);

            // 4. Kích hoạt Notifications
            await this.notifyCharacteristic.startNotifications();
            this.notifyCharacteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));

            console.log('✅ Đã kết nối GAN iCarry thành công!');
            return true;

        } catch (error) {
            console.error('Lỗi Bluetooth:', error);
            this.disconnect();

            if (error.name !== 'NotFoundError') {
                alert(`Lỗi kết nối GAN Bluetooth: ${error.message}\n\n*Lưu ý: Đảm bảo bạn đã UNPAIR/XÓA Rubik khỏi Cài đặt Bluetooth của Laptop trước khi kết nối.`);
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
        this.notifyCharacteristic = null;
        if (this.onDisconnect) this.onDisconnect();
    }

    handleData(event) {
        const value = event.target.value;
        if (!value || value.byteLength === 0) return;

        const rawBytes = new Uint8Array(value.buffer);
        const faces = ['U', 'R', 'F', 'D', 'L', 'B'];

        // Giải mã gói tin xoay GAN iCarry
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
