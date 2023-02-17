# summary

Authorize an org using a device code.

# description

When you run this command, it first displays an 8-digit device code and the URL for verifying the code on your org. The default instance URL is https://login.salesforce.com, so if the org you're authorizing is on a different instance, use the --instance-url. The command waits while you complete the verification. Open a browser and navigate to the displayed verification URL, enter the code, then click Connect. If you aren't already logged into your org, log in, and then you're prompted to allow the device to connect to the org. After you successfully authorize the org, you can close the browser window.

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
