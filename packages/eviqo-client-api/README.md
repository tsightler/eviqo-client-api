# eviqo-client-api

[![npm version](https://badge.fury.io/js/eviqo-client-api.svg)](https://badge.fury.io/js/eviqo-client-api)
[![Node.js 18+](https://img.shields.io/badge/node-18+-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)

A Node.js/TypeScript client library for Eviqo EV charging stations. Control and monitor your Eviqo devices via cloud WebSocket connection with full TypeScript support.

**This is a Node.js/TypeScript port of the original Python [evipy](https://github.com/zacharyasmith/evipy) library.**

## Features

- ✅ Real-time monitoring of Eviqo charging stations
- ✅ WebSocket-based communication with Eviqo cloud services
- ✅ Live widget updates and device status tracking
- ✅ Automatic session management and authentication
- ✅ Full TypeScript support with type definitions
- ✅ Event-based architecture with EventEmitter
- ✅ Comprehensive error handling
- ✅ Unit tested utilities

## Installation

Install eviqo-client-api from npm:

```bash
npm install eviqo-client-api
```

Or with yarn:

```bash
yarn add eviqo-client-api
```

## Quick Start

### Prerequisites

Before using eviqo-client-api, you need to set up your Eviqo credentials as environment variables:

```bash
export EVIQO_EMAIL="your-email@example.com"
export EVIQO_PASSWORD="your-password"
```

Alternatively, create a `.env` file in your project directory:

```env
EVIQO_EMAIL=your-email@example.com
EVIQO_PASSWORD=your-password
```

### Basic Usage

```typescript
import { EviqoWebsocketConnection, WS_URL } from 'eviqo-client-api';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  // Create client
  const client = new EviqoWebsocketConnection(
    WS_URL,
    null,
    process.env.EVIQO_EMAIL,
    process.env.EVIQO_PASSWORD
  );

  // Listen for widget updates
  client.on('widgetUpdate', (update) => {
    console.log('Widget Update:', {
      widgetId: update.widgetId,
      widgetName: update.widgetStream.name,
      deviceId: update.deviceId,
      widgetValue: update.widgetValue,
      time: update.time,
    });
  });

  // Connect and start monitoring
  await client.run();
}

main().catch(console.error);
```

### Running the Example

The library includes an example monitoring script:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the example (from the nodejs directory)
ts-node examples/monitor.ts
```

## API Documentation

### EviqoWebsocketConnection

Main client class for connecting to Eviqo cloud services.

#### Constructor

```typescript
new EviqoWebsocketConnection(
  url: string,
  sessionId?: string | null,
  username?: string | null,
  password?: string | null
)
```

**Parameters:**
- `url` - WebSocket URL (use exported `WS_URL` constant)
- `sessionId` - Optional session ID for authentication
- `username` - Eviqo account email
- `password` - Eviqo account password

#### Methods

##### `async connect(): Promise<boolean>`
Connect to the Eviqo WebSocket server.

**Returns:** `true` if connection successful, `false` otherwise

##### `async run(justScan?: boolean): Promise<void>`
Main method to connect, authenticate, and monitor devices.

**Parameters:**
- `justScan` - If `true`, only scan devices and exit (default: `false`)

##### `async login(): Promise<void>`
Authenticate with Eviqo cloud using credentials.

##### `async queryDevices(): Promise<void>`
Query and discover devices associated with the account.

##### `async requestChargingStatus(deviceId: number): Promise<EviqoDevicePageModel>`
Request detailed charging status for a specific device.

**Parameters:**
- `deviceId` - The device ID to query

**Returns:** Device page model with widgets and status

##### `getUser(): EviqoUserModel | null`
Get authenticated user information.

##### `getDevices(): DeviceDocs[]`
Get list of discovered devices.

##### `getDevicePages(): EviqoDevicePageModel[]`
Get list of device pages with detailed information.

#### Events

The client extends `EventEmitter` and emits the following events:

##### `widgetUpdate`
Emitted when a widget update is received from a device.

**Event Data:**
```typescript
{
  widgetId: string;
  widgetStream: DisplayDataStream;
  deviceId: string;
  widgetValue: string;
  time: Date;
}
```

**Example:**
```typescript
client.on('widgetUpdate', (update) => {
  console.log(`Widget ${update.widgetId}: ${update.widgetValue}`);
});
```

### Utilities

#### `calculateHash(email: string, password: string): string`
Calculate the password hash for Eviqo authentication.

#### Logger

```typescript
import { logger, LogLevel } from 'eviqo-client-api';

// Set log level
logger.setLevel(LogLevel.DEBUG); // DEBUG, INFO, WARN, ERROR

// Log messages
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
```

## TypeScript Support

This library is written in TypeScript and includes full type definitions. All models and interfaces are exported for use in your TypeScript projects.

```typescript
import {
  EviqoWebsocketConnection,
  EviqoUserModel,
  EviqoDevicePageModel,
  DeviceDocs,
  WidgetUpdate,
} from 'eviqo-client-api';
```

## Development

### Setting up Development Environment

1. Clone the repository:
```bash
git clone https://github.com/tsightler/eviqo-client-api.git
cd eviqo-client-api
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment variables as described above.

### Building

```bash
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality

This project uses:
- **ESLint** for linting
- **Prettier** for code formatting
- **TypeScript** for type checking
- **Jest** for testing

Run quality checks:

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## Requirements

- Node.js 18.0.0 or higher
- TypeScript 5.2 or higher (for development)
- Eviqo account with device access
- Internet connection for cloud communication

## Differences from Python Version

This Node.js port maintains API compatibility with the original Python library while adapting to Node.js/TypeScript conventions:

- **Event-based architecture**: Uses `EventEmitter` instead of `multiprocessing.Queue`
- **TypeScript types**: Full type definitions instead of Pydantic models
- **Promise-based**: Uses native `async/await` instead of Python's `asyncio`
- **Buffer API**: Uses Node.js `Buffer` instead of Python `bytes`
- **Logging**: Custom logger matching Python's logging format

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`npm test && npm run lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Issues and Support

If you encounter any issues or have questions:

- **Bug Reports**: [GitHub Issues](https://github.com/tsightler/eviqo-client-api/issues)
- **Feature Requests**: [GitHub Issues](https://github.com/tsightler/eviqo-client-api/issues)
- **Questions**: [GitHub Discussions](https://github.com/tsightler/eviqo-client-api/discussions)

When reporting bugs, please include:
- Node.js version (`node --version`)
- eviqo-client-api version (`npm list eviqo-client-api`)
- Error messages and stack traces
- Steps to reproduce the issue

## Related Projects

- **evipy (Python)**: Original Python implementation
- **eviqo-hacs**: Home Assistant Custom Component for Eviqo integration

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This is an unofficial library and is not affiliated with or endorsed by Eviqo. Use at your own risk.

## Acknowledgments

- Original Python implementation by [Zach](https://github.com/zacharyasmith)
- Ported to Node.js/TypeScript by Claude Code (with help from [tsightler](https://github.com/tsightler))
