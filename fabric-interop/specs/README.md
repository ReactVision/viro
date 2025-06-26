# TurboModule Specifications

This directory contains TurboModule specifications for the Viro Fabric-Interop layer.

## Files

- **ViroEventsTurboModule.ts**: TurboModule specification for event emission and management in React Native's New Architecture.

## Purpose

These TypeScript files define the interfaces for TurboModules that bridge JavaScript and native code in React Native's New Architecture (Fabric). They are used by the codegen system to generate the appropriate native interfaces.

## Usage

These specs are automatically registered with React Native's TurboModule system and provide type-safe interfaces for:

- Event emission from native to JavaScript
- JSI callback management  
- Node and scene event handling
- TurboModule lifecycle management

The native implementations (iOS `.mm` and Android `.java` files) must conform to these interfaces.