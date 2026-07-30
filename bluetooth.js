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

        // Chuẩn Service UUID mới của GAN iCarry
        this.GAN_SERVICE_UUID = '0000fe59-0000-1000-8000-00805f9b34fb';
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
            console.log('1. Mở hộp thoại quét thiết bị...');
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: 'GAN' },
                    { namePrefix: 'MG' },
                    { namePrefix: 'AiCube' }
                ],
                optionalServices: [
                    '0000fe59-0000-1000-8000-00805f9b34fb',
                    '0000fff0-0000-1000-8000-00805f9b34fb',
                    '0000aaaa-0000-1000-8000-00805f9b34fb',
                    '0000ffe0-0000-1000-8000-00805f9b34fb',
                    '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
                ]
            });

            console.log(`2. Đã ghép nối với: ${this.device.name}. Đang kết nối GATT...`);
            this.server = await this.device.gatt.connect();

            await new Promise(r => setTimeout(r, 600));

            if (!this.server || !this.server.connected) {
                throw new Error('GATT Server ngắt kết nối đột ngột!');
            }

            console.log('3. Đang quét danh sách Primary Services...');
            const services = await this.server.getPrimaryServices();
            console.log('📋 tất cả Services tìm thấy:', services.map(s => s.uuid));

            // Bỏ qua service hệ thống 1800, 1801
            const validServices = services.filter(s => 
                !s.uuid.includes('00001800') && !s.uuid.includes('00001801')
            );

            if (validServices.length === 0) {
                throw new Error('Không tìm thấy Service dữ liệu nào trên khối GAN!');
            }

            // Ưu tiên fe59, sau đó đến các service khác
            const service = validServices.find(s => 
                s.uuid.includes('fe59') || 
                s.uuid.includes('fff0') || 
                s.uuid.includes('aaaa')
            ) || validServices[0];

            console.log(`🎯 Đã chọn Service: ${service.uuid}`);

            const characteristics = await service.getCharacteristics();
            console.log('📋 Danh sách Characteristics:', characteristics.map(c => c.uuid));

            // Tìm kênh notify nhận bước xoay
            this.notifyCharacteristic = characteristics.find(c => c.properties.notify);
            this.writeCharacteristic = characteristics.find(c => 
                c.properties.write || c.properties.writeWithoutResponse
            );

            if (!this.notifyCharacteristic) {
                throw new Error('Không tìm thấy kênh Notify truyền dữ liệu xoay!');
            }

            console.log('4. Kích hoạt Notifications kênh:', this.notifyCharacteristic.uuid);
            await this.notifyCharacteristic.startNotifications();
            this.notifyCharacteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));

            // 5. Gửi Handshake ping nếu có kênh Write
            if (this.writeCharacteristic) {
                try {
                    const handshakePacket = new Uint8Array([0x68, 0x01, 0x00, 0x00, 0x00, 0x00]);
                    if (typeof this.writeCharacteristic.writeValueWithoutResponse === 'function') {
                        await this.writeCharacteristic.writeValueWithoutResponse(handshakePacket);
                    } else if (typeof this.writeCharacteristic.writeValue === 'function') {
                        await this.writeCharacteristic.writeValue(handshakePacket);
                    }
                    console.log('🤝 Handshake thành công!');
                } catch (writeErr) {
                    console.warn('Cảnh báo Lỗi Write Handshake:', writeErr);
                }
            }

            console.log('✅ WEB ĐÃ NHẬN DIỆN KẾT NỐI THÀNH CÔNG!');
            return true;

        } catch (error) {
            console.error('❌ Lỗi chi tiết Bluetooth Connect:', error);
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

            console.log(`🎯 Realtime Move: ${wcaMove}`);
            if (this.onMove) this.onMove(wcaMove);
        }
    }
}
