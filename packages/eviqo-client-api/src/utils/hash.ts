import { createHash } from 'crypto';

/**
 * Calculate the password hash for Eviqo authentication
 *
 * Algorithm:
 * 1. Hash the email (lowercase) with SHA256
 * 2. Concatenate password + email hash
 * 3. Hash the concatenation with SHA256
 * 4. Base64 encode the result
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns Base64-encoded hash for authentication
 *
 * @example
 * ```typescript
 * const hash = calculateHash('user@example.com', 'password123');
 * // Use hash for authentication
 * ```
 */
export function calculateHash(email: string, password: string): string {
  // Hash the email (lowercase) with SHA256
  const emailHash = createHash('sha256')
    .update(email.toLowerCase())
    .digest();

  // Concatenate password + email hash, then hash again
  const combined = Buffer.concat([
    Buffer.from(password, 'utf-8'),
    emailHash,
  ]);

  const finalHash = createHash('sha256')
    .update(combined)
    .digest();

  // Base64 encode and return as ASCII string
  return finalHash.toString('base64');
}
