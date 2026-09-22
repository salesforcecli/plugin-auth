/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from 'node:events';
import { type ChildProcess } from 'node:child_process';
import { expect } from 'chai';
import { waitForProcessExit } from '../../../../src/commands/org/login/web.js';

function mockChildProcess(exitCode: number | null): ChildProcess {
  const emitter = new EventEmitter();
  Object.defineProperty(emitter, 'exitCode', { value: exitCode, writable: true });
  return emitter as unknown as ChildProcess;
}

describe('waitForProcessExit', () => {
  it('resolves immediately when process already exited with code 0', async () => {
    const cp = mockChildProcess(0);
    const result = await waitForProcessExit(cp);
    expect(result).to.be.undefined;
  });

  it('resolves when process emits exit with code 0 (not yet exited)', async () => {
    const cp = mockChildProcess(null);
    const promise = waitForProcessExit(cp);
    cp.emit('exit', 0);
    const result = await promise;
    expect(result).to.be.undefined;
  });

  it('resolves when process emits exit with code null', async () => {
    const cp = mockChildProcess(null);
    const promise = waitForProcessExit(cp);
    cp.emit('exit', null);
    const result = await promise;
    expect(result).to.be.undefined;
  });

  it('does not register an exit listener when process already exited', async () => {
    const cp = mockChildProcess(0);
    await waitForProcessExit(cp);
    expect(cp.listenerCount('exit')).to.equal(0);
  });

  it('registers an exit listener when process has not yet exited', async () => {
    const cp = mockChildProcess(null);
    const promise = waitForProcessExit(cp);
    expect(cp.listenerCount('exit')).to.equal(1);
    cp.emit('exit', 0);
    await promise;
  });

  it('rejects immediately when process already exited with non-zero code', async () => {
    const cp = mockChildProcess(1);
    try {
      await waitForProcessExit(cp);
      expect.fail('should have rejected');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect((err as Error).message).to.include('code 1');
    }
  });

  it('rejects when process emits exit with non-zero code', async () => {
    const cp = mockChildProcess(null);
    const promise = waitForProcessExit(cp);
    cp.emit('exit', 2);
    try {
      await promise;
      expect.fail('should have rejected');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect((err as Error).message).to.include('code 2');
    }
  });
});
