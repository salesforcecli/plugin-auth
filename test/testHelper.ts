/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Authorization } from '@salesforce/core';

export type AuthorizationResult = {
  status: number;
  result: Authorization[];
};

export function scrubAccessTokens(auths: Authorization[]): Authorization[] {
  auths.forEach((auth) => {
    delete auth.accessToken;
  });
  return auths;
}

export function expectAccessTokenToExist(auth: Authorization): void {
  expect(auth.accessToken).to.exist;
  expect(auth.accessToken).to.be.a('string');
}
