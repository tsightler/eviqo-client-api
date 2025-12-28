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
}

/**
 * Build MQTT URL from environment
 */
function buildMqttUrl(): string {
  // Use MQTT_URL environment variable
  if (process.env.MQTT_URL) {
    return process.env.MQTT_URL;
  }

  throw new Error('MQTT_URL environment variable is required');
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
    logLevel: (process.env.LOG_LEVEL as GatewayConfig['logLevel']) || 'info',
  };

  // Validate required configuration
  if (!config.eviqo.email || !config.eviqo.password) {
    throw new Error('EVIQO_EMAIL and EVIQO_PASSWORD environment variables are required');
  }

  return config;
}
