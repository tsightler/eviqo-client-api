/**
 * Eviqo WebSocket Connection Client
 *
 * Provides WebSocket-based communication with Eviqo cloud services
 * for monitoring and controlling electric vehicle charging stations.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { calculateHash } from './utils/hash';
import { logger } from './utils/logger';
import {
  createBinaryMessage,
  MessageHeader,
  parseBinaryMessage,
} from './utils/protocol';
import {
  DeviceDocs,
  EviqoDeviceQueryModel,
} from './models/device-query';
import {
  DisplayDataStream,
  EviqoDevicePageModel,
} from './models/device-page';
import { EviqoUserModel } from './models/user';

export const WS_URL = 'wss://app.eviqo.io/dashws';

/**
 * Eviqo WebSocket Connection Client
 *
 * Main class for connecting to Eviqo cloud services and monitoring devices.
 *
 * @example
 * ```typescript
 * const client = new EviqoWebsocketConnection(
 *   WS_URL,
 *   null,
 *   'user@example.com',
 *   'password123'
 * );
 * await client.run();
 * ```
 */
export class EviqoWebsocketConnection extends EventEmitter {
  private url: string;
  private username: string | null;
  private password: string | null;
  private ws: WebSocket | null = null;
  private user: EviqoUserModel | null = null;
  private devices: DeviceDocs[] = [];
  private devicePages: EviqoDevicePageModel[] = [];
  // Message counter shared across all outbound messages, starting at 0
  private messageCounter = 0;
  private widgetIdMap: Map<number, Map<string, DisplayDataStream>> = new Map();
  private widgetNameMap: Map<number, Map<string, DisplayDataStream>> =
    new Map();
  // Map from pin number to widget stream (for widget update lookup)
  private widgetPinMap: Map<number, Map<string, DisplayDataStream>> = new Map();
  private keepaliveTimer: Date = new Date();

  constructor(
    url: string,
    _sessionId: string | null = null,
    username: string | null = null,
    password: string | null = null
  ) {
    super();
    this.url = url;
    // sessionId is stored for potential future use
    this.username = username;
    this.password = password;
  }

  /**
   * Connect to WebSocket with session cookie
   *
   * @returns True if connection successful, false otherwise
   */
  async connect(): Promise<boolean> {
    try {
      logger.debug(`Connecting to ${this.url}...`);

      // Make HTTP request to login page to capture cookies
      const loginUrl = 'https://app.eviqo.io/dashboard/login';
      const response = await fetch(loginUrl);

      // Parse cookies from response
      let cookieHeader = '';
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        const cookieParts: string[] = [];
        const cookies = setCookieHeader.split(', ');
        for (const cookie of cookies) {
          const cookiePair = cookie.split(';')[0];
          cookieParts.push(cookiePair);
          const cookieName = cookiePair.split('=')[0];
          logger.debug(`Setting cookie ${cookieName}`);
        }
        cookieHeader = cookieParts.join('; ');
      }

      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/140.0.0.0 Safari/537.36',
        Origin: 'https://app.eviqo.io',
      };

