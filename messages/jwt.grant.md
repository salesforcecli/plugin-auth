# summary

authorize an org using the JWT flow

# description

authorize an org using the JWT flow
Use a certificate associated with your private key that has been uploaded to a personal connected app.
If you specify an --instanc-eurl value, this value overrides the sfdcLoginUrl value in your sfdx-project.json file. To specify a My Domain URL, use the format MyDomainName.my.salesforce.com (not MyDomainName.lightning.force.com). To specify a sandbox, set --instance-url to https://MyDomainName--SandboxName.sandbox.my.salesforce.com.

# examples

- $ <%= config.bin %> <%= command.id %> -o me@my.org -f <path to jwt key file> -i <OAuth client id>

- $ <%= config.bin %> <%= command.id %> -o me@my.org -f <path to jwt key file> -i <OAuth client id> -s -a MyDefaultOrg

- $ <%= config.bin %> <%= command.id %> -o me@acme.org -f <path to jwt key file> -i <OAuth client id> -r https://acme.my.salesforce.com

# username

authentication username

# key

path to a file containing the private key

# JwtGrantError

We encountered a JSON web token error, which is likely not an issue with Salesforce CLI. Here’s the error: %s
