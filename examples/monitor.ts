/**
 * Example: Monitor Eviqo devices
 *
 * This script demonstrates how to use the Eviqo client to:
 * 1. Connect to the Eviqo cloud service
 * 2. Authenticate using credentials
 * 3. Discover devices
 * 4. Monitor real-time widget updates
 *
 * Usage:
 *   ts-node examples/monitor.ts
 *
 * Environment variables required:
 *   EVIQO_EMAIL - Your Eviqo account email
 *   EVIQO_PASSWORD - Your Eviqo account password
 */

import * as dotenv from 'dotenv';
import { EviqoWebsocketConnection, WS_URL, logger, LogLevel } from '../src';

// Load environment variables
dotenv.config();

async function main(): Promise<void> {
  const sessionId = process.env.SESSION_ID || null;
  const eviqoEmail = process.env.EVIQO_EMAIL || null;
  const eviqoPassword = process.env.EVIQO_PASSWORD || null;

  if (!eviqoPassword && !eviqoEmail) {
    if (!sessionId) {
      throw new Error(
        'SESSION_ID required if not using EVIQO_EMAIL and EVIQO_PASSWORD'
      );
    }
  }

  // Create client
  const explorer = new EviqoWebsocketConnection(
    WS_URL,
    sessionId,
    eviqoEmail,
    eviqoPassword
  );

  // Listen for widget updates
  explorer.on('widgetUpdate', (update) => {
    console.log('Widget Update:', {
      widget_id: update.widgetId,
      widget_name: update.widgetStream.name,
      device_id: update.deviceId,
      widget_value: update.widgetValue,
      time: update.time.toISOString(),
    });
  });

  // Run the client
  await explorer.run();
}

// Run main function
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
