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
  createCommandMessage,
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

        this.ws.on('open', () => {
          logger.debug('Connected successfully!');
          resolve(true);
        });

        this.ws.on('error', (error) => {
          logger.error(`WebSocket error: ${error.message}`);
          reject(error);
        });

        this.ws.on('close', () => {
          logger.debug('WebSocket closed');
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
      logger.info('Issue keepalive');
      this.keepaliveTimer = new Date();
      await this.sendMessage(null, 0x06, 'KEEPALIVE');
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

    // Message type 0x30 for init
    await this.sendMessage(initPayload, 0x30, 'INIT');

    const { payload } = await this.listen();
    if (payload === null) {
      throw new Error('Init message failed');
    }
  }

  /**
   * Send login message with hashed password
   *
   * Message type 0x02 for login
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
      0x02,
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
   *
   * Message type 0x1b for device query
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
      0x1b,
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

    // Message type 0x49 for device number/selection
    await this.sendMessage(String(deviceId), 0x49, 'DEVICE NUMBER');

    // Expect one message
    let result = await this.listen();
    logger.debug(JSON.stringify(result.header));
    logger.debug(JSON.stringify(result.payload));

    // Message type 0x04 for device page request
    await this.sendMessage(
      {
        pageId,
        deviceId: String(deviceId),
        dashboardPageId: null,
      },
      0x04,
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

    for (const widget of widgets) {
      const modules = widget.modules;
      for (const module of modules) {
        const displayDataStreams = module.displayDataStreams;
        for (const stream of displayDataStreams) {
          deviceWidgetIdMap.set(String(stream.id), stream);
          deviceWidgetNameMap.set(stream.name, stream);
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
    const { widgetId, deviceId, widgetValue } = payload as {
      widgetId: string;
      deviceId: string;
      widgetValue: string;
    };

    if (!widgetId || !deviceId) {
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

    const deviceWidgetIdMap = this.widgetIdMap.get(deviceIdx);
    if (!deviceWidgetIdMap) {
      logger.debug(`No widget map for device index ${deviceIdx}`);
      return;
    }

    const widgetStream = deviceWidgetIdMap.get(widgetId);
    if (!widgetStream) {
      logger.debug(`Unknown widget ID: ${widgetId}`);
      return;
    }

    logger.info(
      `${this.getTimestamp()} [${widgetStream.name}] = ${widgetValue}`
    );

    this.emit('widgetUpdate', {
      widgetId,
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
      return await Promise.race([
        new Promise<{
          header: MessageHeader | null;
          payload: Record<string, unknown> | string | null;
        }>((resolve) => {
          const messageHandler = (message: WebSocket.Data) => {
            if (message instanceof Buffer) {
              logger.debug(`RECEIVED BINARY (${message.length} bytes):`);
              const { header, payload } = parseBinaryMessage(message);

              if (header && header.payloadType === 'widget_update') {
                this.handleWidgetUpdate(payload as Record<string, unknown>);
              }

              this.ws?.removeListener('message', messageHandler);
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
   * Command format:
   * - Byte 0: 0x14 (virtual write command type)
   * - Bytes 1-2: Message ID (2 bytes, big-endian)
   * - Payload: deviceId\0vw\0pin\0value\0
   *
   * @param deviceId - Device ID string (e.g., "51627")
   * @param pin - Pin number string (e.g., "3" for Current)
   * @param value - Value string (e.g., "32" for 32 amps)
   */
  async sendCommand(deviceId: string, pin: string, value: string): Promise<void> {
    if (this.ws === null) {
      logger.error('Error sending command, websocket not created');
      return;
    }

    try {
      const msgId = this.messageCounter;
      this.messageCounter += 1;

      const message = createCommandMessage(deviceId, pin, value, msgId);

      logger.info(
        `SENDING COMMAND: device=${deviceId} pin=${pin} value=${value} [msgId=${msgId}, counter=${this.messageCounter}]`
      );
      logger.info(`Outbound hex: ${message.toString('hex')}`);

      this.ws.send(message);
    } catch (error) {
      logger.error(`Error sending command: ${error}`);
    }
  }

  /**
   * Send a binary message to the WebSocket
   *
   * Message format (3-byte header):
   * - 1 byte: message type
   * - 2 bytes: message ID (big-endian, auto-incremented)
   * - Payload
   *
   * @param payload - Message payload (object, string, or null)
   * @param messageType - Message type byte (e.g., 0x02 for login, 0x06 for keepalive)
   * @param description - Description for logging
   */
  async sendMessage(
    payload: Record<string, unknown> | string | null = null,
    messageType = 0x00,
    description = ''
  ): Promise<void> {
    if (this.ws === null) {
      logger.error('Error sending, websocket not created');
      return;
    }

    try {
      const msgId = this.messageCounter;
      this.messageCounter += 1;

      const message = createBinaryMessage(payload, messageType, msgId);
      logger.info(`SENDING ${description} [type=0x${messageType.toString(16)}, msgId=${msgId}]`);
      logger.info(`Outbound hex: ${message.toString('hex')}`);
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
      await this.issueInitialization();
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
}
