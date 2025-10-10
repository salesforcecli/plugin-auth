# summary

Log in to a Salesforce org using the web server flow.

# description

Opens a Salesforce instance URL in a web browser so you can enter your credentials and log in to your org. After you log in, you can close the browser window.

Logging into an org authorizes the CLI to run other commands that connect to that org, such as deploying or retrieving metadata. You can log into many types of orgs, such as sandboxes, Dev Hubs, Env Hubs, production orgs, and scratch orgs.

We recommend that you set an alias when you log into an org. Aliases make it easy to later reference this org when running commands that require it. If you don’t set an alias, you use the username that you specified when you logged in to the org. If you run multiple commands that reference the same org, consider setting the org as your default. Use --set-default for your default scratch org or sandbox, or --set-default-dev-hub for your default Dev Hub.

By default, this command uses the global out-of-the-box connected app in your org. If you need more security or control, such as setting the refresh token timeout or specifying IP ranges, create your own connected app using a digital certificate. Make note of the consumer key (also called cliend id) that’s generated for you. Then specify the consumer key with the --client-id flag.

You can also use this command to link one or more connected or external client apps in an org to an already-authenticated user. Then Salesforce CLI commands that have API-specific requirements, such as new OAuth scopes or JWT-based access tokens, can use these custom client apps rather than the default one. To create the link, you use the --client-app flag to give the link a name and the --username flag to specify the already-authenticated user. Use the --scopes flag to add OAuth scopes if required. After you create the link, you then use the --client-app value in the other command that has the API-specific requirements. An example of a command that uses this feature is "agent preview"; see the "Preview an Agent" section in the "Agentforce Developer Guide" for details and examples. (https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx-preview.html)

# examples

- Run the command with no flags to open the default Salesforce login page (https://login.salesforce.com):

  <%= config.bin %> <%= command.id %>

- Log in to your Dev Hub, set it as your default Dev Hub, and set an alias that you reference later when you create a scratch org:

  <%= config.bin %> <%= command.id %> --set-default-dev-hub --alias dev-hub

- Log in to a sandbox and set it as your default org:

  <%= config.bin %> <%= command.id %> --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com --set-default

- Use --browser to specify a specific browser, such as Google Chrome:

  <%= config.bin %> <%= command.id %> --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com --set-default --browser chrome

- Use your own connected app by specifying its consumer key (also called client ID) and specify additional OAuth scopes:

  <%= config.bin %> <%= command.id %> --instance-url https://MyDomainName--SandboxName.sandbox.my.salesforce.com --set-default --browser chrome --client-id 04580y4051234051 --scopes "sfap_api chatbot_api"

# flags.browser.summary

Browser in which to open the org.

# flags.browser.description

If you don’t specify --browser, the command uses your default browser. The exact names of the browser applications differ depending on the operating system you're on; check your documentation for details.

# flags.client-app.summary

Name to give to the link between the connected app or external client and the already-authenticated user. You can specify any string you want. Must be used with --username.

# flags.username.summary

Username of the already-authenticated user to link to the connected app or external client app. Must be used with --client-app.

# flags.scopes.summary

Authentication (OAuth) scopes to request. Use the scope's short name; specify multiple scopes using just one flag instance and separated by spaces: --scopes "sfap_api chatbot_api".

# linkedClientApp

Successfully linked "%s" client app to %s.

# error.headlessWebAuth

"org login web" is not supported when authorizing to a headless environment. Use another OAuth flow (e.g., JWT Bearer Flow).

# invalidClientId

Invalid client credentials. Verify the OAuth client secret and ID. %s

# error.cannotOpenBrowser

Unable to open the browser you specified (%s).

# error.cannotOpenBrowser.actions

- Ensure that %s is installed on your computer. Or specify a different browser using the --browser flag.
