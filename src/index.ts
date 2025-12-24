/**
 * Eviqo Node.js Client
 *
 * A Node.js library for controlling Eviqo devices via cloud connection.
 * Monitor your Eviqo charging stations and retrieve real-time data through WebSocket communication.
 *
 * @packageDocumentation
 */

// Main client
export { EviqoWebsocketConnection, WS_URL } from './client';

// Models
export type {
  IpInfo as UserIpInfo,
  User,
  Role,
  Address,
  SmsSettings,
  Organization,
  GeneralSettings,
  EviqoUserModel,
} from './models/user';

export type {
  LifecycleStatus,
  IpInfo,
  Header,
  Row,
  MetaField,
  HardwareInfo,
  TabPage,
  Visualization,
  OnOffDataStream,
  Visualization1,
  DisplayDataStream,
  Module,
  Widget,
  Dashboard,
  EviqoDevicePageModel,
} from './models/device-page';

export type { DeviceDocs, EviqoDeviceQueryModel } from './models/device-query';
export type { WidgetUpdate } from './models/widget-update';

// Utilities
export { calculateHash } from './utils/hash';
export { logger, Logger, LogLevel } from './utils/logger';
export {
  parseBinaryMessage,
  parseWidgetUpdate,
  createBinaryMessage,
} from './utils/protocol';

// Re-export types
export type { MessageHeader, ParsedMessage } from './utils/protocol';
