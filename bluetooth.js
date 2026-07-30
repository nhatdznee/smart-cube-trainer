// bluetooth.js
export class SmartCubeBluetooth {
    constructor(onMoveCallback) {
        this.device = null;
        this.server = null;
        this.onMove = onMoveCallback; // Callback bắn ra WCA Move (VD: "R", "U'")
        
        // Cấu hình UUIDs (Ví dụ cho họ GAN / Giiker)
        this.SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb'; 
        this.CHARACTERISTIC_UUID = '0000fff5-0000-1000-8000-00805f9b34fb';
    }

    async connect() {
        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'GAN' }, { namePrefix: 'GiC' }, { namePrefix: 'Mi Smart Magic Cube' }],
                optionalServices: [this.SERVICE_UUID]
            });

            this.device.addEventListener('gattserverdisconnected', () => {
                console.warn('Cube Disconnected!');
                // Handle UI reconnect logic here
            });

            this.server = await this.device.gatt.connect();
            const service = await this.server.getPrimaryService(this.SERVICE_UUID);
            const characteristic = await service.getCharacteristic(this.CHARACTERISTIC_UUID);

            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));
            
            console.log('Connected and listening to moves!');
            return true;
        } catch (error) {
            console.error('Bluetooth Connection Failed:', error);
            return false;
        }
    }

    // Logic giải mã (Decryption) dữ liệu thô từ Cube
    handleData(event) {
        const value = event.target.value;
        // Dữ liệu từ Cube thường là mảng Uint8Array
        // Lưu ý: GAN có cơ chế mã hóa AES (Mac address key) - phần này yêu cầu library giải mã riêng cho từng hãng.
        // Dưới đây là logic giả lập ánh xạ Byte -> WCA Move cơ bản nhất.
        
        const moveData = value.getUint8(0); 
        
        /* 
           Giả định giao thức thô (Raw Protocol):
           Face: 0=U, 1=R, 2=F, 3=D, 4=L, 5=B
           Direction: 0 = Clockwise, 1 = Counter-Clockwise
        */
        const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
        const faceIndex = (moveData >> 1) & 0x07; // Lấy 3 bits biểu diễn Face
        const direction = moveData & 0x01;        // Lấy 1 bit biểu diễn Chiều xoay

        let wcaMove = faces[faceIndex];
        if (direction === 1) wcaMove += "'"; // Phẩy cho ngược chiều kim đồng hồ

        // Bắn dữ liệu move ra ngoài
        if(wcaMove && this.onMove) {
            this.onMove(wcaMove);
        }
    }
}