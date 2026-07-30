// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback, onDisconnectCallback) {
        this.device = null;
        this.server = null;
        this.onMove = onMoveCallback;
        this.onDisconnect = onDisconnectCallback;

        this.optionalServices = [
            '0000fff0-0000-1000-8000-00805f9b34fb',
            '0000aaaa-0000-1000-8000-00805f9b34fb',
            '0000fff3-0000-1000-8000-00805f9b34fb',
            '0000ffb0-0000-1000-8000-00805f9b34fb',
            '0000ffe0-0000-1000-8000-00805f9b34fb',
            '0000aab0-0000-1000-8000-00805f9b34fb',
            '0000ffff-0000-1000-8000-00805f9b34fb',
            '00001000-0000-1000-8000-00805f9b34fb',
            '0000a000-0000-1000-8000-00805f9b34fb',
            '0000aadc-0000-1000-8000-00805f9b34fb',
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
            '0000180a-0000-1000-8000-00805f9b34fb',
            '0000180f-0000-1000-8000-00805f9b34fb',
            '00001800-0000-1000-8000-00805f9b34fb',
            '00001801-0000-1000-8000-00805f9b34fb'
        ];

        // Tự động ngắt kết nối khi đóng tab / ngắt trang
        window.addEventListener('beforeunload', () => this.disconnect());
        window.addEventListener('pagehide', () => this.disconnect());
    }

    async connect() {
        if (!navigator.bluetooth) {
            alert('Trình duyệt không hỗ trợ Web Bluetooth API!');
            return false;
        }

        try {
            this.disconnect(); // Đảm bảo dọn dẹp kết nối cũ trước khi tạo kết nối mới

            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: this.optionalServices
            });

            this.device.addEventListener('gattserverdisconnected', () => {
                console.warn('Smart Cube đã ngắt kết nối!');
                if (this.onDisconnect) this.onDisconnect();
            });

            await new Promise(resolve => setTimeout(resolve, 300));
            this.server = await this.device.gatt.connect();
            await new Promise(resolve => setTimeout(resolve, 300));

            let targetCharacteristic = null;

            for (const uuid of this.optionalServices) {
                try {
                    const service = await this.server.getPrimaryService(uuid);
                    const characteristics = await service.getCharacteristics();
                    const found = characteristics.find(c => c.properties.notify || c.properties.indicate);
                    if (found) {
                        targetCharacteristic = found;
                        break;
                    }
                } catch (e) {}
            }

            if (!targetCharacteristic) {
                alert(`Đã kết nối với "${this.device.name || 'Thiết bị'}" nhưng không tìm thấy kênh dữ liệu phù hợp.`);
                return false;
            }

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

    // Hàm chủ động ngắt kết nối
    disconnect() {
        if (this.device && this.device.gatt && this.device.gatt.connected) {
            this.device.gatt.disconnect();
            console.log('Đã ngắt kết nối Bluetooth chủ động.');
        }
        this.device = null;
        this.server = null;
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
