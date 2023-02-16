# summary

Authorize an org using a device code.

# description

You must open a browser, navigate to the verification URL, and enter the code. Log in, if not already logged in, and you’ll be prompted to allow the device to connect to the org.

# examples

- $ <%= config.bin %> <%= command.id %> -d -a TestOrg1

- $ <%= config.bin %> <%= command.id %> -i <OAuth client id>

- $ <%= config.bin %> <%= command.id %> -r https://MyDomainName--SandboxName.sandbox.my.salesforce.com

# actionRequired

Action Required!

# enterCode

Enter %s user code in the verification URL %s

# success

Login successful for %s. You can now close the browser.
