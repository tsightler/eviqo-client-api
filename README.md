# Eviqo Monorepo

Monorepo containing packages for Eviqo EV charger integration.

## Packages

| Package | Description |
|---------|-------------|
| [eviqo-client-api](./packages/eviqo-client-api) | Node.js/TypeScript client library for Eviqo EV charging stations |
| [eviqo-mqtt](./packages/eviqo-mqtt) | MQTT gateway with Home Assistant auto-discovery support |

## Quick Start

### Client API

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

### MQTT Gateway

```bash
# Set credentials
export EVIQO_EMAIL="user@example.com"
export EVIQO_PASSWORD="password"
export MQTT_HOST="localhost"

# Run the gateway
npx eviqo-mqtt
```

## Development

This is an npm workspaces monorepo.

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Build specific package
npm run build -w eviqo-client-api
npm run build -w eviqo-mqtt
```

## License

MIT
