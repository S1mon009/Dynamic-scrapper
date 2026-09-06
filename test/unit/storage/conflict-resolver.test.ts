import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConflictResolver } from '../../../src/storage/conflict-resolver.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scraper-conflict-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('ConflictResolver', () => {
  it('proceeds with the original path when nothing exists yet', async () => {
    const target = path.join(tmpDir, 'a.txt');
    const resolver = new ConflictResolver('rename');
    const decision = await resolver.resolve(target);
    expect(decision).toEqual({ action: 'proceed', finalPath: target, hadConflict: false });
  });

  it('overwrite strategy proceeds with the same path and flags the conflict', async () => {
    const target = path.join(tmpDir, 'a.txt');
    await fs.writeFile(target, 'existing');
    const resolver = new ConflictResolver('overwrite');
    const decision = await resolver.resolve(target);
    expect(decision).toEqual({ action: 'proceed', finalPath: target, hadConflict: true });
  });

  it('skip strategy returns a skip action', async () => {
    const target = path.join(tmpDir, 'a.txt');
    await fs.writeFile(target, 'existing');
    const resolver = new ConflictResolver('skip');
    const decision = await resolver.resolve(target);
    expect(decision).toEqual({ action: 'skip' });
  });

  it('fail strategy throws', async () => {
    const target = path.join(tmpDir, 'a.txt');
    await fs.writeFile(target, 'existing');
    const resolver = new ConflictResolver('fail');
    await expect(resolver.resolve(target)).rejects.toThrow(/already exists/);
  });

  it('rename strategy finds the next available "(n)" suffix', async () => {
    const target = path.join(tmpDir, 'a.txt');
    await fs.writeFile(target, 'existing');
    await fs.writeFile(path.join(tmpDir, 'a (1).txt'), 'existing too');
    const resolver = new ConflictResolver('rename');
    const decision = await resolver.resolve(target);
    expect(decision).toEqual({
      action: 'proceed',
      finalPath: path.join(tmpDir, 'a (2).txt'),
      hadConflict: true,
    });
  });
});
