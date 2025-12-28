/**
 * Eviqo MQTT Gateway
 *
 * Bridges Eviqo EV charger data to MQTT with Home Assistant auto-discovery.
 */

import { EventEmitter } from 'events';
import * as mqtt from 'mqtt';
import {
  EviqoWebsocketConnection,
  WS_URL,
  logger,
  LogLevel,
  WidgetUpdate,
  EviqoDevicePageModel,
  DeviceDocs,
} from 'eviqo-client-api';
import { GatewayConfig } from './config';
import {
  publishDeviceDiscovery,
  removeDeviceDiscovery,
  CONTROLLABLE_WIDGETS,
  WIDGET_MAPPINGS,
  getTopicId,
} from './ha-discovery';

/**
 * Value transformers for specific widgets
 * Maps widget name to a function that transforms the raw value
 */
const VALUE_TRANSFORMERS: Record<string, (value: string) => string> = {
  Status: (value: string) => {
    const stateMap: Record<string, string> = {
      '0': 'unplugged',
      '1': 'plugged',
      '2': 'charging',
      '3': 'stopped',
    };
    return stateMap[value] || value;
  },
};

/**
 * Gateway state
 */
export type GatewayState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Main gateway class that bridges Eviqo API to MQTT
 */
export class EviqoMqttGateway extends EventEmitter {
  private config: GatewayConfig;
  private mqttClient: mqtt.MqttClient | null = null;
  private eviqoClient: EviqoWebsocketConnection | null = null;
  private devices: DeviceDocs[] = [];
  private devicePages: Map<number, EviqoDevicePageModel> = new Map();
  private state: GatewayState = 'disconnected';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shutdownRequested = false;
  // Map command topics to device/pin info for handling MQTT commands
  private commandTopicMap: Map<string, { deviceId: string; pin: string }> =
    new Map();
  // Reverse map from deviceId:pin to state topic for updating state after commands
  private pinToStateTopicMap: Map<string, string> = new Map();
  // Track current status per device (0=unplugged, 1=plugged, 2=charging, 3=stopped)
  private deviceStatus: Map<string, string> = new Map();
  // Map charging command topics to device IDs
  private chargingCommandTopicMap: Map<string, string> = new Map();

