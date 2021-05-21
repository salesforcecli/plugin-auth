/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename } from 'path';
import { QueryResult } from 'jsforce';
import {
  AuthInfo,
  AuthFields,
  Logger,
  SfdcUrl,
  SfdxProject,
  ConfigAggregator,
  Messages,
  Org,
  SfdxError,
  sfdc,
} from '@salesforce/core';
import { getString, isObject, Optional } from '@salesforce/ts-types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

interface Flags {
  setalias?: string;
  setdefaultdevhubusername?: boolean;
  setdefaultusername?: boolean;
}

const ensureNotLightning = (url: string): string => {
  if (url.includes('lightning.force.com')) {
    throw new SfdxError(messages.getMessage('invalidInstanceUrl'), 'URL_WARNING');
  }
  return url;
};
export class Common {
  public static async handleSideEffects(authInfo: AuthInfo, flags: Flags): Promise<void> {
    if (flags.setalias) await authInfo.setAlias(flags.setalias);

    if (flags.setdefaultdevhubusername || flags.setdefaultusername) {
      await authInfo.setAsDefault({
        defaultUsername: flags.setdefaultusername,
        defaultDevhubUsername: flags.setdefaultdevhubusername,
      });
    }
  }
  public static async resolveLoginUrl(instanceUrl: Optional<string>): Promise<Optional<string>> {
    const logger = await Logger.child('Common', { tag: 'resolveLoginUrl' });

    // url preference: supplied from command > file > config >
    if (instanceUrl) {
      return ensureNotLightning(instanceUrl);
    }

    // sfdx-project.json file
    let loginUrlFromProjectJson: string;
    try {
      const project = await SfdxProject.resolve();
      const projectJson = await project.resolveProjectConfig();
      loginUrlFromProjectJson = getString(projectJson, 'sfdcLoginUrl');
      logger.debug(`loginUrl: ${loginUrlFromProjectJson}`);
    } catch (err) {
      const message: string = (isObject(err) ? Reflect.get(err, 'message') ?? err : err) as string;
      logger.debug(`error occurred while trying to determine loginUrl from sfdx-project.json: ${message}`);
    }
    if (loginUrlFromProjectJson) {
      return ensureNotLightning(loginUrlFromProjectJson);
    }
    // local or global config
    const urlFromConfig = (await ConfigAggregator.create()).getPropertyValue('instanceUrl') as string;
    return urlFromConfig ? ensureNotLightning(urlFromConfig) : SfdcUrl.PRODUCTION;
  }

  // fields property is passed in because the consumers of this method have performed the decrypt.
  // This is so we don't have to call authInfo.getFields(true) and decrypt again OR accidentally save an
  public static async identifyPossibleScratchOrgs(fields: AuthFields, orgAuthInfo: AuthInfo): Promise<void> {
    const logger = await Logger.child('Common', { tag: 'identifyPossibleScratchOrgs' });

    // return if we already know the hub or we know it is a devhub or prod-like
    if (fields.isDevHub || fields.devHubUsername) return;
    // there are no hubs to ask, so quit early
    if (!(await AuthInfo.hasAuthentications())) return;
    logger.debug('getting devHubs from authfiles');

    // TODO: return if url is not sandbox-like to avoid constantly asking about production orgs
    // TODO: someday we make this easier by asking the org if it is a scratch org

    const hubAuthInfos = await this.getDevHubAuthInfos();
    logger.debug(`found ${hubAuthInfos.length} DevHubs`);
    if (hubAuthInfos.length === 0) return;

    // ask all those orgs if they know this orgId
    await Promise.all(
      hubAuthInfos.map(async (hubAuthInfo) => {
        try {
          const devHubOrg = await Org.create({ aliasOrUsername: hubAuthInfo.getUsername() });
          const conn = devHubOrg.getConnection();
          const data = await conn.query<QueryResult<{ Id: string }>>(
            `select Id from ScratchOrgInfo where ScratchOrg = '${sfdc.trimTo15(fields.orgId)}'`
          );
          if (data.totalSize > 0) {
            // if any return a result
            logger.debug(`found orgId ${fields.orgId} in devhub ${hubAuthInfo.getUsername()}`);
            try {
              await orgAuthInfo.save({ ...fields, devHubUsername: hubAuthInfo.getUsername() });
              logger.debug(`set ${hubAuthInfo.getUsername()} as devhub for scratch org ${orgAuthInfo.getUsername()}`);
            } catch (error) {
              logger.debug(`error updating auth file for ${orgAuthInfo.getUsername()}`, error);
            }
          }
        } catch (error) {
          logger.error(`Error connecting to devhub ${hubAuthInfo.getUsername()}`, error);
        }
      })
    );
  }

  public static async getDevHubAuthInfos(): Promise<AuthInfo[]> {
    return (
      await Promise.all(
        (await AuthInfo.listAllAuthFiles())
          .map((fileName) => basename(fileName, '.json'))
          .map((username) => AuthInfo.create({ username }))
      )
    ).filter((possibleHub) => possibleHub?.getFields()?.isDevHub);
  }
}
