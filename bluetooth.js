/**
 * ============================================
 * SMART CUBE BLUETOOTH CONNECTOR (bluetooth.js)
 * ============================================
 * 
 * Hỗ trợ: Giiker/Xiaomi Super Cube, GoCube, GAN (Gen2/Gen3/Gen4 - iCarry, 356i, 12ui, Monster Go)
 * 
 * Yêu cầu: Trình duyệt hỗ trợ Web Bluetooth API (Chrome, Edge)
 *          Chạy trên HTTPS hoặc localhost
 */

// ============================================
// 1. UUID DEFINITIONS - Các UUID BLE của từng hãng
// ============================================

const UUIDS = {
  // --- Giiker / Xiaomi Super Cube ---
  GIIKER: {
    NAME_PREFIXES: ['Giiker', 'Super Cube', 'MG', 'Xiaomi'],
    SERVICE: '0000fff0-0000-1000-8000-00805f9b34fb',
    DATA_CHAR: '0000fff6-0000-1000-8000-00805f9b34fb',      // Notify
    WRITE_CHAR: '0000fff7-0000-1000-8000-00805f9b34fb',     // Write
  },
  
  // --- GoCube / Rubik's Connected / Particula ---
  GOCUBE: {
    NAME_PREFIXES: ['GoCube', 'Rubik\'s', 'Particula'],
    SERVICE: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',       // Nordic UART Service
    DATA_CHAR: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',      // TX (notify)
    WRITE_CHAR: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',      // RX (write)
  },
  
  // --- GAN Smart Cube ---
  GAN: {
    NAME_PREFIXES: ['GAN', '356i', '12ui', 'Monster', 'AiCube'],
    SERVICES: [
      '0000fe59-0000-1000-8000-00805f9b34fb',               // Standard GAN Service UUID (Gen3/4, iCarry)
      '0000fff0-0000-1000-8000-00805f9b34fb',               // Gen2 Custom Service
      '0000aaaa-0000-1000-8000-00805f9b34fb',               // Standard Custom Service
      '0000ffe0-0000-1000-8000-00805f9b34fb'
    ]
  },
  
  // Services hệ thống cần loại bỏ khi dò tìm Service dữ liệu
  SYSTEM_SERVICES: [
    '00001800-0000-1000-8000-00805f9b34fb',
    '00001801-0000-1000-8000-00805f9b34fb'
  ]
};

// ============================================
// 2. RUBIK'S CUBE STATE TRACKER
// ============================================

class CubeStateTracker {
  constructor() {
    this.facelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
    this.moveHistory = [];
    this.startTime = null;
    this.endTime = null;
    this.isSolving = false;
  }

  isSolved() {
    const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
    for (const face of faces) {
      const start = faces.indexOf(face) * 9;
      const color = this.facelets[start];
      for (let i = 1; i < 9; i++) {
        if (this.facelets[start + i] !== color) return false;
      }
    }
    return true;
  }

  updateFacelets(faceletsStr) {
    if (faceletsStr && faceletsStr.length === 54) {
      this.facelets = faceletsStr;
    }
  }

  recordMove(move, timestamp = Date.now()) {
    this.moveHistory.push({ move, timestamp });
    
    if (!this.isSolving) {
      this.startTime = timestamp;
      this.isSolving = true;
    }
    
    if (this.isSolving && this.isSolved()) {
      this.endTime = timestamp;
      this.isSolving = false;
      return { solved: true, time: this.endTime - this.startTime };
    }
    
    return { solved: false };
  }

  getReconstruction() {
    return this.moveHistory.map(m => m.move).join(' ');
  }

  reset() {
    this.facelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
    this.moveHistory = [];
    this.startTime = null;
    this.endTime = null;
    this.isSolving = false;
  }
}

// ============================================
// 3. DATA DECODER - Giải mã gói dữ liệu BLE
// ============================================

class SmartCubeDecoder {
  constructor() {
    this.cubeType = null;
    this.ganKey = new Uint8Array(16);
  }

  // Khởi tạo Key cho GAN dựa trên MAC Address (nếu có)
  setGanMacAddress(macAddress) {
    if (!macAddress) return;
    const macBytes = macAddress.split(':').map(hex => parseInt(hex, 16));
    const reversedMac = [...macBytes].reverse();
    for (let i = 0; i < 16; i++) {
      this.ganKey[i] = reversedMac[i % 6];
    }
  }

