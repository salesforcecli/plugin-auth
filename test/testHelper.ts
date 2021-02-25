/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { AuthFields } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';

export type Result<T> = {
  status: number;
  result: T & AnyJson;
};

export type ErrorResult = {
  status: number;
  name: string;
  message: string;
};

export function scrubSecrets(auths: AuthFields | AuthFields[]): AuthFields | AuthFields[] {
  const authsToScrub = Array.isArray(auths) ? auths : [auths];
  authsToScrub.forEach((auth) => {
    delete auth.accessToken;
    delete auth.clientSecret;
    delete auth.clientId;
    delete auth.refreshToken;
  });
  return auths;
}

export function expectPropsToExist(auth: AuthFields, ...props: Array<keyof AuthFields>): void {
  props.forEach((prop) => {
    expect(auth[prop]).to.exist;
    expect(auth[prop]).to.be.a('string');
  });
}

export function parseJson<T = unknown>(jsonString: string): Result<T> {
  return JSON.parse(jsonString) as Result<T>;
}

export function parseJsonError(jsonString: string): ErrorResult {
  return JSON.parse(jsonString) as ErrorResult;
}
