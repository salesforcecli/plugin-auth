# summary

authorize an org using the web login flow

# description

authorize an org using the web login flow
If you specify an --instance-url value, this value overrides the sfdcLoginUrl value in your sfdx-project.json file. To specify a My Domain URL, use the format MyDomainName.my.salesforce.com (not MyDomainName.lightning.force.com). To log in to a sandbox, set --instanceurl to https://MyDomainName--SandboxName.sandbox.my.salesforce.com.
To open in a specific browser, use the --browser parameter. Supported browsers are "chrome", "edge", and "firefox". If you don't specify --browser, the org opens in your default browser.

# examples

- $ <%= config.bin %> <%= command.id %> -a TestOrg1

- $ <%= config.bin %> <%= command.id %> -i <OAuth client id>

- $ <%= config.bin %> <%= command.id %> -r https://MyDomainName--SandboxName.sandbox.my.salesforce.com

- $ <%= config.bin %> <%= command.id %> -a TestOrg1 -b firefox

# browser

browser where the org opens

# deviceWarning

org:login:web doesn't work when authorizing to a headless environment. Use org:login:device instead.

# invalidClientId

Invalid client credentials. Verify the OAuth client secret and ID. %s
