# sfCryptoV2Support

This CLI does not yet support v2 crypto. All plugins and libraries must use at least version 6.5.1 of `@salesforce/core` to support v2 crypto. This will not cause a problem with CLI authentication unless a v2 crypto key has been generated.

# sfCryptoV2Unstable

This CLI is using v2 crypto without proper library support. This can cause authentication failures. Switching back to v1 crypto is recommended.

# sfCryptoV2Desired

SF_CRYPTO_V2=true is set but v1 crypto is actually in use. This CLI supports using v2 crypto. If this is desired please follow the instructions in the docs (provide link).
