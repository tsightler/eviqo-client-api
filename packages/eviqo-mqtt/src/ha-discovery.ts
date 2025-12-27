/**
 * Home Assistant MQTT Auto-Discovery
 *
 * Implements Home Assistant MQTT discovery protocol for automatic device detection.
 * See: https://www.home-assistant.io/integrations/mqtt/#mqtt-discovery
 */

import type { MqttClient } from 'mqtt';
import type { EviqoDevicePageModel, DisplayDataStream } from 'eviqo-client-api';

export interface DeviceInfo {
  identifiers: string[];
  name: string;
  manufacturer: string;
  model: string;
  sw_version?: string;
  hw_version?: string;
  configuration_url?: string;
}

export interface HaEntityConfig {
  name: string;
  unique_id: string;
  state_topic: string;
  device: DeviceInfo;
  availability_topic?: string;
  payload_available?: string;
  payload_not_available?: string;
  // Sensor specific
  device_class?: string;
  unit_of_measurement?: string;
  state_class?: string;
  value_template?: string;
  icon?: string;
  // Switch/button specific
  command_topic?: string;
  payload_on?: string;
  payload_off?: string;
}

/**
 * Map widget names to Home Assistant device classes and units
 */
const WIDGET_MAPPINGS: Record<string, { device_class?: string; unit?: string; state_class?: string; icon?: string }> = {
  // Power and energy
  'Charging Power': { device_class: 'power', unit: 'kW', state_class: 'measurement' },
  'Power': { device_class: 'power', unit: 'kW', state_class: 'measurement' },
  'Energy': { device_class: 'energy', unit: 'kWh', state_class: 'total_increasing' },
  'Total Energy': { device_class: 'energy', unit: 'kWh', state_class: 'total_increasing' },
  'Session Energy': { device_class: 'energy', unit: 'kWh', state_class: 'total_increasing' },

  // Electrical
  'Voltage': { device_class: 'voltage', unit: 'V', state_class: 'measurement' },
  'Current': { device_class: 'current', unit: 'A', state_class: 'measurement' },
  'Frequency': { device_class: 'frequency', unit: 'Hz', state_class: 'measurement' },

  // Temperature
  'Temperature': { device_class: 'temperature', unit: '°C', state_class: 'measurement' },
  'Charger Temperature': { device_class: 'temperature', unit: '°C', state_class: 'measurement' },

  // Time/Duration
  'Charging Time': { device_class: 'duration', unit: 's', state_class: 'measurement', icon: 'mdi:timer' },
  'Session Duration': { device_class: 'duration', unit: 's', state_class: 'measurement', icon: 'mdi:timer' },

  // Status
  'Status': { icon: 'mdi:ev-station' },
  'Charging Status': { icon: 'mdi:ev-station' },
  'Connection Status': { icon: 'mdi:connection' },

  // Battery/SoC
  'State of Charge': { device_class: 'battery', unit: '%', state_class: 'measurement' },
  'SoC': { device_class: 'battery', unit: '%', state_class: 'measurement' },
  'Battery': { device_class: 'battery', unit: '%', state_class: 'measurement' },
};

/**
 * Normalize widget name for MQTT topic (lowercase, underscores)
 */
function normalizeTopicName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Create device info object for Home Assistant
 */
export function createDeviceInfo(device: EviqoDevicePageModel): DeviceInfo {
  return {
    identifiers: [`eviqo_${device.id}`],
    name: device.name || `Eviqo Charger ${device.id}`,
    manufacturer: 'Eviqo',
    model: device.productName || 'EV Charger',
    sw_version: device.hardwareInfo?.version,
    hw_version: device.hardwareInfo?.build,
    configuration_url: 'https://app.eviqo.io/dashboard',
  };
}

/**
 * Create Home Assistant sensor discovery config
 */
