# summary

authorize an org using an SFDX auth URL stored within a file

# description

authorize an org using an SFDX auth URL stored within a file
The SFDX auth URL must have the format "%s". NOTE: The SFDX auth URL uses the "force" protocol, and not "http" or "https". Also, the "instanceUrl" inside the SFDX auth URL doesn't include the protocol ("https://").

You have three options when creating the auth file. The easiest option is to redirect the output of the `<%= config.bin %> org:display --verbose --json` command into a file. For example, using an org you have already authorized:

    $ <%= config.bin %> <%= command.id %> org:display -o <OrgUsername> --verbose --json > authFile.json
    $ <%= config.bin %> <%= command.id %> -f authFile.json

The resulting JSON file contains the URL in the sfdxAuthUrl property inside of a results object. NOTE: The `org:display --verbose` command displays the refresh token only for orgs authorized with the web server flow, and not the JWT bearer flow.

You can also create a JSON file that has a top-level property named sfdxAuthUrl whose value is the auth URL. Finally, you can create a normal text file that includes just the URL and nothing else.

# file

path to a file containing the sfdx url

# examples

- $ <%= config.bin %> <%= command.id %> -f <path to sfdxAuthUrl file>

- $ <%= config.bin %> <%= command.id %> -f <path to sfdxAuthUrl file> -s -a MyDefaultOrg
