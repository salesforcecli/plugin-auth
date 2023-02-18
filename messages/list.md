# summary

List authorization information about the orgs you created or logged into.

# description

This command uses local authorization information that Salesforce CLI caches when you create a scratch org or log into an org. The command doesn't actually connect to the orgs to verify that they're still active. As a result, this command executes very quickly. If you want to view live information about your authorized orgs, such as their connection status, use the "org list" command.

# examples

- List local authorization information about your orgs:

  <%= config.bin %> <%= command.id %>

# noResultsFound

No results found.
