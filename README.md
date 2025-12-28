# EVIQO Project

This monorepo contains packages for interacting with the EVIQO L2 EVSE, including an API client that implements authentication and websocket parsing, and an MQTT gateway.

The initial versions of the API were ported from the [evipy project](https://github.com/zacharyasmith/evipy) and much credit should go to the author of that project for the initial reverse engineering work.

## Packages

| Package | Description |
|---------|-------------|
| [eviqo-client-api](./packages/eviqo-client-api) | Node.js/TypeScript client library for EVIQO L2 EVSE  |
| [eviqo-mqtt](./packages/eviqo-mqtt) | EVIQO-to-MQTT gateway with Home Assistant auto-discovery support |

## Installation Options

### Home Assistant Add-on (Recommended)

Add the repository to your Home Assistant Add-on Store:

1. Go to **Settings** → **Add-ons** → **Add-on Store**
2. Click the menu (⋮) → **Repositories**
3. Add: `https://github.com/tsightler/eviqo`
4. Find "Eviqo MQTT" and click **Install**

The add-on uses automatic MQTT discovery by default. The `mqtt_url` defaults to:
```
mqtt://auto_username:auto_password@auto_hostname
```
Any `auto_*` values are automatically replaced with settings from your Mosquitto broker add-on.

### Docker

```bash
docker run -d \
  --name eviqo-mqtt \
  --restart unless-stopped \
  -e EVIQO_EMAIL=your@email.com \
  -e EVIQO_PASSWORD=yourpassword \
  -e EVIQO_MQTT_URL=mqtt://192.168.1.100:1883 \
  ghcr.io/tsightler/eviqo-mqtt-amd64
```

Available architectures: `amd64`, `aarch64`, `armv7`, `armhf`

### Docker Compose

```yaml
version: '3'
services:
  eviqo-mqtt:
    image: ghcr.io/tsightler/eviqo-mqtt-amd64
    restart: unless-stopped
    environment:
      - EVIQO_EMAIL=your@email.com
      - EVIQO_PASSWORD=yourpassword
      - EVIQO_MQTT_URL=mqtt://192.168.1.100:1883
      # With authentication:
      # - EVIQO_MQTT_URL=mqtt://user:pass@192.168.1.100:1883
      # - EVIQO_LOG_LEVEL=debug
```

### NPM (Development)

```bash
# Set credentials
export EVIQO_EMAIL="user@example.com"
export EVIQO_PASSWORD="password"
export EVIQO_MQTT_URL="mqtt://localhost:1883"

# Run the gateway
npx eviqo-mqtt
```

## Home Assistant Entities

Once connected, the following entities will be automatically discovered:

### Sensors
- **Status** - Charger state (unplugged, plugged, charging, stopped)
- **Voltage** - Line voltage (V)
- **Power** - Charging power (kW)
- **Amperage** - Current draw (A)
- **Session Duration** - Current session length
- **Session Power** - Energy delivered (kWh)
- **Session Cost** - Session cost

### Controls
- **Charging** - Switch to start/stop charging
- **Current Limit** - Slider to set max current (0-48A)

## Client API

```typescript
import { EviqoWebsocketConnection, WS_URL } from 'eviqo-client-api';

const client = new EviqoWebsocketConnection(
  WS_URL,
  null,
  'user@example.com',
  'password'
);

client.on('widgetUpdate', (update) => {
  console.log(`${update.widgetStream.name}: ${update.widgetValue}`);
});

await client.run();
```

## Development

This is an npm workspaces monorepo.

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run the MQTT gateway locally
npm start -w eviqo-mqtt

# Build Docker image
docker build -t eviqo-mqtt .
```

## Building Docker Images

```bash
# Build for local architecture
docker build -t eviqo-mqtt .

# Build for specific architecture
docker build --build-arg BUILD_ARCH=aarch64 -t eviqo-mqtt-aarch64 .
```

## License

MIT