  constructor(config: GatewayConfig) {
    super();
    this.config = config;

    // Set log level
    const logLevelMap: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
    };
    logger.setLevel(logLevelMap[config.logLevel] || LogLevel.INFO);
  }

  /**
   * Get current gateway state
   */
  getState(): GatewayState {
    return this.state;
  }

  /**
   * Start the gateway
   */
  async start(): Promise<void> {
    this.shutdownRequested = false;
    this.setState('connecting');

    try {
      // Connect to MQTT broker
      await this.connectMqtt();

      // Connect to Eviqo API
      await this.connectEviqo();

      this.setState('connected');
      logger.info('Gateway started successfully');

      // Start monitoring loop
      this.monitorLoop();
    } catch (error) {
      logger.error(`Failed to start gateway: ${error}`);
      this.setState('error');
      throw error;
    }
  }

  /**
   * Stop the gateway gracefully
   */
  async stop(): Promise<void> {
    logger.info('Stopping gateway...');
    this.shutdownRequested = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Publish offline status for all devices
    if (this.mqttClient && this.mqttClient.connected) {
      for (const devicePage of this.devicePages.values()) {
        await this.publishDeviceOffline(devicePage);
      }
    }

    // Disconnect from MQTT
    if (this.mqttClient) {
      await new Promise<void>((resolve) => {
        this.mqttClient!.end(false, {}, () => {
          resolve();
        });
      });
      this.mqttClient = null;
    }

    // The Eviqo client will close when the connection ends
    this.eviqoClient = null;

    this.setState('disconnected');
    logger.info('Gateway stopped');
  }

  /**
   * Connect to MQTT broker
   */
  private async connectMqtt(): Promise<void> {
    // Mask credentials in log output
    const logUrl = this.config.mqtt.url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    logger.info(`Connecting to MQTT broker at ${logUrl}...`);

    const options: mqtt.IClientOptions = {
      clientId: this.config.mqtt.clientId,
      keepalive: this.config.mqtt.keepalive,
      reconnectPeriod: this.config.mqtt.reconnectPeriod,
      clean: true,
    };

    return new Promise((resolve, reject) => {
      this.mqttClient = mqtt.connect(this.config.mqtt.url, options);

      const connectHandler = () => {
        logger.info('Connected to MQTT broker');
        this.mqttClient!.removeListener('error', errorHandler);
        resolve();
      };

      const errorHandler = (error: Error) => {
        logger.error(`MQTT connection error: ${error.message}`);
        this.mqttClient!.removeListener('connect', connectHandler);
        reject(error);
      };

      this.mqttClient.once('connect', connectHandler);
      this.mqttClient.once('error', errorHandler);

      // Handle ongoing events
      this.mqttClient.on('reconnect', () => {
        logger.info('Reconnecting to MQTT broker...');
      });

      this.mqttClient.on('offline', () => {
        logger.warn('MQTT broker offline');
      });

      this.mqttClient.on('close', () => {
        if (!this.shutdownRequested) {
          logger.warn('MQTT connection closed unexpectedly');
        }
      });

      this.mqttClient.on('message', (topic, message) => {
        this.handleMqttMessage(topic, message.toString());
      });
    });
  }

  /**
   * Connect to Eviqo API and discover devices
   */
  private async connectEviqo(): Promise<void> {
    logger.info('Connecting to Eviqo API...');

    this.eviqoClient = new EviqoWebsocketConnection(
      WS_URL,
      null,
      this.config.eviqo.email,
      this.config.eviqo.password
    );

    // Set up widget update handler
    this.eviqoClient.on('widgetUpdate', (update: WidgetUpdate) => {
      this.handleWidgetUpdate(update);
    });

    // Set up command sent handler to update state immediately
    this.eviqoClient.on('commandSent', (command: { deviceId: string; pin: string; value: string }) => {
      this.handleCommandSent(command);
    });

    // Connect and authenticate
    if (!(await this.eviqoClient.connect())) {
      throw new Error('Failed to connect to Eviqo API');
    }

    // Initialize, login, and query devices
    await (this.eviqoClient as EviqoWebsocketConnectionInternal).issueInitialization();
    await this.eviqoClient.login();
    await this.eviqoClient.queryDevices();

    this.devices = this.eviqoClient.getDevices();

    if (this.devices.length === 0) {
      throw new Error('No devices found in Eviqo account');
    }

    logger.info(`Found ${this.devices.length} device(s)`);

    // Request status for each device
    for (const device of this.devices) {
      if (device.deviceId === undefined) continue;

      const devicePage = await this.eviqoClient.requestChargingStatus(device.deviceId);
      this.devicePages.set(device.deviceId, devicePage);

      // Extract widget mappings
      const deviceIdx = this.devices.indexOf(device);
      this.eviqoClient.extractWidgetMappings(deviceIdx, devicePage);

      // Publish Home Assistant discovery
      if (this.mqttClient) {
        await publishDeviceDiscovery(
          this.mqttClient,
          this.config.discoveryPrefix,
          this.config.topicPrefix,
          devicePage
        );
      }

      // Publish device online status
      await this.publishDeviceOnline(devicePage);

      // Publish initial widget values
      await this.publishInitialWidgetValues(devicePage);

      // Subscribe to command topics for controllable widgets
      await this.subscribeToCommandTopics(devicePage);

      logger.info(`Device "${devicePage.name}" (ID: ${devicePage.id}) initialized`);
    }
  }

  /**
   * Subscribe to command topics for controllable widgets and switches
   */
  private async subscribeToCommandTopics(
    device: EviqoDevicePageModel
  ): Promise<void> {
    if (!this.mqttClient || !this.mqttClient.connected) return;

    const dashboard = device.dashboard;

    for (const widget of dashboard.widgets) {
      for (const module of widget.modules) {
        for (const stream of module.displayDataStreams) {
          const controlSettings = CONTROLLABLE_WIDGETS[stream.name];
          if (controlSettings) {
            const entityId = controlSettings.topic_id;
            const commandTopic = `${this.config.topicPrefix}/${device.id}/${entityId}/set`;
            const stateTopic = `${this.config.topicPrefix}/${device.id}/${entityId}/state`;

            // Store mapping for handling commands
            this.commandTopicMap.set(commandTopic, {
              deviceId: String(device.id),
              pin: controlSettings.pin,
            });

            // Store reverse mapping for updating state after command sent
            const pinKey = `${device.id}:${controlSettings.pin}`;
            this.pinToStateTopicMap.set(pinKey, stateTopic);

            // Subscribe to the command topic
            this.mqttClient.subscribe(commandTopic, (err) => {
              if (err) {
                logger.error(`Failed to subscribe to ${commandTopic}: ${err}`);
              } else {
                logger.info(`Subscribed to command topic: ${commandTopic}`);
              }
            });
          }
        }
      }
    }

    // Subscribe to charging switch command topic
    const chargingCommandTopic = `${this.config.topicPrefix}/${device.id}/charging/set`;
    this.chargingCommandTopicMap.set(chargingCommandTopic, String(device.id));
    this.mqttClient.subscribe(chargingCommandTopic, (err) => {
      if (err) {
        logger.error(`Failed to subscribe to ${chargingCommandTopic}: ${err}`);
      } else {
        logger.info(`Subscribed to charging command topic: ${chargingCommandTopic}`);
      }
    });
  }

  /**
   * Main monitoring loop
   */
  private async monitorLoop(): Promise<void> {
    while (!this.shutdownRequested && this.eviqoClient) {
      try {
        // Send keepalive
        await this.eviqoClient.keepalive();

        // Listen for updates
        await this.eviqoClient.listen(this.config.pollInterval / 1000);
      } catch (error) {
        logger.error(`Monitor loop error: ${error}`);

        if (!this.shutdownRequested) {
          // Schedule reconnection
          this.scheduleReconnect();
          break;
        }
      }
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.shutdownRequested) return;

    logger.info('Scheduling reconnection in 30 seconds...');
    this.setState('connecting');

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connectEviqo();
        this.setState('connected');
        this.monitorLoop();
      } catch (error) {
        logger.error(`Reconnection failed: ${error}`);
        this.scheduleReconnect();
      }
    }, 30000);
  }

  /**
   * Publish a widget value to MQTT
   *
   * Handles topic construction, value transformation, and retain logic.
   * Publishes values for widgets in WIDGET_MAPPINGS (sensors) or CONTROLLABLE_WIDGETS (number entities).
   * @param retain - Whether to retain the message (defaults to false for updates, true for initial values)
   */
  private publishWidgetValue(
    deviceId: string | number,
    widgetName: string,
    rawValue: string,
    retain = false
  ): void {
    if (!this.mqttClient || !this.mqttClient.connected) return;

    // Check if this widget is a sensor (in WIDGET_MAPPINGS) or controllable (in CONTROLLABLE_WIDGETS)
    const isInWidgetMappings = widgetName in WIDGET_MAPPINGS;
    const controlSettings = CONTROLLABLE_WIDGETS[widgetName];

    // Only publish widgets that have a mapping defined
    if (!isInWidgetMappings && !controlSettings) return;

    // Apply value transformer if one exists for this widget
    const transformer = VALUE_TRANSFORMERS[widgetName];
    const publishValue = transformer ? transformer(rawValue) : rawValue;

    // Use topic_id from CONTROLLABLE_WIDGETS if available, otherwise use getTopicId
    const sensorId = controlSettings?.topic_id || getTopicId(widgetName);
    const topic = `${this.config.topicPrefix}/${deviceId}/${sensorId}/state`;

    logger.debug(`Publishing: ${topic} = ${publishValue} (retain=${retain})`);

    this.mqttClient.publish(topic, publishValue, { retain });

    // If this is Status, track the status and update the charging switch
    if (widgetName === 'Status') {
      // Track status for charging control logic
      this.deviceStatus.set(String(deviceId), rawValue);

      const chargingTopic = `${this.config.topicPrefix}/${deviceId}/charging/state`;
      const isCharging = rawValue === '2'; // 2 = charging
      this.mqttClient.publish(chargingTopic, isCharging ? 'ON' : 'OFF', { retain });
    }
  }

  /**
   * Handle widget update from Eviqo
   */
  private async handleWidgetUpdate(update: WidgetUpdate): Promise<void> {
    this.publishWidgetValue(
      update.deviceId,
      update.widgetStream.name,
      update.widgetValue
    );

    // Emit event for external handlers
    this.emit('widgetUpdate', update);
  }

  /**
   * Handle incoming MQTT message (for commands)
   */
  private async handleMqttMessage(topic: string, message: string): Promise<void> {
    logger.debug(`Received MQTT message on ${topic}: ${message}`);

    if (!this.eviqoClient) {
      logger.error('Cannot send command: Eviqo client not connected');
      return;
    }

    // Check if this is a charging command
    const chargingDeviceId = this.chargingCommandTopicMap.get(topic);
    if (chargingDeviceId) {
      await this.handleChargingCommand(chargingDeviceId, message.trim());
      return;
    }

    // Check if this is a controllable widget command
    const commandInfo = this.commandTopicMap.get(topic);
    if (!commandInfo) {
      logger.debug(`Unknown command topic: ${topic}`);
      return;
    }

    const { deviceId, pin } = commandInfo;
    const value = message.trim();

    logger.info(
      `Sending command: device=${deviceId} pin=${pin} value=${value}`
    );

    try {
      await this.eviqoClient.sendCommand(deviceId, pin, value);
      logger.info(`Command sent successfully`);
    } catch (error) {
      logger.error(`Failed to send command: ${error}`);
    }
  }

  /**
   * Handle charging switch command (ON/OFF)
   *
   * Command sequences based on current status:
   * - To STOP (status=2 charging): send 3 (stop), then 0
   * - To START (status=1 plugged): send 2 (start), then 0
   * - To START (status=3 stopped): send 1, then 0, wait 250ms, send 2, then 0
   */
  private async handleChargingCommand(deviceId: string, command: string): Promise<void> {
    const currentStatus = this.deviceStatus.get(deviceId);
    const chargingPin = '15'; // Pin for charging control

    logger.info(`Charging command: ${command} for device ${deviceId} (current status: ${currentStatus})`);

    try {
      if (command === 'OFF') {
        // Stop charging - only valid if currently charging (status=2)
        if (currentStatus !== '2') {
          logger.warn(`Cannot stop charging: device ${deviceId} is not charging (status=${currentStatus})`);
          return;
        }
        await this.eviqoClient!.sendCommand(deviceId, chargingPin, '3');
        await this.eviqoClient!.sendCommand(deviceId, chargingPin, '0');
        logger.info(`Charging stopped for device ${deviceId}`);
      } else if (command === 'ON') {
        // Start charging - depends on current status
        if (currentStatus === '0') {
          logger.warn(`Cannot start charging: device ${deviceId} is unplugged`);
          return;
        } else if (currentStatus === '2') {
          logger.info(`Device ${deviceId} is already charging`);
          return;
        } else if (currentStatus === '1') {
          // Plugged - send start command
          await this.eviqoClient!.sendCommand(deviceId, chargingPin, '2');
          await this.eviqoClient!.sendCommand(deviceId, chargingPin, '0');
          logger.info(`Charging started for device ${deviceId}`);
        } else if (currentStatus === '3') {
          // Stopped - need to unlock then start
          await this.eviqoClient!.sendCommand(deviceId, chargingPin, '1');
          await this.eviqoClient!.sendCommand(deviceId, chargingPin, '0');
          await new Promise(resolve => setTimeout(resolve, 250));
          await this.eviqoClient!.sendCommand(deviceId, chargingPin, '2');
          await this.eviqoClient!.sendCommand(deviceId, chargingPin, '0');
          logger.info(`Charging started for device ${deviceId} (from stopped state)`);
        } else {
          logger.warn(`Unknown status ${currentStatus} for device ${deviceId}`);
        }
      } else {
        logger.warn(`Unknown charging command: ${command}`);
      }
    } catch (error) {
      logger.error(`Failed to send charging command: ${error}`);
    }
  }

  /**
   * Handle command sent event - update MQTT state immediately
   */
  private handleCommandSent(command: { deviceId: string; pin: string; value: string }): void {
    if (!this.mqttClient || !this.mqttClient.connected) return;

    const pinKey = `${command.deviceId}:${command.pin}`;
    const stateTopic = this.pinToStateTopicMap.get(pinKey);

    if (!stateTopic) {
      logger.debug(`No state topic mapping for ${pinKey}`);
      return;
    }

    logger.info(`Updating state after command: ${stateTopic} = ${command.value}`);
    this.mqttClient.publish(stateTopic, command.value, { retain: false });
  }

  /**
   * Publish initial widget values for a device
   * Initial values are retained so HA can pick them up after a restart
   */
  private async publishInitialWidgetValues(device: EviqoDevicePageModel): Promise<void> {
    const dashboard = device.dashboard;

    for (const widget of dashboard.widgets) {
      for (const module of widget.modules) {
        for (const stream of module.displayDataStreams) {
          const rawValue = stream.visualization.value || '0';
          // Retain initial values so HA can see them after restart
          this.publishWidgetValue(device.id, stream.name, rawValue, true);
        }
      }
    }
  }

  /**
   * Publish device online status
   */
  private async publishDeviceOnline(device: EviqoDevicePageModel): Promise<void> {
    if (!this.mqttClient || !this.mqttClient.connected) return;

    const statusTopic = `${this.config.topicPrefix}/${device.id}/status`;
    this.mqttClient.publish(statusTopic, 'online', { retain: true });

    // Publish connectivity binary sensor
    const connectivityTopic = `${this.config.topicPrefix}/${device.id}/connectivity/state`;
    this.mqttClient.publish(connectivityTopic, 'ON', { retain: true });
  }

  /**
   * Publish device offline status
   */
  private async publishDeviceOffline(device: EviqoDevicePageModel): Promise<void> {
    if (!this.mqttClient || !this.mqttClient.connected) return;

    const statusTopic = `${this.config.topicPrefix}/${device.id}/status`;
    this.mqttClient.publish(statusTopic, 'offline', { retain: true });

    // Update connectivity binary sensor
    const connectivityTopic = `${this.config.topicPrefix}/${device.id}/connectivity/state`;
    this.mqttClient.publish(connectivityTopic, 'OFF', { retain: true });
  }

  /**
   * Remove Home Assistant discovery for all devices
   */
  async removeDiscovery(): Promise<void> {
    if (!this.mqttClient || !this.mqttClient.connected) {
      throw new Error('MQTT client not connected');
    }

    for (const devicePage of this.devicePages.values()) {
      await removeDeviceDiscovery(
        this.mqttClient,
        this.config.discoveryPrefix,
        devicePage
      );
    }

    logger.info('Removed Home Assistant discovery configs');
  }

  /**
   * Set gateway state and emit event
   */
  private setState(state: GatewayState): void {
    this.state = state;
    this.emit('stateChange', state);
  }
}

/**
 * Internal interface to access protected methods
 */
interface EviqoWebsocketConnectionInternal extends EviqoWebsocketConnection {
  issueInitialization(): Promise<void>;
}
