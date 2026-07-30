// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback, onDisconnectCallback) {
        this.device = null;
        this.server = null;
        this.notifyCharacteristic = null;
        this.writeCharacteristic = null;
        this.onMove = onMoveCallback;
        this.onDisconnect = onDisconnectCallback;

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

            // Tự động nhận biết khi Rubik bị tắt nguồn hoặc mất kết nối
            this.device.addEventListener('gattserverdisconnected', () => {
                console.warn('⚠️ Mất kết nối Bluetooth với Rubik!');
                this.disconnect();
            });

            console.log(`Đang kết nối GATT tới: ${this.device.name}`);

            let retries = 3;
            while (retries > 0) {
                try {
                    this.server = await this.device.gatt.connect();
                    await new Promise(r => setTimeout(r, 600));
                    if (this.server && this.server.connected) break;
                } catch (err) {
                    retries--;
                    if (retries === 0) throw err;
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            if (!this.server || !this.server.connected) {
                throw new Error('Không thể kết nối GATT Server!');
            }

            const service = await this.server.getPrimaryService(this.SERVICE_UUID);
            this.notifyCharacteristic = await service.getCharacteristic(this.NOTIFY_UUID);

            try {
                this.writeCharacteristic = await service.getCharacteristic(this.WRITE_UUID);
            } catch (e) {}

            await this.notifyCharacteristic.startNotifications();
            this.notifyCharacteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));

            if (this.writeCharacteristic) {
                const handshakePacket = new Uint8Array([0x68, 0x01, 0x00, 0x00, 0x00, 0x00]);
                await this.writeCharacteristic.writeValue(handshakePacket);
            }

            console.log('✅ Đã kết nối GAN iCarry thành công!');
            return true;

        } catch (error) {
            console.error('Lỗi Bluetooth:', error);
            if (error.name !== 'NotFoundError') {
                alert(`Lỗi kết nối Bluetooth: ${error.message}`);
            }
            return false;
        }
    }

    disconnect() {
        if (this.device && this.device.gatt && this.device.gatt.connected) {
            try { this.device.gatt.disconnect(); } catch (e) {}
        }
        this.device = null;
        this.server = null;
        this.notifyCharacteristic = null;
        this.writeCharacteristic = null;

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

            if (this.onMove) this.onMove(wcaMove);
        }
    }
}
