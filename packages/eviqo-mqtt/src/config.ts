/**
 * Configuration management for Eviqo MQTT Gateway
 */

export interface MqttConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  clientId: string;
  keepalive: number;
  reconnectPeriod: number;
}

export interface EviqoConfig {
  email: string;
  password: string;
}

export interface HomeAssistantConfig {
  enabled: boolean;
  discoveryPrefix: string;
}

export interface GatewayConfig {
  mqtt: MqttConfig;
  eviqo: EviqoConfig;
  homeAssistant: HomeAssistantConfig;
  topicPrefix: string;
  pollInterval: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): GatewayConfig {
  const config: GatewayConfig = {
    mqtt: {
      host: process.env.MQTT_HOST || 'localhost',
      port: parseInt(process.env.MQTT_PORT || '1883', 10),
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: process.env.MQTT_CLIENT_ID || `eviqo-mqtt-${Date.now()}`,
      keepalive: parseInt(process.env.MQTT_KEEPALIVE || '60', 10),
      reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD || '5000', 10),
    },
    eviqo: {
      email: process.env.EVIQO_EMAIL || '',
      password: process.env.EVIQO_PASSWORD || '',
    },
    homeAssistant: {
      enabled: process.env.HASS_DISCOVERY !== 'false',
      discoveryPrefix: process.env.HASS_DISCOVERY_PREFIX || 'homeassistant',
    },
    topicPrefix: process.env.EVIQO_TOPIC_PREFIX || 'eviqo',
    pollInterval: parseInt(process.env.EVIQO_POLL_INTERVAL || '30000', 10),
    logLevel: (process.env.LOG_LEVEL as GatewayConfig['logLevel']) || 'info',
  };

  // Validate required configuration
  if (!config.eviqo.email || !config.eviqo.password) {
    throw new Error('EVIQO_EMAIL and EVIQO_PASSWORD environment variables are required');
  }

  return config;
}

/**
 * Get MQTT connection URL from config
 */
export function getMqttUrl(config: MqttConfig): string {
  const protocol = config.port === 8883 ? 'mqtts' : 'mqtt';
  return `${protocol}://${config.host}:${config.port}`;
}
