/**
 * Tests for password hashing utility
 */

import { calculateHash } from '../src/utils/hash';

describe('calculateHash', () => {
  it('should generate a base64-encoded hash', () => {
    const hash = calculateHash('test@example.com', 'password123');
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);

    // Base64 string should only contain valid base64 characters
    expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('should generate the same hash for the same inputs', () => {
    const hash1 = calculateHash('test@example.com', 'password123');
    const hash2 = calculateHash('test@example.com', 'password123');
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different emails', () => {
    const hash1 = calculateHash('test1@example.com', 'password123');
    const hash2 = calculateHash('test2@example.com', 'password123');
    expect(hash1).not.toBe(hash2);
  });

  it('should generate different hashes for different passwords', () => {
    const hash1 = calculateHash('test@example.com', 'password123');
    const hash2 = calculateHash('test@example.com', 'password456');
    expect(hash1).not.toBe(hash2);
  });

  it('should be case-insensitive for email', () => {
    const hash1 = calculateHash('Test@Example.Com', 'password123');
    const hash2 = calculateHash('test@example.com', 'password123');
    expect(hash1).toBe(hash2);
  });

  it('should handle empty strings', () => {
    const hash = calculateHash('', '');
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
  });
});
