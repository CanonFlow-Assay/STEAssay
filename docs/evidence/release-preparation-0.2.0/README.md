# Release preparation — 0.2.0

This bundle records a clean installation exercise for the exact 0.2.0 tarball
built from the artifact-build commit listed in `evidence.json`. Verify the
recorded artifact metadata bytes with:

```sh
sha256sum -c SHA256SUMS
```

The package allowlist excludes this evidence directory. A later release decision
must rebuild `npm pack` from final merged main and require the recorded tarball
SHA-256 before publishing. This PR does not publish, tag, or create a release.
