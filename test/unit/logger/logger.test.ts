import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../src/logger/logger.js';

describe('Logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('respects level ordering — info level suppresses debug/verbose', () => {
    const logger = new Logger({ level: 'info', color: false });
    logger.debug('should not print');
    logger.verbose('should not print either');
    logger.info('should print');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toContain('should print');
  });

  it('silent suppresses everything, including errors', () => {
    const logger = new Logger({ level: 'silent', color: false });
    logger.error('nope');
    logger.warn('nope');
    logger.info('nope');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('setLevel changes what gets through at runtime', () => {
    const logger = new Logger({ level: 'error', color: false });
    logger.info('suppressed');
    expect(logSpy).not.toHaveBeenCalled();
    logger.setLevel('info');
    logger.info('now visible');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('child() prefixes messages and combines prefixes when nested', () => {
    const logger = new Logger({ level: 'info', color: false });
    const child = logger.child('task-a');
    child.info('hello');
    expect(logSpy.mock.calls[0]?.[0]).toContain('[task-a]');

    const grandchild = child.child('sub');
    grandchild.info('hi');
    expect(logSpy.mock.calls[1]?.[0]).toContain('[task-a > sub]');
  });

  it('error() includes the stack/message only at debug level or higher', () => {
    const quiet = new Logger({ level: 'error', color: false });
    quiet.error('boom', new Error('detail'));
    expect(errorSpy).toHaveBeenCalledTimes(1); // just the message line, no extra detail line

    errorSpy.mockClear();
    const verbose = new Logger({ level: 'debug', color: false });
    verbose.error('boom', new Error('detail'));
    expect(errorSpy).toHaveBeenCalledTimes(2); // message line + stack line
  });

  it('getLevel reflects the current level', () => {
    const logger = new Logger({ level: 'warn' });
    expect(logger.getLevel()).toBe('warn');
  });
});
