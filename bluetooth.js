// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback, onDisconnectCallback) {
        this.device = null;
        this.server = null;
        this.notifyCharacteristic = null;
        this.writeCharacteristic = null;
        this.onMove = onMoveCallback;
        this.onDisconnect = onDisconnectCallback;

        // Địa chỉ MAC khối GAN iCarry
        this.macAddress = '0C:3D:5E:99:23:29';
        this.ganKey = this.deriveGanKey(this.macAddress);

        this.SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
        this.NOTIFY_UUID  = '0000fff5-0000-1000-8000-00805f9b34fb';
        this.WRITE_UUID   = '0000fff2-0000-1000-8000-00805f9b34fb';
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
            // 1. Mở popup quét thiết bị GAN
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

            console.log(`Đang kết nối GATT tới: ${this.device.name}`);

            // 2. Thử kết nối GATT (Thử lại 3 lần nếu có độ trễ)
            let retries = 3;
            while (retries > 0) {
                try {
                    this.server = await this.device.gatt.connect();
                    await new Promise(r => setTimeout(r, 600));
                    if (this.server && this.server.connected) {
                        break;
                    }
                } catch (err) {
                    console.warn(`Thử kết nối lần ${4 - retries} chưa thành công, đang thử lại...`);
                    retries--;
                    if (retries === 0) throw err;
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            if (!this.server || !this.server.connected) {
                throw new Error('Không thể kết nối GATT Server. Hãy bấm kết nối lại!');
            }

            // 3. Lấy Primary Service fff0
            const service = await this.server.getPrimaryService(this.SERVICE_UUID);

            // 4. Lấy Characteristics
            this.notifyCharacteristic = await service.getCharacteristic(this.NOTIFY_UUID);
            try {
                this.writeCharacteristic = await service.getCharacteristic(this.WRITE_UUID);
            } catch (e) {
                console.warn('Không tìm thấy kênh Write fff2, tiếp tục chế độ Read.');
            }

            // 5. Kích hoạt nhận dữ liệu real-time
            await this.notifyCharacteristic.startNotifications();
            this.notifyCharacteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));

            // 6. Gửi gói Handshake ping
            if (this.writeCharacteristic) {
                const handshakePacket = new Uint8Array([0x68, 0x01, 0x00, 0x00, 0x00, 0x00]);
                await this.writeCharacteristic.writeValue(handshakePacket);
            }

            console.log('✅ Đã kết nối GAN iCarry thành công!');
            return true;

        } catch (error) {
            console.error('Lỗi Bluetooth:', error);
            // ĐÃ XÓA LỆNH TỰ ĐỘNG NGẮT KẾT NỐI (this.disconnect()) Ở ĐÂY
            if (error.name !== 'NotFoundError') {
                alert(`Lỗi kết nối Bluetooth: ${error.message}`);
            }
            return false;
        }
    }

    // Hàm duy nhất thực hiện ngắt kết nối (chỉ chạy khi người dùng chủ động bấm Disconnect)
    disconnect() {
        if (this.device && this.device.gatt && this.device.gatt.connected) {
            try {
                this.device.gatt.disconnect();
            } catch (e) {}
        }
        this.device = null;
        this.server = null;
        this.notifyCharacteristic = null;
        this.writeCharacteristic = null;

        if (this.onDisconnect) {
            this.onDisconnect();
        }
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

            console.log(`Realtime move: ${wcaMove}`);
            if (this.onMove) this.onMove(wcaMove);
        }
    }
}