  detectCubeType(deviceName) {
    const name = deviceName.toLowerCase();
    if (UUIDS.GIIKER.NAME_PREFIXES.some(p => name.includes(p.toLowerCase()))) {
      return 'GIIKER';
    }
    if (UUIDS.GOCUBE.NAME_PREFIXES.some(p => name.includes(p.toLowerCase()))) {
      return 'GOCUBE';
    }
    if (UUIDS.GAN.NAME_PREFIXES.some(p => name.includes(p.toLowerCase()))) {
      return 'GAN';
    }
    return 'UNKNOWN';
  }

  decodeGiiker(data) {
    const bytes = new Uint8Array(data);
    if (bytes.length < 20) return null;

    let facelets = '';
    const colorMap = ['U', 'R', 'F', 'D', 'L', 'B'];
    
    for (let i = 0; i < 54; i++) {
      const byteIndex = Math.floor(i / 2);
      const isHighNibble = i % 2 === 0;
      const nibble = isHighNibble 
        ? (bytes[byteIndex] >> 4) & 0x0F 
        : bytes[byteIndex] & 0x0F;
      facelets += colorMap[nibble] || '?';
    }

    const moveMap = {
      0: 'U', 1: 'U\'', 2: 'U2',
      3: 'R', 4: 'R\'', 5: 'R2',
      6: 'F', 7: 'F\'', 8: 'F2',
      9: 'D', 10: 'D\'', 11: 'D2',
      12: 'L', 13: 'L\'', 14: 'L2',
      15: 'B', 16: 'B\'', 17: 'B2',
    };
    
    const move1 = moveMap[bytes[16]] || null;
    const move2 = moveMap[bytes[17]] || null;
    const moves = [move1, move2].filter(m => m !== null);

    return {
      type: 'GIIKER',
      facelets,
      moves,
      gyro: { x: bytes[18], y: bytes[19] },
      battery: bytes.length > 19 ? bytes[19] : null,
      raw: bytes,
    };
  }

  decodeGoCube(data) {
    const bytes = new Uint8Array(data);
    try {
      const text = new TextDecoder().decode(bytes);
      const json = JSON.parse(text);
      return {
        type: 'GOCUBE',
        facelets: json.facelets || json.state,
        moves: json.moves || [json.move],
        battery: json.battery,
        raw: bytes,
      };
    } catch (e) {
      return { type: 'GOCUBE', raw: bytes };
    }
  }

  decodeGan(data) {
    const rawBytes = new Uint8Array(data);
    if (rawBytes.length === 0) return null;

    const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
    let moveByte = rawBytes[0];
    
    if (rawBytes.length >= 16) {
      moveByte = rawBytes[12] ^ this.ganKey[0];
    }

    const faceIndex = (moveByte >> 1) & 0x07;
    const direction = moveByte & 0x01;

    let moves = [];
    if (faceIndex < faces.length) {
      let wcaMove = faces[faceIndex];
      if (direction === 1) wcaMove += "'";
      moves.push(wcaMove);
    }

    return {
      type: 'GAN',
      moves,
      raw: rawBytes
    };
  }

  decode(data, cubeType) {
    switch (cubeType) {
      case 'GIIKER':
        return this.decodeGiiker(data);
      case 'GOCUBE':
        return this.decodeGoCube(data);
      case 'GAN':
        return this.decodeGan(data);
      default:
        return { type: 'UNKNOWN', raw: new Uint8Array(data) };
    }
  }
}

// ============================================
// 4. SMART CUBE BLUETOOTH CONNECTOR
// ============================================

