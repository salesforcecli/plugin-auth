# summary

Authorize an org using a Salesforce DX authorization URL stored in a file or through standard input (stdin).

# description

You use the Salesforce DX (SFDX) authorization URL to authorize Salesforce CLI to connect to a target org. The URL contains the required data to accomplish the authorization, such as the client ID, client secret, and instance URL. You must specify the SFDX authorization URL in this format: "%s". Replace <clientId>, <clientSecret>, <refreshToken>, and <instanceUrl> with the values specific to your target org. For <instanceUrl>, don't include a protocol (such as "https://"). Note that although the SFDX authorization URL starts with "force://", it has nothing to do with the actual authorization. Salesforce CLI always communicates with your org using HTTPS.

To see an example of an SFDX authorization URL, run "org display --verbose" on an org.

You have three options when creating the authorization file. The easiest option is to redirect the output of the "<%= config.bin %> org display --verbose --json" command into a file. For example, using an org with alias my-org that you've already authorized:

    $ <%= config.bin %> org display --target-org my-org --verbose --json > authFile.json

The resulting JSON file contains the URL in the "sfdxAuthUrl" property of the "result" object. You can then reference the file when running this command:

    $ <%= config.bin %> <%= command.id %> --sfdx-url-file authFile.json

NOTE: The "<%= config.bin %> org display --verbose" command displays the refresh token only for orgs authorized with the web server flow, and not the JWT bearer flow.

You can also create a JSON file that has a top-level property named sfdxAuthUrl whose value is the authorization URL. Finally, you can create a normal text file that includes just the URL and nothing else.

Alternatively, you can pipe the SFDX authorization URL through standard input by specifying the --sfdx-url-stdin flag.

# flags.sfdx-url-file.summary

Path to a file that contains the Salesforce DX authorization URL.

# flags.sfdx-url-stdin.summary

Pipe the Salesforce DX authorization URL through standard input (stdin).

# examples

- Authorize an org using the SFDX authorization URL in the files/authFile.json file:

  <%= config.bin %> <%= command.id %> --sfdx-url-file files/authFile.json

- Similar to previous example, but set the org as your default and give it an alias MyDefaultOrg:

  <%= config.bin %> <%= command.id %> --sfdx-url-file files/authFile.json --set-default --alias MyDefaultOrg

- Pipe the SFDX authorization URL from stdin:

  $ echo url | sf <%= command.id %> --sfdx-url-stdin
