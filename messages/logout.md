# summary

Log out of a Salesforce org.

# description

If you run this command with no flags and no default org set in your config or environment, it first displays a list of orgs you've created or logged into, with none of the orgs selected. Use the arrow keys to scroll through the list and the space bar to select the orgs you want to log out of. Press Enter when you're done; the command asks for a final confirmation before logging out of the selected orgs.

The process is similar if you specify --all, except that in the initial list of orgs, they're all selected. Use --target-org to logout of a specific org. In both these cases by default, you must still confirm that you want to log out. Use --no-prompt to never be asked for confirmation when also using --all or --target-org.

Be careful! If you log out of a scratch org without having access to its password, you can't access the scratch org again, either through the CLI or the Salesforce UI.

# examples

- Interactively select the orgs to log out of:

  <%= config.bin %> <%= command.id %>

- Log out of the org with username me@my.org:

  <%= config.bin %> <%= command.id %> --target-org me@my.org

- Log out of all orgs after confirmation:

  <%= config.bin %> <%= command.id %> --all

- Logout of the org with alias my-scratch and don't prompt for confirmation:

  <%= config.bin %> <%= command.id %> --target-org my-scratch --no-prompt

# flags.target-org.summary

Username or alias of the target org.

# flags.all.summary

Include all authenticated orgs.

# flags.all.description

All orgs includes Dev Hubs, sandboxes, DE orgs, and expired, deleted, and unknown-status scratch orgs.

# logoutOrgCommandSuccess

Successfully logged out of orgs: %s

# noOrgsFound

No orgs found to log out of.

# noOrgsSelected

No orgs selected for logout.

# prompt.select-envs

Select the orgs you want to log out of:

# prompt.confirm

Are you sure you want to log out of %d org%s?

# prompt.confirm-all

Are you sure you want to log out of all your orgs?

# prompt.confirm.single

Are you sure you want to log out of %s?

# warning

Warning: If you log out of a scratch org without having access to its password, you can't access this org again, either through the CLI or the Salesforce UI.

# noOrgSpecifiedWithNoPrompt

You must specify a target-org (or default target-org config is set) or use --all flag when using the --no-prompt flag.

# noOrgSpecifiedWithJson

You must specify a target-org (or default target-org config is set) or use --all flag when using the --json flag.
