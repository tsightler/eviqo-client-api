/**
 * Tests for binary protocol parser/builder
 */

import {
  createBinaryMessage,
  createCommandMessage,
  parseBinaryMessage,
  parseWidgetUpdate,
} from '../src/utils/protocol';

describe('createBinaryMessage', () => {
  it('should create a header-only message', () => {
    const message = createBinaryMessage(null, 0x06, 0x0005);
    expect(message).toBeInstanceOf(Buffer);
    expect(message.length).toBe(3);
    expect(message[0]).toBe(0x06); // message type
    expect(message[1]).toBe(0x00); // message ID high byte
    expect(message[2]).toBe(0x05); // message ID low byte
  });

  it('should create a message with string payload', () => {
    const message = createBinaryMessage('test', 0x49, 0x0003);
    expect(message.length).toBeGreaterThan(3);
    expect(message[0]).toBe(0x49);
    expect(message[1]).toBe(0x00);
    expect(message[2]).toBe(0x03);
    const payload = message.subarray(3).toString('utf-8');
    expect(payload).toBe('test');
  });

  it('should create a message with JSON payload', () => {
    const payload = { key: 'value', number: 42 };
    const message = createBinaryMessage(payload, 0x02, 0x0000);
    expect(message.length).toBeGreaterThan(3);
    expect(message[0]).toBe(0x02);
    const parsedPayload = JSON.parse(message.subarray(3).toString('utf-8'));
    expect(parsedPayload).toEqual(payload);
  });

  it('should use default values', () => {
    const message = createBinaryMessage(null);
    expect(message[0]).toBe(0x00); // default message type
    expect(message[1]).toBe(0x00); // default message ID high
    expect(message[2]).toBe(0x00); // default message ID low
  });

  it('should create keepalive message like official client', () => {
    // Official: 06 00 06
    const message = createBinaryMessage(null, 0x06, 0x0006);
    expect(message.toString('hex')).toBe('060006');
  });

  it('should create login message like official client', () => {
    // Official: 02 00 00 {...json...}
    const message = createBinaryMessage({ email: 'test' }, 0x02, 0x0000);
    expect(message[0]).toBe(0x02);
    expect(message[1]).toBe(0x00);
    expect(message[2]).toBe(0x00);
  });
});

describe('parseBinaryMessage', () => {
  it('should parse a header-only message', () => {
    const message = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const { header, payload } = parseBinaryMessage(message);

    expect(header).not.toBeNull();
    expect(header?.byte1).toBe(0x01);
    expect(header?.byte2).toBe(0x02);
    expect(header?.byte3).toBe(0x03);
    expect(header?.byte4).toBe(0x04);
    expect(header?.hasPayload).toBe(false);
    expect(payload).toBeNull();
  });

  it('should parse a message with JSON payload', () => {
    const payloadObj = { test: 'value', number: 123 };
    const payloadBytes = Buffer.from(JSON.stringify(payloadObj), 'utf-8');
    const header = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const message = Buffer.concat([header, payloadBytes]);

    const { header: parsedHeader, payload } = parseBinaryMessage(message);

    expect(parsedHeader).not.toBeNull();
    expect(parsedHeader?.hasPayload).toBe(true);
    expect(parsedHeader?.payloadType).toBe('json');
    expect(payload).toEqual(payloadObj);
  });

  it('should parse a message with ASCII payload', () => {
    const payloadStr = 'test-string';
    const payloadBytes = Buffer.from(payloadStr, 'ascii');
    const header = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const message = Buffer.concat([header, payloadBytes]);

    const { header: parsedHeader, payload } = parseBinaryMessage(message);

    expect(parsedHeader).not.toBeNull();
    expect(parsedHeader?.hasPayload).toBe(true);
    expect(typeof payload).toBe('string');
    expect(payload).toBe(payloadStr);
  });

  it('should handle messages shorter than 4 bytes', () => {
    const message = Buffer.from([0x01, 0x02]);
    const { header, payload } = parseBinaryMessage(message);

    expect(header).toBeNull();
    expect(payload).toBeNull();
  });

  it('should detect widget update messages', () => {
    // Widget update has byte2 = 0x14
    const payloadBytes = Buffer.from('89349\x00vw\x005\x00241.29', 'binary');
    const header = Buffer.from([0x00, 0x14, 0x00, 0x00]);
    const message = Buffer.concat([header, payloadBytes]);

    const { header: parsedHeader, payload } = parseBinaryMessage(message);

    expect(parsedHeader).not.toBeNull();
    expect(parsedHeader?.byte2).toBe(0x14);
    expect(parsedHeader?.payloadType).toBe('widget_update');
    expect(payload).toBeDefined();
    expect(typeof payload).toBe('object');
  });

  it('should detect user-driven update messages', () => {
    // User-driven update has byte2 = 0x19
    const payloadBytes = Buffer.from('89349\x00vw\x005\x00123.45', 'binary');
    const header = Buffer.from([0x00, 0x19, 0x00, 0x00]);
    const message = Buffer.concat([header, payloadBytes]);

    const { header: parsedHeader, payload } = parseBinaryMessage(message);

    expect(parsedHeader).not.toBeNull();
    expect(parsedHeader?.byte2).toBe(0x19);
    expect(parsedHeader?.payloadType).toBe('widget_update');
    expect(payload).toBeDefined();
    expect(typeof payload).toBe('object');

    // Verify the payload is correctly parsed
    const update = payload as Record<string, unknown>;
    expect(update.deviceId).toBe('89349');
    expect(update.widgetId).toBe('5');
    expect(update.widgetValue).toBe('123.45');
  });
});

