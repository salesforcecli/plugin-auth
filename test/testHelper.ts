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

type UrlKey = Extract<keyof AuthFields, 'instanceUrl' | 'loginUrl'>;

export function expectPropsToExist(auth: AuthFields, ...props: Array<keyof AuthFields>): void {
  props.forEach((prop) => {
    expect(auth[prop]).to.exist;
    expect(auth[prop]).to.be.a('string');
  });
}

export function expectOrgIdToExist(auth: AuthFields): void {
  expect(auth.orgId).to.exist;
  expect(auth.orgId.length).to.equal(18);
}

export function expectUrlToExist(auth: AuthFields, urlKey: UrlKey): void {
  expect(auth[urlKey]).to.exist;
  expect(auth[urlKey].startsWith('https://')).to.be.true;
}

export function expectAccessTokenToExist(auth: AuthFields): void {
  expect(auth.accessToken).to.exist;
  expect(auth.accessToken.startsWith(auth.orgId.substr(0, 15))).to.be.true;
}

export function parseJson<T = unknown>(jsonString: string): Result<T> {
  return JSON.parse(jsonString) as Result<T>;
}

export function parseJsonError(jsonString: string): ErrorResult {
  return JSON.parse(jsonString) as ErrorResult;
}
