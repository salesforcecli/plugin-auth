# plugin-auth

Auth commands for Salesforce CLI

## Install

`sfdx plugins:install @salesforce/plugin-auth`

## Usage

<!-- usage -->

```sh-session
$ npm install -g @salesforce/plugin-auth
$ sfdx COMMAND
running command...
$ sfdx (-v | --version)
@salesforce/plugin-auth/1.4.3 darwin-x64 node-v12.16.3
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`sfdx auth:device:login [-i <string>] [-r <url>] [-d] [-s] [-a <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-authdevicelogin--i-string--r-url--d--s--a-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx auth:jwt:grant -u <string> -f <filepath> -i <string> [-r <url>] [-d] [-s] [-a <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-authjwtgrant--u-string--f-filepath--i-string--r-url--d--s--a-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx auth:list [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-authlist---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx auth:logout [-a] [-p] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-authlogout--a--p--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx auth:sfdxurl:store -f <filepath> [-d] [-s] [-a <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-authsfdxurlstore--f-filepath--d--s--a-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx auth:web:login [-i <string>] [-r <url>] [-d] [-s] [-a <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-authweblogin--i-string--r-url--d--s--a-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx auth:device:login [-i <string>] [-r <url>] [-d] [-s] [-a <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

authorize an org using a device code

```
USAGE
  $ sfdx auth:device:login [-i <string>] [-r <url>] [-d] [-s] [-a <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --setalias=setalias                                                           set an alias for the authenticated
                                                                                    org

  -d, --setdefaultdevhubusername                                                    set the authenticated org as the
                                                                                    default dev hub org for scratch org
                                                                                    creation

  -i, --clientid=clientid                                                           OAuth client ID (sometimes called
                                                                                    the consumer key)

  -r, --instanceurl=instanceurl                                                     the login URL of the instance the
                                                                                    org lives on

  -s, --setdefaultusername                                                          set the authenticated org as the
                                                                                    default username that all commands
                                                                                    run against

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

ALIASES
  $ sfdx force:auth:device:login

EXAMPLES
  sfdx auth:device:login -d -a TestOrg1
  sfdx auth:device:login -i <OAuth client id>
  sfdx auth:device:login -r https://test.salesforce.com
```

_See code: [src/commands/auth/device/login.ts](https://github.com/salesforcecli/plugin-auth/blob/v1.4.0/src/commands/auth/device/login.ts)_

## `sfdx auth:jwt:grant -u <string> -f <filepath> -i <string> [-r <url>] [-d] [-s] [-a <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

authorize an org using the JWT flow

```
USAGE
  $ sfdx auth:jwt:grant -u <string> -f <filepath> -i <string> [-r <url>] [-d] [-s] [-a <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --setalias=setalias                                                           set an alias for the authenticated
                                                                                    org

  -d, --setdefaultdevhubusername                                                    set the authenticated org as the
                                                                                    default dev hub org for scratch org
                                                                                    creation

  -f, --jwtkeyfile=jwtkeyfile                                                       (required) path to a file containing
                                                                                    the private key

  -i, --clientid=clientid                                                           (required) OAuth client ID
                                                                                    (sometimes called the consumer key)

  -r, --instanceurl=instanceurl                                                     the login URL of the instance the
                                                                                    org lives on

  -s, --setdefaultusername                                                          set the authenticated org as the
                                                                                    default username that all commands
                                                                                    run against

  -u, --username=username                                                           (required) authentication username

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  Use a certificate associated with your private key that has been uploaded to a personal connected app.
  If you specify an --instanceurl value, this value overrides the sfdcLoginUrl value in your sfdx-project.json file. To
  specify a My Domain URL, use the format MyDomainName.my.salesforce.com (not MyDomainName.lightning.force.com).

ALIASES
  $ sfdx force:auth:jwt:grant

EXAMPLES
  sfdx auth:jwt:grant -u me@my.org -f <path to jwt key file> -i <OAuth client id>
  sfdx auth:jwt:grant -u me@my.org -f <path to jwt key file> -i <OAuth client id> -s -a MyDefaultOrg
  sfdx auth:jwt:grant -u me@acme.org -f <path to jwt key file> -i <OAuth client id> -r https://acme.my.salesforce.com
```

_See code: [src/commands/auth/jwt/grant.ts](https://github.com/salesforcecli/plugin-auth/blob/v1.4.0/src/commands/auth/jwt/grant.ts)_

## `sfdx auth:list [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

list auth connection information

```
USAGE
  $ sfdx auth:list [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

ALIASES
  $ sfdx force:auth:list
```

_See code: [src/commands/auth/list.ts](https://github.com/salesforcecli/plugin-auth/blob/v1.4.0/src/commands/auth/list.ts)_

## `sfdx auth:logout [-a] [-p] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

log out from authorized orgs

```
USAGE
  $ sfdx auth:logout [-a] [-p] [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --all                                                                         include all authenticated orgs
  -p, --noprompt                                                                    do not prompt for confirmation

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  By default, this command logs you out from your default scratch org.

ALIASES
  $ sfdx force:auth:logout

EXAMPLES
  sfdx auth:logout -u me@my.org
  sfdx auth:logout -a
  sfdx auth:logout -p
```

_See code: [src/commands/auth/logout.ts](https://github.com/salesforcecli/plugin-auth/blob/v1.4.0/src/commands/auth/logout.ts)_

## `sfdx auth:sfdxurl:store -f <filepath> [-d] [-s] [-a <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

authorize an org using an SFDX auth URL

```
USAGE
  $ sfdx auth:sfdxurl:store -f <filepath> [-d] [-s] [-a <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --setalias=setalias                                                           set an alias for the authenticated
                                                                                    org

  -d, --setdefaultdevhubusername                                                    set the authenticated org as the
                                                                                    default dev hub org for scratch org
                                                                                    creation

  -f, --sfdxurlfile=sfdxurlfile                                                     (required) path to a file containing
                                                                                    the sfdx url

  -s, --setdefaultusername                                                          set the authenticated org as the
                                                                                    default username that all commands
                                                                                    run against

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  Authorize a Salesforce org using an SFDX auth URL stored within a file. The file must have the format
  "force://<refreshToken>@<instanceUrl>" or "force://<clientId>:<clientSecret>:<refreshToken>@<instanceUrl>".
  The file must contain only the URL or be a JSON file that has a top-level property named sfdxAuthUrl.
  Use this command to get the SFDX auth URL for a Dev Hub org you have already authorized:

       $ sfdx force:org:display -u <DevHub> --verbose

ALIASES
  $ sfdx force:auth:sfdxurl:store

EXAMPLES
  sfdx auth:sfdxurl:store -f <path to sfdxAuthUrl file>
  sfdx auth:sfdxurl:store -f <path to sfdxAuthUrl file> -s -a MyDefaultOrg
```

_See code: [src/commands/auth/sfdxurl/store.ts](https://github.com/salesforcecli/plugin-auth/blob/v1.4.0/src/commands/auth/sfdxurl/store.ts)_

## `sfdx auth:web:login [-i <string>] [-r <url>] [-d] [-s] [-a <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

authorize an org using the web login flow

```
USAGE
  $ sfdx auth:web:login [-i <string>] [-r <url>] [-d] [-s] [-a <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --setalias=setalias                                                           set an alias for the authenticated
                                                                                    org

  -d, --setdefaultdevhubusername                                                    set the authenticated org as the
                                                                                    default dev hub org for scratch org
                                                                                    creation

  -i, --clientid=clientid                                                           OAuth client ID (sometimes called
                                                                                    the consumer key)

  -r, --instanceurl=instanceurl                                                     the login URL of the instance the
                                                                                    org lives on

  -s, --setdefaultusername                                                          set the authenticated org as the
                                                                                    default username that all commands
                                                                                    run against

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  To log in to a sandbox, set --instanceurl to https://test.salesforce.com.

ALIASES
  $ sfdx force:auth:web:login

EXAMPLES
  sfdx auth:web:login -a TestOrg1
  sfdx auth:web:login -i <OAuth client id>
  sfdx auth:web:login -r https://test.salesforce.com
```

_See code: [src/commands/auth/web/login.ts](https://github.com/salesforcecli/plugin-auth/blob/v1.4.0/src/commands/auth/web/login.ts)_

<!-- commandsstop -->
