# summary

authorize an org using an existing Salesforce access token

# description

authorize an org using an existing Salesforce access token
By default, the command runs interactively and asks you for the access token. If you previously authorized the org, the command prompts whether you want to overwrite the local file. Specify --no-prompt to not be prompted.
To use the command in a CI/CD script, set the SFDX_ACCESS_TOKEN environment variable to the access token. Then run the command with the --no-prompt parameter.

# examples

- $ <%= config.bin %> <%= command.id %> --instance-url https://mycompany.my.salesforce.com

- $ export SFDX_ACCESS_TOKEN=00Dxx0000000000!xxxxx

- $ <%= config.bin %> <%= command.id %> --instance-url https://dev-hub.my.salesforce.com --no-prompt

# invalidAccessTokenFormat

The access token isn't in the correct format.
It should follow this pattern: %s.
