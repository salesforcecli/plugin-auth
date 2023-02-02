# summary

log out from authorized orgs

# description

log out from authorized orgs
By default, this command logs you out from your default scratch org.

# examples

- $ <%= config.bin %> <%= command.id %> -o me@my.org

- $ <%= config.bin %> <%= command.id %> -a

- $ <%= config.bin %> <%= command.id %> -p

# all

include all authenticated orgs

# allLong

Includes all authenticated orgs: for example, Dev Hubs, sandboxes, DE orgs, and expired, deleted, and unknown-status scratch orgs.

# logoutCommandYesNo

Are you sure you want to log out from these org(s)?
%s

Important: You need a password to reauthorize scratch orgs. By default, scratch orgs have no password. If you still need your scratch orgs, run "%s org:generate:password" before logging out. If you don't need the scratch orgs anymore, run "%s org:delete:scratch" or "%s org:delete:sandbox"instead of logging out.

Log out (y/n)?

# logoutOrgCommandSuccess

Successfully logged out of orgs: %s

# logoutOrgCommandNoOrgsFound

No orgs found to log out of.
