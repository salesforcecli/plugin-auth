# sfCryptoV2Support

Your current installation of Salesforce CLI, including all the plugins you've linked and installed, doesn't yet support v2 crypto. All plugins and libraries must use at least version 6.7.0 of `@salesforce/core` to support v2 crypto. You're generally still able to successfully authenticate with your current CLI installation, but not if you generate a v2 crypto key.

# sfCryptoV2Unstable

Your current installation of Salesforce CLI, including all the plugins you've linked and installed, is using v2 crypto without proper library support, which can cause authentication failures. We recommend that you switch back to v1 crypto.

# sfCryptoV2Desired

SF_CRYPTO_V2=true is set in your environment, but you're actually using v1 crypto. Your Salesforce CLI installation supports using v2 crypto. If you desire this behavior, follow the instructions in the documentation (provide link).
