/**
 * Tests for logger utility
 */

import { Logger, LogLevel } from '../src/utils/logger';

describe('Logger', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should create a logger instance', () => {
    const logger = new Logger('test');
    expect(logger).toBeDefined();
  });

  it('should log debug messages', () => {
    const logger = new Logger('test', LogLevel.DEBUG);
    logger.debug('test message');
    expect(consoleDebugSpy).toHaveBeenCalled();
  });

  it('should log info messages', () => {
    const logger = new Logger('test', LogLevel.INFO);
    logger.info('test message');
    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it('should log warn messages', () => {
    const logger = new Logger('test', LogLevel.WARN);
    logger.warn('test message');
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('should log error messages', () => {
    const logger = new Logger('test', LogLevel.ERROR);
    logger.error('test message');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should respect log level', () => {
    const logger = new Logger('test', LogLevel.ERROR);
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should allow changing log level', () => {
    const logger = new Logger('test', LogLevel.ERROR);
    logger.info('info message 1');
    expect(consoleInfoSpy).not.toHaveBeenCalled();

    logger.setLevel(LogLevel.INFO);
    logger.info('info message 2');
    expect(consoleInfoSpy).toHaveBeenCalled();
  });
});
