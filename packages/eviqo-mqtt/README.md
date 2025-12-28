# Eviqo MQTT

MQTT gateway for EVIQO EVSE units with Home Assistant auto-discovery support.

## Overview

This gateway bridges your EVIQO EVSE unit and exposes the data to MQTT, enabling integration with:
- Home Assistant (via MQTT auto-discovery)
- Node-RED
- Any MQTT-compatible home automation system

## Features

- **Real-time Updates**: Receives live widget updates from Eviqo cloud
- **Multiple Sensors**: Charging status, power, voltage, current, temperature, and more
- **Command Support**: Set current limit, manually start/stop charging via MQTT commands
- **Home Assistant Auto-Discovery**: Automatic device and entity creation
- **Automatic Reconnection**: Handles connection drops gracefully

## Installation

```bash
npm install eviqo-mqtt
```

Or run directly with npx:

```bash
npx eviqo-mqtt
```

## Quick Start

### Using Environment Variables

```bash
# Required
export EVIQO_EMAIL="your-email@example.com"
export EVIQO_PASSWORD="your-password"

# Optional MQTT settings
export MQTT_HOST="localhost"
export MQTT_PORT="1883"

# Start the gateway
npx eviqo-mqtt
```

### Using a .env File

Create a `.env` file in your working directory:

```env
EVIQO_EMAIL=your-email@example.com
EVIQO_PASSWORD=your-password

MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=mqtt-user
MQTT_PASSWORD=mqtt-pass

HASS_DISCOVERY=true
HASS_DISCOVERY_PREFIX=homeassistant

EVIQO_TOPIC_PREFIX=eviqo
LOG_LEVEL=info
```

Then run:

```bash
npx eviqo-mqtt
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EVIQO_EMAIL` | *required* | Your Eviqo account email |
| `EVIQO_PASSWORD` | *required* | Your Eviqo account password |
| `MQTT_HOST` | `localhost` | MQTT broker hostname |
| `MQTT_PORT` | `1883` | MQTT broker port |
| `MQTT_USERNAME` | - | MQTT username (optional) |
| `MQTT_PASSWORD` | - | MQTT password (optional) |
| `MQTT_CLIENT_ID` | auto | MQTT client identifier |
| `HASS_DISCOVERY` | `true` | Enable Home Assistant discovery |
| `HASS_DISCOVERY_PREFIX` | `homeassistant` | Discovery topic prefix |
| `EVIQO_TOPIC_PREFIX` | `eviqo` | MQTT topic prefix for state |
| `EVIQO_POLL_INTERVAL` | `30000` | Polling interval in milliseconds |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |

## MQTT Topics

### State Topics

Device data is published to topics following this pattern:

```
eviqo/{device_id}/sensor/{sensor_name}/state
```

For example:
- `eviqo/12345/sensor/charging_power/state` - Current charging power
- `eviqo/12345/sensor/energy/state` - Total energy delivered
- `eviqo/12345/sensor/voltage/state` - Current voltage

### Status Topics

Device availability is published to:

```
eviqo/{device_id}/status
```

Values: `online` or `offline`

### Binary Sensors

```
eviqo/{device_id}/binary_sensor/connectivity/state
eviqo/{device_id}/binary_sensor/charging/state
```

## Home Assistant Integration

When `HASS_DISCOVERY=true` (default), the gateway automatically publishes discovery configs to:

```
homeassistant/sensor/eviqo_{device_id}/{sensor_name}/config
homeassistant/binary_sensor/eviqo_{device_id}/{sensor_name}/config
```

Home Assistant will automatically detect and create entities for:
- **Power**: Charging power (kW)
- **Energy**: Session and total energy (kWh)
- **Voltage**: Line voltage (V)
- **Current**: Charging current (A)
- **Temperature**: Charger temperature
- **Status**: Charging status
- **Connectivity**: Device online/offline state

### Removing Discovery Configs

To remove all Home Assistant discovery configs:

```bash
npx eviqo-mqtt --remove-discovery
```

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN npm install eviqo-mqtt
CMD ["npx", "eviqo-mqtt"]
```

```bash
docker run -d \
  -e EVIQO_EMAIL=your-email@example.com \
  -e EVIQO_PASSWORD=your-password \
  -e MQTT_HOST=192.168.1.100 \
  eviqo-mqtt
```

## Programmatic Usage

```typescript
import { EviqoMqttGateway, loadConfig } from 'eviqo-mqtt';

// Load config from environment
const config = loadConfig();

// Or create custom config
const config = {
  mqtt: {
    host: 'localhost',
    port: 1883,
    clientId: 'my-gateway',
    keepalive: 60,
    reconnectPeriod: 5000,
  },
  eviqo: {
    email: 'user@example.com',
    password: 'password',
  },
  homeAssistant: {
    enabled: true,
    discoveryPrefix: 'homeassistant',
  },
  topicPrefix: 'eviqo',
  pollInterval: 30000,
  logLevel: 'info',
};

const gateway = new EviqoMqttGateway(config);

// Listen for widget updates
gateway.on('widgetUpdate', (update) => {
  console.log(`${update.widgetStream.name}: ${update.widgetValue}`);
});

// Start the gateway
await gateway.start();

// Later, stop gracefully
await gateway.stop();
```

## Troubleshooting

### Debug Mode

Enable debug logging to see detailed connection and message information:

```bash
npx eviqo-mqtt --debug
```

Or set the environment variable:

```bash
LOG_LEVEL=debug npx eviqo-mqtt
```

### Common Issues

1. **"EVIQO_EMAIL and EVIQO_PASSWORD required"**
   - Ensure these environment variables are set

2. **"Failed to connect to MQTT broker"**
   - Check MQTT_HOST and MQTT_PORT are correct
   - Verify the broker is running and accessible
   - Check authentication credentials if required

3. **"No devices found"**
   - Verify your Eviqo credentials work in the official app
   - Ensure your charger is registered and online

## License

MIT

## Related

- [eviqo-client-api](../eviqo-client-api) - The underlying Eviqo API client