      // Append cookies to headers if we have any
      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }

      this.ws = new WebSocket(this.url, { headers });

      // Set up event handlers
      return new Promise<boolean>((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket not created'));
          return;
        }

        const connectHandler = () => {
          logger.debug('Connected successfully!');
          this.ws!.removeListener('error', errorHandler);
          resolve(true);
        };

        const errorHandler = (error: Error) => {
          logger.error(`WebSocket error: ${error.message}`);
          this.ws!.removeListener('open', connectHandler);
          reject(error);
        };

        this.ws.once('open', connectHandler);
        this.ws.once('error', errorHandler);

        // Set up persistent handlers for ongoing connection monitoring
        this.ws.on('close', (code, reason) => {
          logger.warn(`WebSocket closed: code=${code} reason=${reason.toString()}`);
          this.emit('connectionClosed', { code, reason: reason.toString() });
        });

        this.ws.on('error', (error) => {
          logger.error(`WebSocket error during operation: ${error.message}`);
          this.emit('connectionError', error);
        });
      });
    } catch (error) {
      logger.error(`Connection failed: ${error}`);
      return false;
    }
  }

  /**
   * Check and send keepalive if needed
   *
   * Sends keepalive message every 15 seconds to maintain connection
   * Message type 0x06 for keepalive/ping
   */
  async keepalive(): Promise<void> {
    logger.debug('Keepalive check');
    const now = new Date();
    const elapsed = now.getTime() - this.keepaliveTimer.getTime();

    if (elapsed >= 15000) {
      // 15 seconds
      logger.debug('Issue keepalive');
      this.keepaliveTimer = new Date();
      await this.sendMessage(null, 0x00, 0x06, 0x00, undefined, 'KEEPALIVE');
      await this.listen();
    }
  }

  /**
   * Send initialization message with clientType, version, and locale
   */
  async issueInitialization(): Promise<void> {
    logger.debug('Sending initialization message...');

    const initPayload = {
      clientType: 'web',
      version: '0.98.2',
      locale: 'en_US',
    };

    // Header: 0x01300001
    await this.sendMessage(initPayload, 0x01, 0x30, 0x00, 0x01, 'INIT');

    const { payload } = await this.listen();
    if (payload === null) {
      throw new Error('Init message failed');
    }
  }

  /**
   * Send login message with hashed password
   *
   * AUTH:
   * 0x00020003{"email":"<EMAIL>","hash":"<B64_HASH>","clientType":"web","version":"0.98.2","locale":"en_US"}
   * RESP:
   * 0x00020003<EviqoUserModel>
   */
  async login(): Promise<void> {
    logger.debug('Sending login message...');

    if (this.username === null || this.password === null) {
      throw new Error('User and password must be set');
    }

    await this.sendMessage(
      {
        email: this.username,
        hash: calculateHash(this.username, this.password),
        clientType: 'web',
        version: '0.98.2',
        locale: 'en_US',
      },
      0x00,
      0x02,
      0x00,
      0x03,
      'LOGIN'
    );

    const { payload } = await this.listen();
    if (payload === null) {
      throw new Error('Did not get back user payload');
    }
    this.user = payload as unknown as EviqoUserModel;
  }

  /**
   * Query devices associated with the account
   */
  async queryDevices(): Promise<void> {
    logger.debug('Sending device query message...');

    await this.sendMessage(
      {
        docType: 'DEVICE',
        mode: 'MATCH_ALL',
        viewType: 'LIST',
        filters: [
          {
            type: 'SUB_SEGMENT',
            filters: [],
            mode: 'MATCH_ANY',
            isCurrent: true,
          },
        ],
        offset: 0,
        limit: 17,
        order: 'ASC',
        sortBy: 'Name',
      },
      0x01,
      0x1b,
      0x00,
      undefined,
      'DEVICE QUERY'
    );

    const { payload } = await this.listen();
    const deviceResponse = payload as unknown as EviqoDeviceQueryModel;

    for (const device of deviceResponse.docs) {
      const deviceDetails = device[1] as DeviceDocs;
      this.devices.push(deviceDetails);
      logger.info(
        `Found device name='${deviceDetails.name}' deviceId=${deviceDetails.deviceId}`
      );
    }
  }

  /**
   * Request charging status for a device
   *
   * @param deviceId - Device ID to query
   * @returns Device page model with widgets and status
   */
  async requestChargingStatus(
    deviceId: number
  ): Promise<EviqoDevicePageModel> {
    if (this.ws === null) {
      throw new Error(
        'Cannot request charging status before websocket is created'
      );
    }

    const pageId = '17948'; // Magic number from Python implementation

    logger.debug('Requesting charging status...');

    await this.sendMessage(
      String(deviceId),
      0x00,
      0x49,
      0x01,
      undefined,
      'DEVICE NUMBER'
    );

    // Expect one message
    let result = await this.listen();
    logger.debug(JSON.stringify(result.header));
    logger.debug(JSON.stringify(result.payload));

    await this.sendMessage(
      {
        pageId,
        deviceId: String(deviceId),
        dashboardPageId: null,
      },
      0x01,
      0x04,
      0x00,
      undefined,
      'DEVICE PAGE'
    );

    result = await this.listen();
    return result.payload as unknown as EviqoDevicePageModel;
  }

  /**
   * Get formatted timestamp
   *
   * @returns Timestamp in HH:MM:SS format
   */
  getTimestamp(): string {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  }

  /**
   * Extract widget ID to name mappings from dashboard JSON
   *
   * @param deviceIdx - Device index
   * @param devicePage - Device page model
   */
  extractWidgetMappings(
    deviceIdx: number,
    devicePage: EviqoDevicePageModel
  ): void {
    const dashboard = devicePage.dashboard;
    const widgets = dashboard.widgets;

    let deviceWidgetIdMap = this.widgetIdMap.get(deviceIdx);
    if (!deviceWidgetIdMap) {
      deviceWidgetIdMap = new Map<string, DisplayDataStream>();
      this.widgetIdMap.set(deviceIdx, deviceWidgetIdMap);
    }

    let deviceWidgetNameMap = this.widgetNameMap.get(deviceIdx);
    if (!deviceWidgetNameMap) {
      deviceWidgetNameMap = new Map<string, DisplayDataStream>();
      this.widgetNameMap.set(deviceIdx, deviceWidgetNameMap);
    }

    let deviceWidgetPinMap = this.widgetPinMap.get(deviceIdx);
    if (!deviceWidgetPinMap) {
      deviceWidgetPinMap = new Map<string, DisplayDataStream>();
      this.widgetPinMap.set(deviceIdx, deviceWidgetPinMap);
    }

    for (const widget of widgets) {
      const modules = widget.modules;
      for (const module of modules) {
        const displayDataStreams = module.displayDataStreams;
        for (const stream of displayDataStreams) {
          deviceWidgetIdMap.set(String(stream.id), stream);
          deviceWidgetNameMap.set(stream.name, stream);
          deviceWidgetPinMap.set(String(stream.pin), stream);
        }
      }
    }

    if (deviceWidgetIdMap.size > 0) {
      const sortedEntries = Array.from(deviceWidgetIdMap.entries()).sort(
        (a, b) => {
          const aNum = /^\d+$/.test(a[0]) ? parseInt(a[0], 10) : 0;
          const bNum = /^\d+$/.test(b[0]) ? parseInt(b[0], 10) : 0;
          return aNum - bNum;
        }
      );

      for (const [wid, stream] of sortedEntries) {
        logger.debug(`  ID ${wid}: ${JSON.stringify(stream, null, 2)}`);
      }
    }
  }

  /**
   * Handle widget update message
   *
   * Looks up widget information and emits widgetUpdate event
   *
   * @param payload - Parsed widget update payload from protocol
   */
  private handleWidgetUpdate(payload: Record<string, unknown>): void {
    // Note: widgetId in the message is actually the pin number
    const { widgetId: pin, deviceId, widgetValue } = payload as {
      widgetId: string;
      deviceId: string;
      widgetValue: string;
    };

    if (!pin || !deviceId) {
      logger.debug('Widget update missing required fields');
      return;
    }

    // Find the device index for this device ID
    let deviceIdx = -1;
    for (let i = 0; i < this.devices.length; i++) {
      if (String(this.devices[i].deviceId) === deviceId) {
        deviceIdx = i;
        break;
      }
    }

    if (deviceIdx === -1) {
      logger.debug(`Unknown device ID in widget update: ${deviceId}`);
      return;
    }

    // Look up widget by pin number (the message contains pin, not widget id)
    const deviceWidgetPinMap = this.widgetPinMap.get(deviceIdx);
    if (!deviceWidgetPinMap) {
      logger.debug(`No widget pin map for device index ${deviceIdx}`);
      return;
    }

    const widgetStream = deviceWidgetPinMap.get(pin);
    if (!widgetStream) {
      logger.debug(`Unknown pin: ${pin}`);
      return;
    }

    logger.debug(
      `${this.getTimestamp()} [${widgetStream.name}] = ${widgetValue}`
    );

    this.emit('widgetUpdate', {
      widgetId: pin,
      widgetStream,
      deviceId,
      widgetValue,
      time: new Date(),
    });
  }


  /**
   * Listen for incoming messages
   *
   * @param duration - Timeout duration in seconds (default: 10)
   * @returns Parsed message with header and payload
   */
  async listen(
    duration = 10
  ): Promise<{
    header: MessageHeader | null;
    payload: Record<string, unknown> | string | null;
  }> {
    logger.debug(`Listening for messages for ${duration} seconds...`);

    if (this.ws === null) {
      logger.error('Cannot listen, websocket not created');
      return { header: null, payload: null };
    }

    try {
      // Declare handler in outer scope so both promises can access it
      let messageHandler: ((message: WebSocket.Data) => void) | null = null;

      return await Promise.race([
        new Promise<{
          header: MessageHeader | null;
          payload: Record<string, unknown> | string | null;
        }>((resolve) => {
          messageHandler = (message: WebSocket.Data) => {
            if (message instanceof Buffer) {
              logger.debug(`RECEIVED BINARY (${message.length} bytes):`);
              const { header, payload } = parseBinaryMessage(message);

              if (header && header.payloadType === 'widget_update') {
                this.handleWidgetUpdate(payload as Record<string, unknown>);
              }

              if (messageHandler) {
                this.ws?.removeListener('message', messageHandler);
                messageHandler = null; // Prevent double removal
              }
              resolve({ header, payload });
            }
          };

          this.ws?.on('message', messageHandler);
        }),
        new Promise<{
          header: MessageHeader | null;
          payload: Record<string, unknown> | string | null;
        }>((resolve) => {
          setTimeout(() => {
            logger.debug('Listening period ended');
            if (messageHandler) {
              this.ws?.removeListener('message', messageHandler);
              messageHandler = null; // Prevent double removal
            }
            resolve({ header: null, payload: null });
          }, duration * 1000);
        }),
      ]);
    } catch (error) {
      logger.error(`Error while listening: ${error}`);
      return { header: null, payload: null };
    }
  }

  /**
   * Send a command to control a device widget
   *
   * Command format: 0x00 0x14 0x00 msgId + deviceId\0vw\0pin\0value
   *
   * @param deviceId - Device ID string (e.g., "51627")
   * @param pin - Pin number string (e.g., "3" for Current)
   * @param value - Value string (e.g., "32" for 32 amps)
   */
  async sendCommand(deviceId: string, pin: string, value: string): Promise<void> {
    // Build payload: deviceId\0vw\0pin\0value
    const payload = `${deviceId}\0vw\0${pin}\0${value}`;

    await this.sendMessage(
      payload,
      0x00,
      0x14,
      0x00,
      undefined,
      `COMMAND device=${deviceId} pin=${pin} value=${value}`
    );

    // Emit commandSent event so listeners can update state immediately
    this.emit('commandSent', {
      deviceId,
      pin,
      value,
      time: new Date(),
    });
  }

  /**
   * Send a binary message to the WebSocket
   *
   * Message format (4-byte header):
   * - byte1, byte2, byte3, byte4
   * - Payload
   *
   * @param payload - Message payload (object, string, or null)
   * @param byte1 - First header byte
   * @param byte2 - Second header byte (often message type)
   * @param byte3 - Third header byte
   * @param byte4 - Fourth header byte (auto-increment if undefined)
   * @param description - Description for logging
   */
  async sendMessage(
    payload: Record<string, unknown> | string | null = null,
    byte1 = 0x00,
    byte2 = 0x00,
    byte3 = 0x00,
    byte4: number | undefined = undefined,
    description = ''
  ): Promise<void> {
    if (this.ws === null) {
      logger.error('Error sending, websocket not created');
      return;
    }

    try {
      let actualByte4 = byte4;
      if (actualByte4 === undefined) {
        actualByte4 = this.messageCounter;
        this.messageCounter += 1;
      }

      const message = createBinaryMessage(payload, byte1, byte2, byte3, actualByte4);
      logger.info(`SENDING ${description} [byte4=${actualByte4}, counter=${this.messageCounter}]`);
      logger.debug(`Outbound hex: ${message.toString('hex')}`);
      this.ws.send(message);
    } catch (error) {
      logger.error(`Error sending message: ${error}`);
    }
  }

  /**
   * Main exploration routine
   *
   * Connects to Eviqo, authenticates, queries devices, and monitors updates
   *
   * @param justScan - If true, only scan devices and exit (default: false)
   */
  async run(justScan = false): Promise<void> {
    if (!(await this.connect())) {
      return;
    }

    try {
      // Skip init - official client doesn't send it
      await this.login();
      await this.queryDevices();

      if (this.devices.length === 0) {
        throw new Error('No devices found');
      }

      // Just first device for now
      const device = this.devices[0];
      if (device.deviceId === undefined) {
        throw new Error('Device ID was not set');
      }

      this.devicePages.push(await this.requestChargingStatus(device.deviceId));
      this.extractWidgetMappings(0, this.devicePages[0]);
      await this.keepalive();

      // Continue listening for any other messages
      while (!justScan) {
        await this.keepalive();
        await this.listen(20);
      }
    } finally {
      if (this.ws) {
        this.ws.close();
        logger.debug('Connection closed');
      }
    }
  }

  /**
   * Get user information
   */
  getUser(): EviqoUserModel | null {
    return this.user;
  }

  /**
   * Get discovered devices
   */
  getDevices(): DeviceDocs[] {
    return this.devices;
  }

  /**
   * Get device pages
   */
  getDevicePages(): EviqoDevicePageModel[] {
    return this.devicePages;
  }

  /**
   * Check if websocket is connected and ready
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
