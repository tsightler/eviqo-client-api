# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-24

### Added
- Initial Node.js/TypeScript port of the Python evipy library
- Full WebSocket-based communication with Eviqo cloud services
- Real-time monitoring of Eviqo charging stations
- Event-based architecture using EventEmitter for widget updates
- Complete TypeScript type definitions for all models
- Password hashing utility matching Python implementation
- Binary protocol parser and builder
- Custom logger with configurable log levels
- Comprehensive unit tests for utilities
- Example monitoring script
- Full API documentation in README
- Support for Node.js 18+

### Changed
- Replaced Python's `multiprocessing.Queue` with EventEmitter pattern
- Replaced Pydantic models with TypeScript interfaces
- Adapted Python's `asyncio` to Node.js native `async/await`
- Replaced Python's `bytes` with Node.js `Buffer`

### Technical Details
- Written in TypeScript 5.2
- Uses `ws` library for WebSocket communication
- Uses `axios` for HTTP requests
- Uses `zod` for runtime validation (optional)
- Includes ESLint, Prettier, and Jest for code quality
- Supports both CommonJS and ES modules

## Project Structure

```
nodejs/
├── src/
│   ├── client.ts              # Main WebSocket client
│   ├── index.ts               # Public API exports
│   ├── models/                # TypeScript type definitions
│   │   ├── user.ts
│   │   ├── device-page.ts
│   │   ├── device-query.ts
│   │   └── widget-update.ts
│   └── utils/                 # Utilities
│       ├── hash.ts            # Password hashing
│       ├── logger.ts          # Logging utility
│       └── protocol.ts        # Binary protocol
├── examples/
│   └── monitor.ts             # Example usage
├── tests/                     # Unit tests
│   ├── hash.test.ts
│   ├── logger.test.ts
│   └── protocol.test.ts
└── dist/                      # Compiled output
```

## Migration Guide from Python

If you're migrating from the Python version, here are the key differences:

### Import Changes
**Python:**
```python
from evipy import EviqoWebsocketConnection, WS_URL
```

**Node.js:**
```typescript
import { EviqoWebsocketConnection, WS_URL } from 'evipy';
```

### Event Handling
**Python:**
```python
while not explorer.update_queue.empty():
    update = explorer.update_queue.get()
    print(update)
```

**Node.js:**
```typescript
client.on('widgetUpdate', (update) => {
  console.log(update);
});
```

### Running
**Python:**
```python
asyncio.run(explorer.run())
```

**Node.js:**
```typescript
await client.run();
```

### Type Hints
**Python:**
```python
def calculate_hash(user: str, password: str) -> str:
```

**Node.js:**
```typescript
function calculateHash(email: string, password: string): string {
```

[1.0.0]: https://github.com/zacharyasmith/evipy/releases/tag/v1.0.0
