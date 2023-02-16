# flags.client-id.summary

OAuth client ID (also called consumer key) of your custom connected app.

# flags.set-default-dev-hub.summary

Set the authenticated org as the default Dev Hub.

# flags.set-default.summary

Set the authenticated org as the default that all org-related commands run against.

# flags.alias.summary

Alias for the org.

# flags.instance-url.summary

URL of the instance that the org lives on.

# flags.instance-url.description

If you specify an --instance-url value, this value overrides the sfdcLoginUrl value in your sfdx-project.json file.

To specify a My Domain URL, use the format https://yourcompanyname.my.salesforce.com.

To specify a sandbox, set --instance-url to https://MyDomainName--SandboxName.sandbox.my.salesforce.com.

# authorizeCommandSuccess

Successfully authorized %s with org ID %s

# warnAuth

Logging in to a business or production org is not recommended on a demo or shared machine. Please run "%s org:logout --target-org <your username> --no-prompt" when finished using this org, which is similar to logging out of the org in the browser.

Do you want to authorize this org for use with the Salesforce CLI?

# flags.no-prompt.summary

Don't prompt for confirmation.

# flags.disable-masking.summary

Disable masking of user input; use with problematic terminals.

# clientSecretStdin

OAuth client secret of personal connected app?

# invalidInstanceUrl

Invalid instance URL. Specify a Salesforce instance URL using the format <domainname>.salesforce.com

# accessTokenStdin

Access token of user to use for authentication

# noPrompt

do not prompt for confirmation

# overwriteAccessTokenAuthUserFile

A file already exists for user "%s", which is associated with the access token you provided.
Are you sure you want to overwrite the existing file?
