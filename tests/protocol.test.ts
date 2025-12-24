/**
 * Tests for binary protocol parser/builder
 */

import {
  createBinaryMessage,
  parseBinaryMessage,
  parseWidgetUpdate,
} from '../src/utils/protocol';

describe('createBinaryMessage', () => {
  it('should create a header-only message', () => {
    const message = createBinaryMessage(null, 0x01, 0x02, 0x03, 0x04);
    expect(message).toBeInstanceOf(Buffer);
    expect(message.length).toBe(4);
    expect(message[0]).toBe(0x01);
    expect(message[1]).toBe(0x02);
    expect(message[2]).toBe(0x03);
    expect(message[3]).toBe(0x04);
  });

  it('should create a message with string payload', () => {
    const message = createBinaryMessage('test', 0x01, 0x02, 0x03, 0x04);
    expect(message.length).toBeGreaterThan(4);
    const payload = message.subarray(4).toString('utf-8');
    expect(payload).toBe('test');
  });

  it('should create a message with JSON payload', () => {
    const payload = { key: 'value', number: 42 };
    const message = createBinaryMessage(payload, 0x01, 0x02, 0x03, 0x04);
    expect(message.length).toBeGreaterThan(4);
    const parsedPayload = JSON.parse(message.subarray(4).toString('utf-8'));
    expect(parsedPayload).toEqual(payload);
  });

  it('should use default header bytes', () => {
    const message = createBinaryMessage(null);
    expect(message[0]).toBe(0x00);
    expect(message[1]).toBe(0x00);
    expect(message[2]).toBe(0x00);
    expect(message[3]).toBe(0x00);
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