class SmartCubeConnector extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.server = null;
    this.service = null;
    this.dataCharacteristic = null;
    this.writeCharacteristic = null;
    this.batteryCharacteristic = null;
    
    this.cubeType = null;
    this.decoder = new SmartCubeDecoder();
    this.stateTracker = new CubeStateTracker();
    
    this.connected = false;
    this.autoTimer = false;
  }

  async connect(options = {}) {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Trình duyệt không hỗ trợ Web Bluetooth API. Vui lòng dùng Chrome hoặc Edge.');
      }

      this.dispatchEvent(new CustomEvent('status', { detail: 'Đang quét thiết bị...' }));

      const requestOptions = {
        filters: [
          { namePrefix: 'Giiker' },
          { namePrefix: 'GAN' },
          { namePrefix: 'GoCube' },
          { namePrefix: 'Rubik\'s' },
          { namePrefix: 'Super' },
          { namePrefix: 'MG' },
          { namePrefix: 'Monster' },
          { namePrefix: 'AiCube' }
        ],
        optionalServices: [
          UUIDS.GIIKER.SERVICE,
          UUIDS.GOCUBE.SERVICE,
          ...UUIDS.GAN.SERVICES,
          'battery_service',
        ],
        ...options,
      };

      this.device = await navigator.bluetooth.requestDevice(requestOptions);
      
      this.dispatchEvent(new CustomEvent('status', { 
        detail: `Đã chọn: ${this.device.name}` 
      }));

      this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected());

      this.server = await this.device.gatt.connect();
      await new Promise(r => setTimeout(r, 500));

      this.dispatchEvent(new CustomEvent('status', { detail: 'Đã kết nối GATT Server' }));

      this.cubeType = this.decoder.detectCubeType(this.device.name);
      this.dispatchEvent(new CustomEvent('status', { 
        detail: `Phát hiện: ${this.cubeType}` 
      }));

      await this.discoverServices();
      await this.startNotifications();

      this.connected = true;
      this.dispatchEvent(new CustomEvent('connected', { 
        detail: { device: this.device, cubeType: this.cubeType } 
      }));
      this.dispatchEvent(new CustomEvent('status', { detail: 'Sẵn sàng!' }));

      return true;

    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: error.message }));
      console.error('Connection error:', error);
      return false;
    }
  }

  async discoverServices() {
    console.log('Đang quét danh sách Services trên thiết bị...');
    const allServices = await this.server.getPrimaryServices();
    
    // Loại bỏ hoàn toàn service hệ thống Generic Access (1800) & Generic Attribute (1801)
    const validServices = allServices.filter(s => 
      !UUIDS.SYSTEM_SERVICES.includes(s.uuid)
    );

    if (validServices.length === 0) {
      throw new Error('Không tìm thấy Service dữ liệu hợp lệ trên thiết bị!');
    }

    if (this.cubeType === 'GIIKER') {
      this.service = validServices.find(s => s.uuid === UUIDS.GIIKER.SERVICE) || validServices[0];
    } else if (this.cubeType === 'GOCUBE') {
      this.service = validServices.find(s => s.uuid === UUIDS.GOCUBE.SERVICE) || validServices[0];
    } else if (this.cubeType === 'GAN') {
      this.service = validServices.find(s => 
        s.uuid.includes('fe59') || s.uuid.includes('fff0') || s.uuid.includes('aaaa')
      ) || validServices[0];
    } else {
      this.service = validServices[0];
    }

    this.dispatchEvent(new CustomEvent('status', { 
      detail: `Đã chọn Service: ${this.service.uuid}` 
    }));

    const characteristics = await this.service.getCharacteristics();

    // Tìm kênh Notify (truyền dữ liệu xoay)
    this.dataCharacteristic = characteristics.find(c => 
      (c.uuid.includes('fff5') || c.uuid.includes('6e400003') || c.uuid === UUIDS.GIIKER.DATA_CHAR) && c.properties.notify
    ) || characteristics.find(c => c.properties.notify);

    // Tìm kênh Write (gửi lệnh handshake/reset)
    this.writeCharacteristic = characteristics.find(c => 
      c.uuid.includes('fff2') || c.uuid === UUIDS.GIIKER.WRITE_CHAR || c.uuid === UUIDS.GOCUBE.WRITE_CHAR ||
      c.properties.write || c.properties.writeWithoutResponse
    );

    if (!this.dataCharacteristic) {
      throw new Error('Không tìm thấy kênh Notify nhận dữ liệu xoay!');
    }

    // Lấy Battery level nếu có
    try {
      const batteryService = await this.server.getPrimaryService('battery_service');
      this.batteryCharacteristic = await batteryService.getCharacteristic('battery_level');
      const batteryValue = await this.batteryCharacteristic.readValue();
      this.dispatchEvent(new CustomEvent('battery', { 
        detail: batteryValue.getUint8(0) 
      }));
    } catch (e) {
      console.warn('Không có battery service độc lập');
    }
  }

  async startNotifications() {
    if (!this.dataCharacteristic) return;

    this.dataCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
      this.onDataReceived(event.target.value);
    });

    await this.dataCharacteristic.startNotifications();
    this.dispatchEvent(new CustomEvent('status', { 
      detail: 'Đã bật notifications' 
    }));

    await this.wakeUpCube();
  }

  onDataReceived(dataView) {
    const buffer = dataView.buffer;
    const decoded = this.decoder.decode(buffer, this.cubeType);
    
    if (!decoded) return;

    this.dispatchEvent(new CustomEvent('rawData', { detail: decoded }));

    if (decoded.facelets) {
      this.stateTracker.updateFacelets(decoded.facelets);
      this.dispatchEvent(new CustomEvent('facelets', { 
        detail: decoded.facelets 
      }));
    }

    if (decoded.moves && decoded.moves.length > 0) {
      for (const move of decoded.moves) {
        const result = this.stateTracker.recordMove(move);
        
        this.dispatchEvent(new CustomEvent('move', { 
          detail: { 
            move, 
            facelets: this.stateTracker.facelets,
            history: this.stateTracker.moveHistory,
          } 
        }));

        if (result.solved) {
          this.dispatchEvent(new CustomEvent('solved', {
            detail: {
              time: result.time,
              moves: this.stateTracker.moveHistory.length,
              reconstruction: this.stateTracker.getReconstruction(),
            }
          }));
        }
      }
    }

    if (decoded.battery !== null && decoded.battery !== undefined) {
      this.dispatchEvent(new CustomEvent('battery', { detail: decoded.battery }));
    }
  }

  async sendCommand(command) {
    if (!this.writeCharacteristic) return;

    let data;
    switch (this.cubeType) {
      case 'GIIKER':
        if (command === 'WAKE_UP' || command === 'GET_STATE') {
          data = new Uint8Array([0x00, 0x00, 0x24, 0x00, 0x00]);
        } else if (command === 'RESET') {
          data = new Uint8Array([0x00, 0x00, 0x2D, 0x00, 0x00]);
        }
        break;
      case 'GOCUBE':
        data = new TextEncoder().encode(JSON.stringify({ cmd: command }));
        break;
      case 'GAN':
        if (command === 'WAKE_UP') {
          data = new Uint8Array([0x68, 0x01, 0x00, 0x00, 0x00, 0x00]);
        }
        break;
    }

    if (data) {
      try {
        if (typeof this.writeCharacteristic.writeValueWithoutResponse === 'function') {
          await this.writeCharacteristic.writeValueWithoutResponse(data);
        } else {
          await this.writeCharacteristic.writeValue(data);
        }
      } catch (e) {
        console.warn('Lỗi ghi dữ liệu xuống Cube:', e);
      }
    }
  }

  async wakeUpCube() {
    try {
      await this.sendCommand('WAKE_UP');
      this.dispatchEvent(new CustomEvent('status', { detail: 'Đã kết nối & Handshake thành công' }));
    } catch (e) {
      console.warn('Không gửi được lệnh handshake');
    }
  }

  startAutoTimer() {
    this.autoTimer = true;
    this.stateTracker.reset();
    this.dispatchEvent(new CustomEvent('status', { detail: 'Auto-timer đã bật' }));
  }

  getReconstruction() {
    return this.stateTracker.getReconstruction();
  }

  getCurrentState() {
    return {
      facelets: this.stateTracker.facelets,
      moves: this.stateTracker.moveHistory.length,
      isSolving: this.stateTracker.isSolving,
      time: this.stateTracker.isSolving 
        ? Date.now() - this.stateTracker.startTime 
        : (this.stateTracker.endTime - this.stateTracker.startTime),
    };
  }

  async disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
    }
  }

  onDisconnected() {
    this.connected = false;
    this.dispatchEvent(new CustomEvent('disconnected'));
    this.dispatchEvent(new CustomEvent('status', { detail: 'Đã ngắt kết nối' }));
  }
}

// ============================================
// 5. EXPORT
// ============================================

export { SmartCubeConnector, CubeStateTracker, SmartCubeDecoder, UUIDS };

if (typeof window !== 'undefined') {
  window.SmartCubeConnector = SmartCubeConnector;
  window.CubeStateTracker = CubeStateTracker;
}
