const UUID_SERVICE = "6ceba000-76de-441e-89bc-0de0079db615";
const UUID_BLECHAR_COMMAND = "6ceba001-76de-441e-89bc-0de0079db615";
const RECONNECT_DELAY_SECONDS = 3;

const UUIDS_BLOCK = [
  "6ceba021-76de-441e-89bc-0de0079db615",
  "6ceba022-76de-441e-89bc-0de0079db615",
  "6ceba023-76de-441e-89bc-0de0079db615",
  "6ceba024-76de-441e-89bc-0de0079db615",
];

export default class DeviceManager {
  /** @type {BluetoothDevice | null} */
  device = null;

  /** @type {BluetoothRemoteGATTServer | null} */
  server = null;

  /** @type {BluetoothRemoteGATTService | null} */
  service = null;

  /** @type {BluetoothRemoteGATTCharacteristic | null} */
  tx_characteristic = null;

  /** @type {BluetoothRemoteGATTCharacteristic | null} */
  screen_characteristic = null;

  /** @type {BluetoothRemoteGATTCharacteristic | null} */
  screen_patch_char = null;

  block_chars = [];

  /** @type {(connected: boolean) => void | null} */
  onConnectionChange = null;

  /** @type {(reconnecting: boolean) => void | null} */
  onReconnectionChange = null;

  /** @type {boolean} */
  wantsConnection = false;

  /** @type {boolean} */
  _enableAutoReconnect = true;

  /** @type {number | undefined} */
  reconnectTimeoutId = undefined;

  get deviceName() {
    return this.device?.name || null;
  }

  get connected() {
    return this.device && this.device.gatt?.connected;
  }

  get reconnecting() {
    return (
      this.device && !this.device.gatt?.connected && this.enableAutoReconnect
    );
  }

  get enableAutoReconnect() {
    return this._enableAutoReconnect;
  }

  set enableAutoReconnect(value) {
    this._enableAutoReconnect = value;
    if (!value) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = undefined;

      if (!this.connected) {
        this.device = null;
        if (this.onReconnectionChange) this.onReconnectionChange(false);
      }
    }
  }

  constructor() {}

  async connectPrompt() {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [UUID_SERVICE] }],
      });

      await this.connect(device);
    } catch (e) {
      console.warn(e);
      console.warn("closed connect prompt");
    }
  }

  /**
   * @param {BluetoothDevice} device
   */
  async connect(device) {
    if (!device) return;

    this.device = device;
    this.wantsConnection = true;
    this.server = await device.gatt.connect();

    console.log("device connected:", device.name, this.onConnectionChange);
    if (this.onReconnectionChange) this.onReconnectionChange(false);
    if (this.onConnectionChange) this.onConnectionChange(true);

    this.service = await this.server.getPrimaryService(UUID_SERVICE);
    this.tx_characteristic = await this.service.getCharacteristic(
      UUID_BLECHAR_COMMAND
    );

    console.log("service + characteristics obtained");

    for (const uuid of UUIDS_BLOCK) {
      const c = await this.service.getCharacteristic(uuid);
      this.block_chars.push(c);

      c.addEventListener("characteristicvaluechanged", (event) => {
        const num = UUIDS_BLOCK.indexOf(uuid);
        this.onScreenBlock(num, event.target.value);
      });
      await c.startNotifications();
    }

    device.addEventListener("gattserverdisconnected", () => {
      console.log("device disconnected");

      this.server = null;
      this.service = null;
      this.tx_characteristic = null;
      this.block_chars = [];

      if (this.onConnectionChange) this.onConnectionChange(false);

      if (this.enableAutoReconnect && this.wantsConnection) {
        if (this.onReconnectionChange) this.onReconnectionChange(true);
        this._attemptReconnect();
      } else {
        this.device = null;
      }
    });

    this.readScreen();
  }

  async _attemptReconnect() {
    if (!this.connected && this.device) {
      console.log("reconnect attempt...");

      try {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = undefined;

        await this.connect(this.device);
      } catch {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = setTimeout(() => {
          console.log("reconnect timeout");
          this._attemptReconnect();
        }, 1000 * RECONNECT_DELAY_SECONDS);
      }
    }
  }

  disconnect() {
    if (this.connected) {
      this.wantsConnection = false;
      this.device.gatt.disconnect();
      this.device = null;
    } else {
      this.wantsConnection = false;
      this.device = null;
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = undefined;
      if (this.onReconnectionChange) this.onReconnectionChange(false);
    }
  }

  _sendInput(id, value, shift) {
    const data = new Int8Array(4);
    data.set([0x01, id, value, shift ? 1 : 0]);
    console.log(data);

    if (this.tx_characteristic) this.tx_characteristic.writeValue(data);
  }

  sendEncoder(which, dir, shift) {
    const id = InputId[which];
    if (!id) return;
    this._sendInput(id, dir, shift);
  }

  sendBtn(which, is_pressed) {
    const id = InputId[which];
    if (!id) return;
    const value = is_pressed ? BtnEvent["press"] : BtnEvent["release"];
    this._sendInput(id, value, false);
  }

  screen_data = new Uint8Array(128 * 8);
  onScreenData = null;

  async readScreen() {
    if (!this.tx_characteristic) return;

    const pages_data_rle = [];

    for (const c of this.block_chars) {
      const pd_rle = await c.readValue();
      pages_data_rle.push(pd_rle);
    }

    this._bufferUpdate(pages_data_rle);
  }

  _bufferUpdate(pages_data_rle) {
    const pages_data = [];

    for (const page_data_rle of pages_data_rle) {
      const page_data = rleDecompress(page_data_rle);
      pages_data.push(page_data);
    }

    let offset = 0;

    for (const pd of pages_data) {
      this.screen_data.set(
        new Uint8Array(pd.buffer, pd.byteOffset, pd.byteLength),
        offset
      );
      offset += pd.byteLength;
    }

    if (this.onScreenData) this.onScreenData();
  }

  isPixelOn(x, y) {
    const byte = this.screen_data[x + Math.floor(y / 8) * 128] & (1 << (y & 7));
    return Boolean(byte);
  }

  partial_block_data = [null, null, null, null];

  onScreenBlock(i, data) {
    console.log(i, data);

    this.partial_block_data[i] = data;

    if (this.partial_block_data.every((x) => x != null)) {
      this._bufferUpdate(this.partial_block_data);
      this.partial_block_data = [null, null, null, null];
    }
  }
}

const BtnEvent = {
  press: 0x01,
  release: 0x02,
};

const InputId = {
  lx: 0x01,
  rx: 0x02,

  enc0: 0x10,
  enc1: 0x11,
  enc2: 0x12,
};

/**
 * Decompresses RLE-compressed data from a DataView.
 * Format: [value, count] pairs.
 * @param {DataView} view - The compressed data view.
 * @param {number} L - Max expected decompressed size.
 * @returns {Uint8Array} Decompressed buffer.
 */
function rleDecompress(view, L = 128 * 8) {
  const output = new Uint8Array(L);
  let writeIndex = 0;
  let readIndex = 0;

  while (readIndex + 1 < view.byteLength) {
    const value = view.getUint8(readIndex++);
    const count = view.getUint8(readIndex++);

    output.fill(value, writeIndex, writeIndex + count);
    writeIndex += count;
  }

  return output.slice(0, writeIndex); // Trim to actual decompressed size
}