describe('parseWidgetUpdate', () => {
  it('should parse a valid widget update', () => {
    const payloadData = Buffer.from(
      '89349\x00vw\x005\x00241.29',
      'binary'
    );
    const result = parseWidgetUpdate(payloadData);

    expect(result.deviceId).toBe('89349');
    expect(result.widgetId).toBe('5');
    expect(result.widgetValue).toBe('241.29');
  });

  it('should handle malformed widget updates', () => {
    const payloadData = Buffer.from('invalid', 'binary');
    const result = parseWidgetUpdate(payloadData);

    expect(result.error).toBeDefined();
    expect(result.rawHex).toBeDefined();
  });

  it('should handle empty payloads', () => {
    const payloadData = Buffer.from('', 'binary');
    const result = parseWidgetUpdate(payloadData);

    expect(result.error).toBeDefined();
  });
});

describe('createCommandMessage', () => {
  it('should create a command message with correct format', () => {
    // Test case from documentation: Set Current to 32 Amps
    const message = createCommandMessage('51627', '3', '32', 0x00bb);

    // Expected: 14 00 bb 35 31 36 32 37 00 76 77 00 33 00 33 32 00
    expect(message[0]).toBe(0x14); // Command type
    expect(message[1]).toBe(0x00); // Message ID high byte
    expect(message[2]).toBe(0xbb); // Message ID low byte

    // Payload starts at byte 3 (no trailing null on value)
    const payload = message.subarray(3).toString('binary');
    expect(payload).toBe('51627\x00vw\x003\x0032');
  });

  it('should create a command message for setting current to 40', () => {
    const message = createCommandMessage('51627', '3', '40', 0x00bc);

    expect(message[0]).toBe(0x14);
    expect(message[1]).toBe(0x00);
    expect(message[2]).toBe(0xbc);

    const payload = message.subarray(3).toString('binary');
    expect(payload).toBe('51627\x00vw\x003\x0040');
  });

  it('should create a command message for start charging', () => {
    // Pin 1 = Start/Stop Charge, value 1 = ON
    const message = createCommandMessage('51627', '1', '1', 0x00bd);

    expect(message[0]).toBe(0x14);
    expect(message[1]).toBe(0x00);
    expect(message[2]).toBe(0xbd);

    const payload = message.subarray(3).toString('binary');
    expect(payload).toBe('51627\x00vw\x001\x001');
  });

  it('should handle message ID wrap-around', () => {
    const message = createCommandMessage('12345', '3', '16', 0xffff);

    expect(message[1]).toBe(0xff);
    expect(message[2]).toBe(0xff);
  });

  it('should match expected hex output for 32A command', () => {
    const message = createCommandMessage('51627', '3', '32', 0x00bb);
    // Expected: 14 00 bb 35 31 36 32 37 00 76 77 00 33 00 33 32 (no trailing null)
    const expectedHex = '1400bb35313632370076770033003332';

    expect(message.toString('hex')).toBe(expectedHex);
  });
});
