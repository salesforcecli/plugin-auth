# summary

Authorize an org using an existing Salesforce access token.

# description

By default, the command runs interactively and asks you for the access token. If you previously authorized the org, the command prompts whether you want to overwrite the local file. Specify --no-prompt to not be prompted.

To use the command in a CI/CD script, set the SF_ACCESS_TOKEN environment variable to the access token. Then run the command with the --no-prompt parameter.

# examples

- Authorize an org on https://mycompany.my.salesforce.com; the command prompts you for the access token:

  <%= config.bin %> <%= command.id %> --instance-url https://mycompany.my.salesforce.com

- Authorize the org without being prompted; you must have previously set the SF_ACCESS_TOKEN environment variable to the access token:

  <%= config.bin %> <%= command.id %> --instance-url https://dev-hub.my.salesforce.com --no-prompt

# invalidAccessTokenFormat

The access token isn't in the correct format.
It should follow this pattern: %s.

# overwriteAccessTokenAuthUserFile

A file already exists for user "%s", which is associated with the access token you provided.
Are you sure you want to overwrite the existing file?
