import { logger } from './logger';

/**
 * Binary message header information
 */
export interface MessageHeader {
  byte1: number;
  byte2: number;
  byte3: number;
  byte4: number;
  hasPayload: boolean;
  headerHex: string;
  totalLength: number;
  payloadType?: string;
}

/**
 * Parsed message result
 */
export interface ParsedMessage {
  header: MessageHeader | null;
  payload: Record<string, unknown> | string | null;
}

/**
 * Parse binary message with 4-byte header
 *
 * Message format:
 * - 4 bytes: header (byte1, byte2, byte3, byte4)
 * - Remaining bytes: payload (JSON, ASCII, UTF-8, or binary)
 *
 * @param data - Binary message data
 * @returns Parsed header and payload
 */
export function parseBinaryMessage(data: Buffer): ParsedMessage {
  if (data.length < 4) {
    return { header: null, payload: null };
  }

  // Extract header bytes
  const byte1 = data[0];
  const byte2 = data[1];
  const byte3 = data[2];
  const byte4 = data[3];

  const hasPayload = data.length > 4;

  const header: MessageHeader = {
    byte1,
    byte2,
    byte3,
    byte4,
    hasPayload,
    headerHex: data.subarray(0, 4).toString('hex'),
    totalLength: data.length,
  };

  // Try to extract payload if present
  let payload: Record<string, unknown> | string | null = null;
  let payloadType: string | undefined;

  if (hasPayload) {
    const payloadData = data.subarray(4);

    // Check if this is a widget update message (byte2 == 0x14)
    // or a user-driven update message (byte2 == 0x19)
    if (byte2 === 0x14 || byte2 === 0x19) {
      payloadType = 'widget_update';
      payload = parseWidgetUpdate(payloadData);
    } else {
      // Try JSON first
      try {
        const jsonStr = payloadData.toString('utf-8');
        payload = JSON.parse(jsonStr) as Record<string, unknown>;
        payloadType = 'json';
      } catch {
        // Try as ASCII text
        try {
          const asciiStr = payloadData.toString('ascii');
          // Check if it's printable
          if (isPrintable(asciiStr)) {
            payload = asciiStr;
            payloadType = 'ascii';
          } else {
            // Try UTF-8
            try {
              const utf8Str = payloadData.toString('utf-8');
              if (isPrintable(utf8Str)) {
                payload = utf8Str;
                payloadType = 'text';
              } else {
                // Binary data
                payloadType = 'binary';
                payload = {
                  hex: payloadData.toString('hex'),
                  length: payloadData.length,
                  preview:
                    payloadData.length > 50
                      ? payloadData.subarray(0, 50).toString('hex')
                      : payloadData.toString('hex'),
                };
              }
            } catch {
              // Pure binary data
              payloadType = 'binary';
              payload = {
                hex: payloadData.toString('hex'),
                length: payloadData.length,
                preview:
                  payloadData.length > 50
                    ? payloadData.subarray(0, 50).toString('hex')
                    : payloadData.toString('hex'),
              };
            }
          }
        } catch {
          // Pure binary data
          payloadType = 'binary';
          payload = {
            hex: payloadData.toString('hex'),
            length: payloadData.length,
            preview:
              payloadData.length > 50
                ? payloadData.subarray(0, 50).toString('hex')
                : payloadData.toString('hex'),
          };
        }
      }
    }
  }

  header.payloadType = payloadType;

  if (typeof payload === 'object' && payload !== null) {
    logger.debug('Received dictionary');
  } else if (typeof payload === 'string') {
    logger.debug('Received ascii');
  }

  return { header, payload };
}

/**
 * Parse widget update message format
 *
 * Format: device_id \x00 ?? \x00 widget_id \x00 widget_value
 *
 * @param payloadData - Widget update payload
 * @returns Parsed widget update data
 */
export function parseWidgetUpdate(
  payloadData: Buffer
): Record<string, unknown> {
  logger.debug('BEGIN: parse_widget_update');

  try {
    // Split by null terminators
    const parts = payloadData.toString('binary').split('\x00');

    if (parts.length < 2) {
      return {
        error: 'Insufficient null terminators',
        rawHex: payloadData.toString('hex'),
      };
    }

    // Parse parts
    const deviceId = parts[0];
    const widgetId = parts.length > 2 ? parts[2] : '';
    const widgetValue = parts.length > 3 ? parts[3] : '';

    return {
      widgetId,
      deviceId,
      widgetValue,
    };
  } catch (error) {
    return {
      error: `Failed to parse widget update: ${error}`,
      rawHex: payloadData.toString('hex'),
    };
  }
}

/**
 * Create binary message with 4-byte header
 *
 * Message format:
 * - 4 bytes: header (byte1, byte2, byte3, byte4)
 * - Remaining bytes: payload (JSON, ASCII, UTF-8, or binary)
 *
 * @param payload - Message payload (object, string, or null)
 * @param byte1 - First header byte
 * @param byte2 - Second header byte (often message type)
 * @param byte3 - Third header byte
 * @param byte4 - Fourth header byte (often message ID)
 * @returns Binary message as Buffer
 */
export function createBinaryMessage(
  payload: Record<string, unknown> | string | null = null,
  byte1 = 0x00,
  byte2 = 0x00,
  byte3 = 0x00,
  byte4 = 0x00
): Buffer {
  // Build 4-byte header
  const header = Buffer.from([byte1, byte2, byte3, byte4]);

  // Add payload if present
  if (typeof payload === 'string') {
    const payloadBytes = Buffer.from(payload, 'utf-8');
    return Buffer.concat([header, payloadBytes]);
  } else if (payload !== null) {
    const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf-8');
    return Buffer.concat([header, payloadBytes]);
  }

  return header;
}

/**
 * Create a command message for controlling device widgets
 *
 * Command format (web client):
 * - 4 bytes: header (0x00, 0x14, 0x00, msgId)
 * - Payload: deviceId\0vw\0pin\0value (no trailing null)
 *
 * @param deviceId - Device ID string (e.g., "51627")
 * @param pin - Pin number string (e.g., "3" for Current)
 * @param value - Value string (e.g., "32" for 32 amps)
 * @param messageId - Message ID (0-255, goes in byte4)
 * @returns Command message as Buffer
 */
export function createCommandMessage(
  deviceId: string,
  pin: string,
  value: string,
  messageId: number
): Buffer {
  // 4-byte header: 00 14 00 XX
  const header = Buffer.from([0x00, 0x14, 0x00, messageId & 0xff]);

  // Build payload: deviceId\0vw\0pin\0value (no trailing null on value)
  const payload = Buffer.from(
    `${deviceId}\x00vw\x00${pin}\x00${value}`,
    'binary'
  );

  return Buffer.concat([header, payload]);
}

/**
 * Check if a string contains only printable characters
 *
 * @param str - String to check
 * @returns True if all characters are printable
 */
function isPrintable(str: string): boolean {
  // Check if string contains only printable ASCII characters (0x20-0x7E) or common whitespace
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Allow space (0x20) to ~ (0x7E), plus newline (0x0A), carriage return (0x0D), and tab (0x09)
    if (
      !(
        (code >= 0x20 && code <= 0x7e) ||
        code === 0x0a ||
        code === 0x0d ||
        code === 0x09
      )
    ) {
      return false;
    }
  }
  return true;
}
