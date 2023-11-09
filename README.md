# plugin-auth

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-auth.svg?label=@salesforce/plugin-auth)](https://www.npmjs.com/package/@salesforce/plugin-auth) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-auth.svg)](https://npmjs.org/package/@salesforce/plugin-auth) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-auth/main/LICENSE.txt)

Auth commands for Salesforce CLI

This plugin is bundled with the [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli). For more information on the CLI, read the [getting started guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm).

We always recommend using the latest version of these commands bundled with the CLI, however, you can install a specific version or tag if needed.

## Install

```bash
sfdx plugins:install auth@x.y.z
```

## Issues

Please report any issues at https://github.com/forcedotcom/cli/issues

## Contributing

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md)
2. Create a new issue before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
3. Fork this repository.
4. [Build the plugin locally](#build)
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request will be accepted without unit tests.
8. Sign CLA (see [CLA](#cla) below).
9. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### CLA

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to https://cla.salesforce.com/sign-cla.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:salesforcecli/plugin-auth

# Install the dependencies and compile
yarn install
yarn build
```

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev auth
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sfdx cli
sfdx plugins:link .
# To verify
sfdx plugins
```

# Commands

<!-- commands -->

- [`sf org list auth`](#sf-org-list-auth)
- [`sf org login access-token`](#sf-org-login-access-token)
- [`sf org login device`](#sf-org-login-device)
- [`sf org login jwt`](#sf-org-login-jwt)
- [`sf org login sfdx-url`](#sf-org-login-sfdx-url)
- [`sf org login web`](#sf-org-login-web)
- [`sf org logout`](#sf-org-logout)

## `sf org list auth`

List authorization information about the orgs you created or logged into.

```
USAGE
  $ sf org list auth [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List authorization information about the orgs you created or logged into.

  This command uses local authorization information that Salesforce CLI caches when you create a scratch org or log into
  an org. The command doesn't actually connect to the orgs to verify that they're still active. As a result, this
  command executes very quickly. If you want to view live information about your authorized orgs, such as their
  connection status, use the "org list" command.

ALIASES
  $ sf force auth list
  $ sf auth list

EXAMPLES
  List local authorization information about your orgs:

    $ sf org list auth
```

_See code: [src/commands/org/list/auth.ts](https://github.com/salesforcecli/plugin-auth/blob/2.8.27/src/commands/org/list/auth.ts)_

## `sf org login access-token`

Authorize an org using an existing Salesforce access token.

```
USAGE
  $ sf org login access-token -r <value> [--json] [-d] [-s] [-a <value>] [-p]

FLAGS
  -a, --alias=<value>         Alias for the org.
  -d, --set-default-dev-hub   Set the authenticated org as the default Dev Hub.
  -p, --no-prompt             Don't prompt for confirmation.
  -r, --instance-url=<value>  (required) URL of the instance that the org lives on.
  -s, --set-default           Set the authenticated org as the default that all org-related commands run against.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Authorize an org using an existing Salesforce access token.

  By default, the command runs interactively and asks you for the access token. If you previously authorized the org,
  the command prompts whether you want to overwrite the local file. Specify --no-prompt to not be prompted.

  To use the command in a CI/CD script, set the SFDX_ACCESS_TOKEN environment variable to the access token. Then run the
  command with the --no-prompt parameter.

ALIASES
  $ sf force auth accesstoken store
  $ sf auth accesstoken store

EXAMPLES
  Authorize an org on https://mycompany.my.salesforce.com; the command prompts you for the access token:

    $ sf org login access-token --instance-url https://mycompany.my.salesforce.com

  Authorize the org without being prompted; you must have previously set the SFDX_ACCESS_TOKEN environment variable to
  the access token:

    $ sf org login access-token --instance-url https://dev-hub.my.salesforce.com --no-prompt

FLAG DESCRIPTIONS
  -r, --instance-url=<value>  URL of the instance that the org lives on.

    If you specify an --instance-url value, this value overrides the sfdcLoginUrl value in your sfdx-project.json file.

    To specify a My Domain URL, use the format https://yourcompanyname.my.salesforce.com.

    To specify a sandbox, set --instance-url to https://MyDomainName--SandboxName.sandbox.my.salesforce.com.
```

_See code: [src/commands/org/login/access-token.ts](https://github.com/salesforcecli/plugin-auth/blob/2.8.27/src/commands/org/login/access-token.ts)_

## `sf org login device`

Authorize an org using a device code.

```
USAGE
  $ sf org login device [--json] [-i <value>] [-r <value>] [-d] [-s] [-a <value>]

FLAGS
  -a, --alias=<value>         Alias for the org.
  -d, --set-default-dev-hub   Set the authenticated org as the default Dev Hub.
  -i, --client-id=<value>     OAuth client ID (also called consumer key) of your custom connected app.
  -r, --instance-url=<value>  URL of the instance that the org lives on.
  -s, --set-default           Set the authenticated org as the default that all org-related commands run against.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Authorize an org using a device code.

  Use this command to allow a device to connect to an org.

  When you run this command, it first displays an 8-digit device code and the URL for verifying the code on your org.
  The default instance URL is https://login.salesforce.com, so if the org you're authorizing is on a different instance,
  use the --instance-url. The command waits while you complete the verification. Open a browser and navigate to the
  displayed verification URL, enter the code, then click Connect. If you aren't already logged into your org, log in,
  and then you're prompted to allow the device to connect to the org. After you successfully authorize the org, you can
  close the browser window.

ALIASES
  $ sf force auth device login
  $ sf auth device login

EXAMPLES
  Authorize an org using a device code, give the org the alias TestOrg1, and set it as your default Dev Hub org:

    $ sf org login device --set-default-dev-hub --alias TestOrg1

  Authorize an org in which you've created a custom connected app with the specified client ID (consumer key):

    $ sf org login device --client-id <OAuth client id>

  Authorize a sandbox org with the specified instance URL:

    $ sf org login device --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com

FLAG DESCRIPTIONS
  -r, --instance-url=<value>  URL of the instance that the org lives on.

    If you specify an --instance-url value, this value overrides the sfdcLoginUrl value in your sfdx-project.json file.

    To specify a My Domain URL, use the format https://yourcompanyname.my.salesforce.com.

    To specify a sandbox, set --instance-url to https://MyDomainName--SandboxName.sandbox.my.salesforce.com.
```

_See code: [src/commands/org/login/device.ts](https://github.com/salesforcecli/plugin-auth/blob/2.8.27/src/commands/org/login/device.ts)_

## `sf org login jwt`

Log in to a Salesforce org using a JSON web token (JWT).

```
USAGE
  $ sf org login jwt -o <value> -f <value> -i <value> [--json] [-r <value>] [-d] [-s] [-a <value>]

FLAGS
  -a, --alias=<value>         Alias for the org.
  -d, --set-default-dev-hub   Set the authenticated org as the default Dev Hub.
  -f, --jwt-key-file=<value>  (required) Path to a file containing the private key.
  -i, --client-id=<value>     (required) OAuth client ID (also called consumer key) of your custom connected app.
  -o, --username=<value>      (required) Username of the user logging in.
  -r, --instance-url=<value>  URL of the instance that the org lives on.
  -s, --set-default           Set the authenticated org as the default that all org-related commands run against.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Log in to a Salesforce org using a JSON web token (JWT).

  Use this command in automated environments where you can’t interactively log in with a browser, such as in CI/CD
  scripts.

  Logging into an org authorizes the CLI to run other commands that connect to that org, such as deploying or retrieving
  a project. You can log into many types of orgs, such as sandboxes, Dev Hubs, Env Hubs, production orgs, and scratch
  orgs.

  Complete these steps before you run this command:

  1. Create a digital certificate (also called digital signature) and the private key to sign the certificate. You can
  use your own key and certificate issued by a certification authority. Or use OpenSSL to create a key and a self-signed
  digital certificate.
  2. Store the private key in a file on your computer. When you run this command, you set the --jwt-key-file flag to
  this file.
  3. Create a custom connected app in your org using the digital certificate. Make note of the consumer key (also called
  client id) that’s generated for you. Be sure the username of the user logging in is approved to use the connected app.
  When you run this command, you set the --client-id flag to the consumer key.

  See https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_jwt_flow.htm for more
  information.

  We recommend that you set an alias when you log into an org. Aliases make it easy to later reference this org when
  running commands that require it. If you don’t set an alias, you use the username that you specified when you logged
  in to the org. If you run multiple commands that reference the same org, consider setting the org as your default. Use
  --set-default for your default scratch org or sandbox, or --set-default-dev-hub for your default Dev Hub.

ALIASES
  $ sf force auth jwt grant
  $ sf auth jwt grant

EXAMPLES
  Log into an org with username jdoe@example.org and on the default instance URL (https://login.salesforce.org). The
  private key is stored in the file /Users/jdoe/JWT/server.key and the command uses the connected app with consumer
  key (client id) 04580y4051234051.

    $ sf org login jwt --username jdoe@example.org --jwt-key-file /Users/jdoe/JWT/server.key --client-id \
      04580y4051234051

  Set the org as the default and give it an alias:

    $ sf org login jwt --username jdoe@example.org --jwt-key-file /Users/jdoe/JWT/server.key --client-id \
      04580y4051234051 --alias ci-org --set-default

  Set the org as the default Dev Hub and give it an alias:

    $ sf org login jwt --username jdoe@example.org --jwt-key-file /Users/jdoe/JWT/server.key --client-id \
      04580y4051234051 --alias ci-dev-hub --set-default-dev-hub

  Log in to a sandbox using URL https://MyDomainName--SandboxName.sandbox.my.salesforce.com:

    $ sf org login jwt --username jdoe@example.org --jwt-key-file /Users/jdoe/JWT/server.key --client-id \
      04580y4051234051 --alias ci-org --set-default --instance-url \
      https://MyDomainName--SandboxName.sandbox.my.salesforce.com

FLAG DESCRIPTIONS
  -r, --instance-url=<value>  URL of the instance that the org lives on.

    If you specify an --instance-url value, this value overrides the sfdcLoginUrl value in your sfdx-project.json file.

    To specify a My Domain URL, use the format https://yourcompanyname.my.salesforce.com.

    To specify a sandbox, set --instance-url to https://MyDomainName--SandboxName.sandbox.my.salesforce.com.
```

_See code: [src/commands/org/login/jwt.ts](https://github.com/salesforcecli/plugin-auth/blob/2.8.27/src/commands/org/login/jwt.ts)_

## `sf org login sfdx-url`

Authorize an org using a Salesforce DX authorization URL stored in a file.

```
USAGE
  $ sf org login sfdx-url -f <value> [--json] [-d] [-s] [-a <value>]

FLAGS
  -a, --alias=<value>          Alias for the org.
  -d, --set-default-dev-hub    Set the authenticated org as the default Dev Hub.
  -f, --sfdx-url-file=<value>  (required) Path to a file that contains the Salesforce DX authorization URL.
  -s, --set-default            Set the authenticated org as the default that all org-related commands run against.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Authorize an org using a Salesforce DX authorization URL stored in a file.

  The Salesforce DX (SFDX) authorization URL must have the format
  "force://<clientId>:<clientSecret>:<refreshToken>@<instanceUrl>". NOTE: The SFDX authorization URL uses the "force"
  protocol, and not "http" or "https". Also, the "instanceUrl" inside the SFDX authorization URL doesn't include the
  protocol ("https://").

  You have three options when creating the authorization file. The easiest option is to redirect the output of the "sf
  org display --verbose --json" command into a file. For example, using an org with alias my-org that you've already
  authorized:

  $ sf org display --target-org my-org --verbose --json > authFile.json

  The resulting JSON file contains the URL in the "sfdxAuthUrl" property of the "result" object. You can then reference
  the file when running this command:

  $ sf org login sfdx-url --sfdx-url-file authFile.json

  NOTE: The "sf org display --verbose" command displays the refresh token only for orgs authorized with the web server
  flow, and not the JWT bearer flow.

  You can also create a JSON file that has a top-level property named sfdxAuthUrl whose value is the authorization URL.
  Finally, you can create a normal text file that includes just the URL and nothing else.

ALIASES
  $ sf force auth sfdxurl store
  $ sf auth sfdxurl store

EXAMPLES
  Authorize an org using the SFDX authorization URL in the files/authFile.json file:

    $ sf org login sfdx-url --sfdx-url-file files/authFile.json

  Similar to previous example, but set the org as your default and give it an alias MyDefaultOrg:

    $ sf org login sfdx-url --sfdx-url-file files/authFile.json --set-default --alias MyDefaultOrg
```

_See code: [src/commands/org/login/sfdx-url.ts](https://github.com/salesforcecli/plugin-auth/blob/2.8.27/src/commands/org/login/sfdx-url.ts)_

## `sf org login web`

Log in to a Salesforce org using the web server flow.

```
USAGE
  $ sf org login web [--json] [-b chrome|edge|firefox] [-i <value>] [-r <value>] [-d] [-s] [-a <value>]

FLAGS
  -a, --alias=<value>         Alias for the org.
  -b, --browser=<option>      Browser in which to open the org.
                              <options: chrome|edge|firefox>
  -d, --set-default-dev-hub   Set the authenticated org as the default Dev Hub.
  -i, --client-id=<value>     OAuth client ID (also called consumer key) of your custom connected app.
  -r, --instance-url=<value>  URL of the instance that the org lives on.
  -s, --set-default           Set the authenticated org as the default that all org-related commands run against.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Log in to a Salesforce org using the web server flow.

  Opens a Salesforce instance URL in a web browser so you can enter your credentials and log in to your org. After you
  log in, you can close the browser window.

  Logging into an org authorizes the CLI to run other commands that connect to that org, such as deploying or retrieving
  metadata. You can log into many types of orgs, such as sandboxes, Dev Hubs, Env Hubs, production orgs, and scratch
  orgs.

  We recommend that you set an alias when you log into an org. Aliases make it easy to later reference this org when
  running commands that require it. If you don’t set an alias, you use the username that you specified when you logged
  in to the org. If you run multiple commands that reference the same org, consider setting the org as your default. Use
  --set-default for your default scratch org or sandbox, or --set-default-dev-hub for your default Dev Hub.

  By default, this command uses the global out-of-the-box connected app in your org. If you need more security or
  control, such as setting the refresh token timeout or specifying IP ranges, create your own connected app using a
  digital certificate. Make note of the consumer key (also called cliend id) that’s generated for you. Then specify the
  consumer key with the --client-id flag.

ALIASES
  $ sf force auth web login
  $ sf auth web login

EXAMPLES
  Run the command with no flags to open the default Salesforce login page (https://login.salesforce.com):

    $ sf org login web

  Log in to your Dev Hub, set it as your default Dev Hub, and set an alias that you reference later when you create a
  scratch org:

    $ sf org login web --set-default-dev-hub --alias dev-hub

  Log in to a sandbox and set it as your default org:

    $ sf org login web --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com --set-default

  Use --browser to specify a specific browser, such as Google Chrome:

    $ sf org login web --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com --set-default \
      --browser chrome

  Use your own connected app by specifying its consumer key (also called client ID):

    $ sf org login web --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com --set-default \
      --browser chrome --client-id 04580y4051234051

FLAG DESCRIPTIONS
  -b, --browser=chrome|edge|firefox  Browser in which to open the org.

    If you don’t specify --browser, the command uses your default browser. The exact names of the browser applications
    differ depending on the operating system you're on; check your documentation for details.

  -r, --instance-url=<value>  URL of the instance that the org lives on.

    If you specify an --instance-url value, this value overrides the sfdcLoginUrl value in your sfdx-project.json file.

    To specify a My Domain URL, use the format https://yourcompanyname.my.salesforce.com.

    To specify a sandbox, set --instance-url to https://MyDomainName--SandboxName.sandbox.my.salesforce.com.
```

_See code: [src/commands/org/login/web.ts](https://github.com/salesforcecli/plugin-auth/blob/2.8.27/src/commands/org/login/web.ts)_

## `sf org logout`

Log out of a Salesforce org.

```
USAGE
  $ sf org logout [--json] [-a | -o <value>] [-p]

FLAGS
  -a, --all                 Include all authenticated orgs.
  -o, --target-org=<value>  Username or alias of the target org.
  -p, --no-prompt           Don't prompt for confirmation.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Log out of a Salesforce org.

  If you run this command with no flags and no default org set in your config or environment, it first displays a list
  of orgs you've created or logged into, with none of the orgs selected. Use the arrow keys to scroll through the list
  and the space bar to select the orgs you want to log out of. Press Enter when you're done; the command asks for a
  final confirmation before logging out of the selected orgs.

  The process is similar if you specify --all, except that in the initial list of orgs, they're all selected. Use
  --target-org to logout of a specific org. In both these cases by default, you must still confirm that you want to log
  out. Use --no-prompt to never be asked for confirmation when also using --all or --target-org.

  Be careful! If you log out of a scratch org without having access to its password, you can't access the scratch org
  again, either through the CLI or the Salesforce UI.

ALIASES
  $ sf force auth logout
  $ sf auth logout

EXAMPLES
  Interactively select the orgs to log out of:

    $ sf org logout

  Log out of the org with username me@my.org:

    $ sf org logout --target-org me@my.org

  Log out of all orgs after confirmation:

    $ sf org logout --all

  Logout of the org with alias my-scratch and don't prompt for confirmation:

    $ sf org logout --target-org my-scratch --no-prompt

FLAG DESCRIPTIONS
  -a, --all  Include all authenticated orgs.

    All orgs includes Dev Hubs, sandboxes, DE orgs, and expired, deleted, and unknown-status scratch orgs.
```

_See code: [src/commands/org/logout.ts](https://github.com/salesforcecli/plugin-auth/blob/2.8.27/src/commands/org/logout.ts)_

<!-- commandsstop -->
