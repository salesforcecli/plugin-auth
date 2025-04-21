/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import os from 'node:os';
import {
  AuthInfo,
  AuthRemover,
  ConfigAggregator,
  Global,
  Messages,
  Mode,
  OrgAuthorization,
  OrgConfigProperties,
} from '@salesforce/core';
import checkbox, { Separator } from '@inquirer/checkbox';
import { Flags, loglevel, SfCommand, StandardColors } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'logout');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');
type Choice = { name: string; value: OrgAuthorization };

export type AuthLogoutResults = string[];

export default class Logout extends SfCommand<AuthLogoutResults> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly deprecateAliases = true;
  public static readonly aliases = ['force:auth:logout', 'auth:logout'];

  public static readonly flags = {
    'target-org': Flags.string({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
      aliases: ['targetusername', 'u'],
      deprecateAliases: true,
    }),
    all: Flags.boolean({
      char: 'a',
      summary: messages.getMessage('flags.all.summary'),
      description: messages.getMessage('flags.all.description'),
      required: false,
      default: false,
      exclusive: ['target-org'],
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: commonMessages.getMessage('flags.no-prompt.summary'),
      required: false,
      deprecateAliases: true,
      aliases: ['noprompt'],
    }),
    loglevel,
  };

  public async run(): Promise<AuthLogoutResults> {
    const { flags } = await this.parse(Logout);
    const targetUsername =
      flags['target-org'] ??
      ((await ConfigAggregator.create()).getInfo(OrgConfigProperties.TARGET_ORG).value as string);

    // if no-prompt, there must be a resolved target-org or --all
    if (flags['no-prompt'] && !targetUsername && !flags.all) {
      throw messages.createError('noOrgSpecifiedWithNoPrompt');
    }

    if (this.jsonEnabled() && !targetUsername && !flags.all) {
      throw messages.createError('noOrgSpecifiedWithJson');
    }
    const shouldFindAllAuths =
      targetUsername && !flags.all
        ? false
        : flags.all || Global.getEnvironmentMode() === Mode.DEMO || !flags['no-prompt'];

    const orgAuths = shouldFindAllAuths
      ? await AuthInfo.listAllAuthorizations()
      : targetUsername
      ? (await AuthInfo.listAllAuthorizations()).filter(
          (orgAuth) => orgAuth.username === targetUsername || !!orgAuth.aliases?.includes(targetUsername)
        )
      : [];

    if (orgAuths.length === 0) {
      if (flags['target-org']) {
        this.warn(messages.createWarning('warning.NoAuthFoundForTargetOrg', [flags['target-org']]));
        // user specified a target org but it was not resolved, issue success message and return
        this.logSuccess(messages.getMessage('logoutOrgCommandSuccess', [flags['target-org']]));
        return [flags['target-org']];
      }
      this.info(messages.getMessage('noOrgsFound'));
      return [];
    }
    const skipPrompt = flags['no-prompt'] || this.jsonEnabled();

    const selectedOrgs = this.maybeWarnScratchOrgs(
      skipPrompt ? orgAuths : await promptForOrgsToRemove(orgAuths, flags.all)
    );

    if (skipPrompt || (await this.confirm({ message: getOrgConfirmationMessage(selectedOrgs, orgAuths.length) }))) {
      const remover = await AuthRemover.create();
      const loggedOutUsernames = selectedOrgs.map((org) => org.username);
      await Promise.all(loggedOutUsernames.map((username) => remover.removeAuth(username)));
      this.logSuccess(messages.getMessage('logoutOrgCommandSuccess', [loggedOutUsernames.join(os.EOL)]));
      return loggedOutUsernames;
    } else {
      this.info(messages.getMessage('noOrgsSelected'));
      return [];
    }
  }

  /** Warning about logging out of a scratch org and losing access to it  */
  private maybeWarnScratchOrgs(orgs: OrgAuthorization[]): OrgAuthorization[] {
    if (orgs.some((org) => org.isScratchOrg)) {
      this.warn(messages.getMessage('warning'));
    }
    return orgs;
  }
}

const promptForOrgsToRemove = async (orgAuths: OrgAuthorization[], all: boolean): Promise<OrgAuthorization[]> =>
  orgAuths.length === 1
    ? orgAuths
    : checkbox({
        message: messages.getMessage('prompt.select-envs'),
        // pick the orgs to delete - if flags.all - set each org to selected
        // otherwise prompt the user to select the orgs to delete
        choices: buildChoices(orgAuths, all),
        loop: true,
      });

const getOrgConfirmationMessage = (selectedOrgs: OrgAuthorization[], originalOrgCount: number): string => {
  if (selectedOrgs.length === 1) {
    return messages.getMessage('prompt.confirm.single', [selectedOrgs[0].username]);
  }
  return selectedOrgs.length === originalOrgCount
    ? messages.getMessage('prompt.confirm-all')
    : messages.getMessage('prompt.confirm', [selectedOrgs.length, selectedOrgs.length > 1 ? 's' : '']);
};

/** A whole bunch of custom formatting to make the list look nicer */
const buildChoices = (orgAuths: OrgAuthorization[], all: boolean): Array<Choice | Separator> => {
  const maxUsernameLength = Math.max('Username'.length, ...orgAuths.map((orgAuth) => orgAuth.username.length));
  const maxAliasLength = Math.max(
    'Aliases'.length,
    ...orgAuths.map((orgAuth) => (orgAuth.aliases ? orgAuth.aliases.join(',') : '').length)
  );
  const maxConfigLength = Math.max(
    'Configs'.length,
    ...orgAuths.map((orgAuth) => (orgAuth.configs ? orgAuth.configs.join(',') : '').length)
  );
  const maxTypeLength = Math.max(
    'Type'.length,
    ...orgAuths.map((orgAuth) => {
      if (orgAuth.isScratchOrg) {
        return 'Scratch'.length;
      }
      if (orgAuth.isDevHub) {
        return 'DevHub'.length;
      }
      if (orgAuth.isSandbox) {
        return 'Sandbox'.length;
      }
      return 0;
    })
  );
  const choices = orgAuths
    .map((orgAuth) => {
      const aliasString = (orgAuth.aliases ? orgAuth.aliases.join(',') : '').padEnd(maxAliasLength, ' ');
      const configString = (orgAuth.configs ? orgAuth.configs.join(',') : '').padEnd(maxConfigLength, ' ');
      const typeString = StandardColors.info(
        (orgAuth.isScratchOrg ? 'Scratch' : orgAuth.isDevHub ? 'DevHub' : orgAuth.isSandbox ? 'Sandbox' : '').padEnd(
          maxTypeLength,
          ' '
        )
      );
      // username - aliases - configs
      const key = `${orgAuth.username.padEnd(
        maxUsernameLength
      )} | ${typeString} | ${aliasString} | ${StandardColors.warning(configString)}`;
      return { name: key, value: orgAuth, checked: all, short: `${os.EOL}${orgAuth.username}` };
    })
    .sort((a, b) => a.value.username.localeCompare(b.value.username));
  const userHeader = `${'Username'.padEnd(maxUsernameLength, ' ')}`;
  const aliasHeader = `${'Aliases'.padEnd(maxAliasLength, ' ')}`;
  const configHeader = `${'Configs'.padEnd(maxConfigLength, ' ')}`;
  const typeHeader = `${'Type'.padEnd(maxTypeLength, ' ')}`;
  return [new Separator(`  ${userHeader} | ${typeHeader} | ${aliasHeader} | ${configHeader}`), ...choices];
};
