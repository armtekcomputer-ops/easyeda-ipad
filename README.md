# EasyEDA iPad

An experimental iPad-first web/PWA client and interaction layer for workflows built around the official EasyEDA Pro extension APIs and API Gateway.

> This project is not a fork of the proprietary EasyEDA Pro editor source code. It is an independent touch-first client shell intended to integrate with the public EasyEDA Pro SDK/API Gateway where supported.

## Goals

- iPad Safari and Home Screen PWA support
- Touch-first controls with 44px+ targets
- Apple Pencil-aware pointer handling
- Pinch zoom and two-finger pan foundations
- Keyboard and trackpad support
- Responsive landscape/portrait workspace
- WebSocket bridge client for EasyEDA API Gateway workflows

## Architecture

```text
iPad Safari / PWA
        |
        v
Touch + Pencil Workspace UI
        |
        v
Gateway Client
        |
        v
Bridge Server / EasyEDA API Gateway
        |
        v
EasyEDA Pro Extension API
```

## Status

Phase 1 foundation in progress.

## Upstream references

- https://github.com/easyeda/pro-api-sdk
- https://github.com/easyeda/eext-run-api-gateway
- https://github.com/easyeda/easyeda-api-skill
