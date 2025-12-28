#!/usr/bin/env node
/**
 * Eviqo MQTT Gateway CLI
 *
 * Command-line interface for running the Eviqo MQTT gateway.
 */

import * as dotenv from 'dotenv';
import { logger, LogLevel } from 'eviqo-client-api';
import { loadConfig } from './config';
import { EviqoMqttGateway } from './gateway';

// Load environment variables from .env file
dotenv.config();

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Eviqo MQTT Gateway

Bridges Eviqo EV charger data to MQTT with Home Assistant auto-discovery.

Usage:
  eviqo-mqtt [options]

Options:
  --help, -h          Show this help message
  --version, -v       Show version information
  --debug             Enable debug logging
  --remove-discovery  Remove Home Assistant discovery configs and exit

Environment Variables:
  EVIQO_EMAIL        Eviqo account email (required)
  EVIQO_PASSWORD     Eviqo account password (required)
  EVIQO_MQTT_URL     MQTT broker URL (required)
                     Format: mqtt://[user:pass@]host[:port]
  EVIQO_LOG_LEVEL    Log level: debug, info, warn, error (default: info)

Examples:
  # Start the gateway
  EVIQO_EMAIL=user@example.com EVIQO_PASSWORD=pass \\
    EVIQO_MQTT_URL=mqtt://192.168.1.100:1883 eviqo-mqtt

  # With MQTT authentication
  EVIQO_MQTT_URL=mqtt://user:pass@192.168.1.100:1883 eviqo-mqtt

  # Start with debug logging
  EVIQO_LOG_LEVEL=debug eviqo-mqtt
`);
}

/**
 * Print version information
 */
function printVersion(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require('../package.json');
  console.log(`eviqo-mqtt-gateway v${pkg.version}`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle command-line arguments
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    printVersion();
    process.exit(0);
  }

  if (args.includes('--debug')) {
    logger.setLevel(LogLevel.DEBUG);
  }

  // Load configuration
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`Configuration error: ${error}`);
    console.error('\nRun with --help for usage information.');
    process.exit(1);
  }

  // Override log level if --debug flag is present
  if (args.includes('--debug')) {
    config.logLevel = 'debug';
  }

  // Create gateway
  const gateway = new EviqoMqttGateway(config);

  // Handle remove-discovery option
  if (args.includes('--remove-discovery')) {
    logger.info('Removing Home Assistant discovery configs...');
    try {
      await gateway.start();
      await gateway.removeDiscovery();
      await gateway.stop();
      logger.info('Done');
      process.exit(0);
    } catch (error) {
      logger.error(`Failed to remove discovery: ${error}`);
      process.exit(1);
    }
  }

  // Handle shutdown signals
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    try {
      await gateway.stop();
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error}`);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle state changes
  gateway.on('stateChange', (state) => {
    logger.info(`Gateway state: ${state}`);
  });

  // Start the gateway
  try {
    await gateway.start();

    logger.info('Gateway is running. Press Ctrl+C to stop.');

    // Keep the process alive
    await new Promise(() => {
      // This promise never resolves, keeping the process running
      // The shutdown handlers will terminate the process
    });
  } catch (error) {
    logger.error(`Gateway error: ${error}`);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
