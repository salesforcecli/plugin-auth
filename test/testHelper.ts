/*
 * Copyright 2025, Salesforce, Inc.
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
  expect(auth.orgId?.length).to.equal(18);
}

export function expectUrlToExist(auth: AuthFields, urlKey: UrlKey): void {
  expect(auth[urlKey]).to.exist;
  expect(/^https*:\/\//.test(auth[urlKey] ?? '')).to.be.true;
}

export function expectAccessTokenToExist(auth: AuthFields): void {
  expect(auth.accessToken).to.exist;
  expect(auth.accessToken?.startsWith((auth.orgId ?? '').substr(0, 15))).to.be.true;
}

export function parseJson<T = unknown>(jsonString: string): Result<T> {
  return JSON.parse(jsonString) as Result<T>;
}

export function parseJsonError(jsonString: string): ErrorResult {
  return JSON.parse(jsonString) as ErrorResult;
}
