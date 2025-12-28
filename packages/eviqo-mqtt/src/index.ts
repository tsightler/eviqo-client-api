/**
 * Eviqo MQTT Gateway
 *
 * MQTT gateway for Eviqo EV charging stations with Home Assistant auto-discovery support.
 *
 * @packageDocumentation
 */

// Main gateway class
export { EviqoMqttGateway, GatewayState } from './gateway';

// Configuration
export {
  GatewayConfig,
  MqttConfig,
  EviqoConfig,
  loadConfig,
} from './config';

// Home Assistant discovery
export {
  DeviceInfo,
  HaEntityConfig,
  createDeviceInfo,
  createSensorConfig,
  createBinarySensorConfig,
  publishDeviceDiscovery,
  removeDeviceDiscovery,
} from './ha-discovery';

// Re-export useful types from client API
export {
  WidgetUpdate,
  EviqoDevicePageModel,
  DeviceDocs,
  DisplayDataStream,
  logger,
  LogLevel,
} from 'eviqo-client-api';
