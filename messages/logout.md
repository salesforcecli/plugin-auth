# summary

log out from authorized orgs

# description

log out from authorized orgs
By default, this command logs you out from your default scratch org.

# examples

- $ <%= config.bin %> <%= command.id %> -o me@my.org

- $ <%= config.bin %> <%= command.id %> -a

- $ <%= config.bin %> <%= command.id %> -p

# flags.target-org.summary

Username or alias of the target org.

# all

include all authenticated orgs

# allLong

Includes all authenticated orgs: for example, Dev Hubs, sandboxes, DE orgs, and expired, deleted, and unknown-status scratch orgs.

# logoutOrgCommandSuccess

Successfully logged out of orgs: %s

# noOrgsFound

No orgs found to log out of.

# noOrgsSelected

No orgs selected for logout.

# prompt.select-envs

Select the environments you want to log out of:

# prompt.confirm

Are you sure you want to log out of %d org%s?

# prompt.confirm-all

Are you sure you want to log out of all your orgs?

# prompt.confirm.single

Are you sure you want to log out of %s?

# warning

Warning: If you log out of a scratch org without having access to its password, you can't access this environment again, either through the CLI or the Salesforce UI.

# noOrgSpecifiedWithNoPrompt

You must specify a target-org (or default target-org config is set) or use --all flag when using the --no-prompt flag.
