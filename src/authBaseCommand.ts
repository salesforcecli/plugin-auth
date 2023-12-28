/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { Messages, Global, Mode } from '@salesforce/core';
import chalk from 'chalk';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Config } from '@oclif/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

function dimMessage(message: string): string {
  return chalk.dim(message);
}

export abstract class AuthBaseCommand<T> extends SfCommand<T> {
  public constructor(argv: string[], config: Config) {
    super(argv, config);
  }

  protected async askForHiddenResponse(messageKey: string, disableMasking = false): Promise<string> {
    const msg = dimMessage(messages.getMessage(messageKey));
    const hidden: { response: string } = await this.prompt({
      message: msg,
      type: 'input',
      name: 'response',
      transformer: (input: string) => (disableMasking ? input : '*'.repeat(input.length)),
    });
    return hidden.response;
  }

  protected async shouldExitCommand(noPrompt?: boolean, message?: string): Promise<boolean> {
    if (Boolean(noPrompt) || Global.getEnvironmentMode() !== Mode.DEMO) {
      return false;
    } else {
      const msg = dimMessage(message ?? messages.getMessage('warnAuth', [this.config.bin]));
      const answer = await this.confirm(msg);
      return !answer;
    }
  }

  protected async askForClientSecret(disableMasking = false): Promise<string> {
    return this.askForHiddenResponse('clientSecretStdin', disableMasking);
  }

  protected async askForAccessToken(disableMasking = false): Promise<string> {
    return this.askForHiddenResponse('accessTokenStdin', disableMasking);
  }
}
