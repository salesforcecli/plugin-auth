/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export function read(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const stdin = process.openStdin();
    stdin.setEncoding('utf-8');

    let data = '';
    stdin.on('data', (chunk) => {
      data += chunk;
    });

    stdin.on('end', () => {
      resolve(data);
    });

    if (stdin.isTTY) {
      resolve('');
    }
  });
}
