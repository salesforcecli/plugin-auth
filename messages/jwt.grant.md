# summary

Log in to a Salesforce org using a JSON web token (JWT).

# description

Use this command in automated environments where you can’t interactively log in with a browser, such as in CI/CD scripts.

Logging into an org authorizes the CLI to run other commands that connect to that org, such as deploying or retrieving a project. You can log into many types of orgs, such as sandboxes, Dev Hubs, Env Hubs, production orgs, and scratch orgs.

Complete these steps before you run this command:

    1. Create a digital certificate (also called digital signature) and the private key to sign the certificate. You can use your own key and certificate issued by a certification authority. Or use OpenSSL to create a key and a self-signed digital certificate.
    2. Store the private key in a file on your computer. When you run this command, you set the --jwt-key-file flag to this file.
    3. Create a custom connected app in your org using the digital certificate. Make note of the consumer key (also called client id) that’s generated for you. Be sure the username of the user logging in is approved to use the connected app. When you run this command, you set the --client-id flag to the consumer key.

See https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_jwt_flow.htm for more information.

We recommend that you set an alias when you log into an org. Aliases make it easy to later reference this org when running commands that require it. If you don’t set an alias, you use the username that you specified when you logged in to the org. If you run multiple commands that reference the same org, consider setting the org as your default. Use --set-default for your default scratch org or sandbox, or --set-default-dev-hub for your default Dev Hub.

# examples

- Log into an org with username jdoe@example.org and on the default instance URL (https://login.salesforce.com). The private key is stored in the file /Users/jdoe/JWT/server.key and the command uses the connected app with consumer key (client id) 04580y4051234051.

  <%= config.bin %> <%= command.id %> --username jdoe@example.org --jwt-key-file /Users/jdoe/JWT/server.key --client-id 04580y4051234051

- Set the org as the default and give it an alias:

  <%= config.bin %> <%= command.id %> --username jdoe@example.org --jwt-key-file /Users/jdoe/JWT/server.key --client-id 04580y4051234051 --alias ci-org --set-default

- Set the org as the default Dev Hub and give it an alias:

  <%= config.bin %> <%= command.id %> --username jdoe@example.org --jwt-key-file /Users/jdoe/JWT/server.key --client-id 04580y4051234051 --alias ci-dev-hub --set-default-dev-hub

- Log in to a sandbox using URL https://MyDomainName--SandboxName.sandbox.my.salesforce.com:

  <%= config.bin %> <%= command.id %> --username jdoe@example.org --jwt-key-file /Users/jdoe/JWT/server.key --client-id 04580y4051234051 --alias ci-org --set-default --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com

# flags.username.summary

Username of the user logging in.

# flags.jwt-key-file.summary

Path to a file containing the private key.

# JwtGrantError

We encountered a JSON web token error, which is likely not an issue with Salesforce CLI. Here’s the error: %s
