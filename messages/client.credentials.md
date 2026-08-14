# summary

Log in to a Salesforce org using the OAuth 2.0 client credentials flow.

# description

Use this command in automated environments where you can’t interactively log in with a browser, such as in CI/CD scripts.

Logging into an org authorizes the CLI to run other commands that connect to that org, such as deploying or retrieving a project. You can log into many types of orgs, such as sandboxes, Dev Hubs, Env Hubs, production orgs, and scratch orgs.

Complete these steps before you run this command:

    1. Create a connected app or external client app in your org. Enable the client credentials flow and choose the user that the integration runs as.
    2. Make note of the consumer key (also called client id) and consumer secret (also called client secret) that are generated for you. Set the consumer secret in the SF_CLIENT_SECRET environment variable. When you run this command, set the --client-id flag to the consumer key so the secret isn't passed as a command argument.
    3. Use your org’s My Domain URL with --instance-url. The client credentials flow doesn’t support login.salesforce.com or test.salesforce.com.

See https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_client_credentials_flow.htm for more information.

We recommend that you set an alias when you log into an org. Aliases make it easy to later reference this org when running commands that require it. If you don’t set an alias, you use the username that you specified when you logged in to the org. If you run multiple commands that reference the same org, consider setting the org as your default. Use --set-default for your default scratch org or sandbox, or --set-default-dev-hub for your default Dev Hub.

# examples

- Set the org as the default and give it an alias:

  SF_CLIENT_SECRET=very-secret <%= config.bin %> <%= command.id %> --client-id 04580y4051234051 --instance-url https://MyDomainName.my.salesforce.com --alias ci-org --set-default

- Set the org as the default Dev Hub and give it an alias:

  SF_CLIENT_SECRET=very-secret <%= config.bin %> <%= command.id %> --client-id 04580y4051234051 --instance-url https://MyDomainName.my.salesforce.com --alias ci-dev-hub --set-default-dev-hub

# ClientCredentialsGrantError

We encountered a client credentials error, which is likely not an issue with Salesforce CLI. Here’s the error: %s

# httpsRequired

The client credentials flow requires an HTTPS instance URL. Use your org’s My Domain URL, such as https://MyDomainName.my.salesforce.com.

# clientSecretMissingResponse

The client secret environment variable was not set, aborting login call.

# invalidTokenResponse

The authorization server returned an incomplete token response.
