# summary

Authorize an org using a device code.

# description

Use this command to allow a device to connect to an org.

When you run this command, it first displays an 8-digit device code and the URL for verifying the code on your org. The default instance URL is https://login.salesforce.com, so if the org you're authorizing is on a different instance, use the --instance-url. The command waits while you complete the verification. Open a browser and navigate to the displayed verification URL, enter the code, then click Connect. If you aren't already logged into your org, log in, and then you're prompted to allow the device to connect to the org. After you successfully authorize the org, you can close the browser window.

# examples

- Authorize an org using a device code, give the org the alias TestOrg1, and set it as your default Dev Hub org:

  <%= config.bin %> <%= command.id %> --set-default-dev-hub --alias TestOrg1

- Authorize an org in which you've created a custom connected app with the specified client ID (consumer key):

  <%= config.bin %> <%= command.id %> --client-id <OAuth client id>

- Authorize a sandbox org with the specified instance URL:

  <%= config.bin %> <%= command.id %> --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com

# actionRequired

Action Required!

# enterCode

Enter %s device code in this verification URL: %s

# success

Login successful for %s. You can now close the browser.
