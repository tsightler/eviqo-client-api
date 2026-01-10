/**
 * Configuration management for Eviqo MQTT Gateway
 */

export interface MqttConfig {
  url: string;
  clientId: string;
  keepalive: number;
  reconnectPeriod: number;
}

export interface EviqoConfig {
  email: string;
  password: string;
}

export interface GatewayConfig {
  mqtt: MqttConfig;
  eviqo: EviqoConfig;
  topicPrefix: string;
  discoveryPrefix: string;
  pollInterval: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Interval in ms to force websocket reconnection (default: 24 hours). Set to 0 to disable. */
  wsReconnectInterval: number;
}

/**
 * Build MQTT URL from environment, replacing auto_* placeholders with
 * discovered values from EVIQO_MQTT_HOST, EVIQO_MQTT_USER, EVIQO_MQTT_PASS
 */
function buildMqttUrl(): string {
  const mqttUrl = process.env.EVIQO_MQTT_URL;
  if (!mqttUrl) {
    throw new Error('EVIQO_MQTT_URL environment variable is required');
  }

  // Parse the URL to handle auto_* placeholders
  const url = new URL(mqttUrl);

  // Replace auto_hostname with discovered host
  if (url.hostname === 'auto_hostname') {
    const host = process.env.EVIQO_MQTT_HOST;
    if (!host) {
      throw new Error('MQTT auto-discovery failed: EVIQO_MQTT_HOST not set');
    }
    url.hostname = host;
  }

  // Add port from auto-discovery if not specified and available
  if (!url.port && process.env.EVIQO_MQTT_PORT) {
    url.port = process.env.EVIQO_MQTT_PORT;
  }

  // Replace auto_username with discovered username
  if (url.username === 'auto_username') {
    const user = process.env.EVIQO_MQTT_USER;
    if (user) {
      url.username = user;
    } else {
      // No username available, remove credentials
      url.username = '';
      url.password = '';
    }
  }

  // Replace auto_password with discovered password
  if (url.password === 'auto_password' && url.username) {
    const pass = process.env.EVIQO_MQTT_PASS;
    if (pass) {
      url.password = pass;
    } else {
      url.password = '';
    }
  }

  return url.toString();
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): GatewayConfig {
  const config: GatewayConfig = {
    mqtt: {
      url: buildMqttUrl(),
      clientId: process.env.MQTT_CLIENT_ID || `eviqo-mqtt-${Date.now()}`,
      keepalive: parseInt(process.env.MQTT_KEEPALIVE || '60', 10),
      reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD || '5000', 10),
    },
    eviqo: {
      email: process.env.EVIQO_EMAIL || '',
      password: process.env.EVIQO_PASSWORD || '',
    },
    topicPrefix: process.env.EVIQO_TOPIC_PREFIX || 'eviqo',
    discoveryPrefix: process.env.HASS_DISCOVERY_PREFIX || 'homeassistant',
    pollInterval: parseInt(process.env.EVIQO_POLL_INTERVAL || '30000', 10),
    logLevel: (process.env.EVIQO_LOG_LEVEL as GatewayConfig['logLevel']) || 'info',
    wsReconnectInterval: parseInt(process.env.EVIQO_WS_RECONNECT_INTERVAL || '86400000', 10), // 24 hours default
  };

  // Validate required configuration
  if (!config.eviqo.email || !config.eviqo.password) {
    throw new Error('EVIQO_EMAIL and EVIQO_PASSWORD environment variables are required');
  }

  return config;
}
