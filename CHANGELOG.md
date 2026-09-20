# Changelog

All notable changes to this project will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

Per-version release notes for tagged releases are published on the [GitHub Releases page](https://github.com/WYRE-AI/yeastar-mcp/releases) - `semantic-release` generates them from commit history at release time.

## [Unreleased]

### Added

- Initial v1 release: 26 read-only tools covering system info/capacity, extensions, extension groups, trunks (with SIP-secret field stripping), inbound/outbound routes, IVR menus, ring groups, queues (including live call/agent status), the company contact directory, call detail records, call reports, backup metadata, and certificate metadata. Targets the P-Series Appliance Edition OpenAPI (P550/P560/P570, firmware 37.7.0.16+); Cloud Edition is unverified, not confirmed-incompatible. Per-appliance OAuth-style Client ID/Secret credentials, exchanged internally for a cached, auto-refreshing access token. See README's Scope section for the full accounting of excluded write/control/credential-exposing/bulk-content endpoints.