export function createSensorConfig(
  discoveryPrefix: string,
  topicPrefix: string,
  device: EviqoDevicePageModel,
  stream: DisplayDataStream
): { topic: string; payload: HaEntityConfig } {
  const deviceId = `eviqo_${device.id}`;
  const sensorId = normalizeTopicName(stream.name);
  const uniqueId = `${deviceId}_${sensorId}`;

  const mapping = WIDGET_MAPPINGS[stream.name] || {};

  // Use units from the stream if available, otherwise from mapping
  const unit = stream.units || mapping.unit;

  const config: HaEntityConfig = {
    name: stream.name,
    unique_id: uniqueId,
    state_topic: `${topicPrefix}/${device.id}/sensor/${sensorId}/state`,
    device: createDeviceInfo(device),
    availability_topic: `${topicPrefix}/${device.id}/status`,
    payload_available: 'online',
    payload_not_available: 'offline',
  };

  if (mapping.device_class) {
    config.device_class = mapping.device_class;
  }
  if (unit) {
    config.unit_of_measurement = unit;
  }
  if (mapping.state_class) {
    config.state_class = mapping.state_class;
  }
  if (mapping.icon) {
    config.icon = mapping.icon;
  }

  const topic = `${discoveryPrefix}/sensor/${deviceId}/${sensorId}/config`;

  return { topic, payload: config };
}

/**
 * Create Home Assistant binary sensor discovery config (for status values)
 */
export function createBinarySensorConfig(
  discoveryPrefix: string,
  topicPrefix: string,
  device: EviqoDevicePageModel,
  name: string,
  deviceClass?: string
): { topic: string; payload: HaEntityConfig } {
  const deviceId = `eviqo_${device.id}`;
  const sensorId = normalizeTopicName(name);
  const uniqueId = `${deviceId}_${sensorId}`;

  const config: HaEntityConfig = {
    name,
    unique_id: uniqueId,
    state_topic: `${topicPrefix}/${device.id}/binary_sensor/${sensorId}/state`,
    device: createDeviceInfo(device),
    availability_topic: `${topicPrefix}/${device.id}/status`,
    payload_available: 'online',
    payload_not_available: 'offline',
    payload_on: 'ON',
    payload_off: 'OFF',
  };

  if (deviceClass) {
    config.device_class = deviceClass;
  }

  const topic = `${discoveryPrefix}/binary_sensor/${deviceId}/${sensorId}/config`;

  return { topic, payload: config };
}

/**
 * Publish Home Assistant discovery configs for a device
 */
export async function publishDeviceDiscovery(
  mqttClient: MqttClient,
  discoveryPrefix: string,
  topicPrefix: string,
  device: EviqoDevicePageModel
): Promise<void> {
  const dashboard = device.dashboard;

  // Publish sensor configs for each widget stream
  for (const widget of dashboard.widgets) {
    for (const module of widget.modules) {
      for (const stream of module.displayDataStreams) {
        const { topic, payload } = createSensorConfig(
          discoveryPrefix,
          topicPrefix,
          device,
          stream
        );

        await publishRetained(mqttClient, topic, JSON.stringify(payload));
      }
    }
  }

  // Publish connectivity binary sensor
  const connectivityConfig = createBinarySensorConfig(
    discoveryPrefix,
    topicPrefix,
    device,
    'Connectivity',
    'connectivity'
  );
  await publishRetained(mqttClient, connectivityConfig.topic, JSON.stringify(connectivityConfig.payload));

  // Publish charging binary sensor
  const chargingConfig = createBinarySensorConfig(
    discoveryPrefix,
    topicPrefix,
    device,
    'Charging',
    'battery_charging'
  );
  await publishRetained(mqttClient, chargingConfig.topic, JSON.stringify(chargingConfig.payload));
}

/**
 * Remove Home Assistant discovery configs for a device
 */
export async function removeDeviceDiscovery(
  mqttClient: MqttClient,
  discoveryPrefix: string,
  device: EviqoDevicePageModel
): Promise<void> {
  const deviceId = `eviqo_${device.id}`;
  const dashboard = device.dashboard;

  // Remove sensor configs
  for (const widget of dashboard.widgets) {
    for (const module of widget.modules) {
      for (const stream of module.displayDataStreams) {
        const sensorId = normalizeTopicName(stream.name);
        const topic = `${discoveryPrefix}/sensor/${deviceId}/${sensorId}/config`;
        await publishRetained(mqttClient, topic, '');
      }
    }
  }

  // Remove binary sensor configs
  const binarySensors = ['connectivity', 'charging'];
  for (const sensorId of binarySensors) {
    const topic = `${discoveryPrefix}/binary_sensor/${deviceId}/${sensorId}/config`;
    await publishRetained(mqttClient, topic, '');
  }
}

/**
 * Helper to publish a retained message
 */
function publishRetained(client: MqttClient, topic: string, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { retain: true }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
