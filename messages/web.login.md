# summary

Log in to a Salesforce org using the web server flow.

# description

Opens a Salesforce instance URL in a web browser so you can enter your credentials and log in to your org. After you log in, you can close the browser window.

Logging into an org authorizes the CLI to run other commands that connect to that org, such as deploying or retrieving metadata. You can log into many types of orgs, such as sandboxes, Dev Hubs, Env Hubs, production orgs, and scratch orgs.

We recommend that you set an alias when you log into an org. Aliases make it easy to later reference this org when running commands that require it. If you don’t set an alias, you use the username that you specified when you logged in to the org. If you run multiple commands that reference the same org, consider setting the org as your default. Use --set-default for your default scratch org or sandbox, or --set-default-dev-hub for your default Dev Hub.

By default, this command uses the global out-of-the-box connected app in your org. If you need more security or control, such as setting the refresh token timeout or specifying IP ranges, create your own connected app using a digital certificate. Make note of the consumer key (also called cliend id) that’s generated for you. Then specify the consumer key with the --client-id flag.

# examples

- Run the command with no flags to open the default Salesforce login page (https://login.salesforce.com):

  <%= config.bin %> <%= command.id %>

- Log in to your Dev Hub, set it as your default Dev Hub, and set an alias that you reference later when you create a scratch org:

  <%= config.bin %> <%= command.id %> --set-default-dev-hub --alias dev-hub

- Log in to a sandbox and set it as your default org:

  <%= config.bin %> <%= command.id %> --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com --set-default

- Use --browser to specify a specific browser, such as Google Chrome:

  <%= config.bin %> <%= command.id %> --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com --set-default --browser chrome

- Use your own connected app by specifying its consumer key (also called client ID):

  <%= config.bin %> <%= command.id %> --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com --set-default --browser chrome --client-id 04580y4051234051

# flags.browser.summary

Browser in which to open the org.

# flags.browser.description

If you don’t specify --browser, the command uses your default browser. The exact names of the browser applications differ depending on the operating system you're on; check your documentation for details.

# deviceWarning

"<%= config.bin %> <%= command.id %>" doesn't work when authorizing to a headless environment. Use "<%= config.bin %> org login device" instead.

# invalidClientId

Invalid client credentials. Verify the OAuth client secret and ID. %s
