#!/usr/bin/env bash

#
# Copyright © 2017 Viro Media. All rights reserved.
#

set -e

echo '========================================================================='
echo 'Cleaning local tarballs'
echo '========================================================================='
rm -rf ./*.tgz

echo '========================================================================='
echo 'Compiling TypeScript'
echo '========================================================================='
npm run build

echo '========================================================================='
echo 'Running Unit Tests'
echo '========================================================================='
npm run test

# to be safe, clear out any old libraries in the output directory
echo '========================================================================='
echo 'Cleaning out the old build artifacts'
echo '========================================================================='
rm -f android/viro_bridge/build/outputs/aar/*.aar

echo '========================================================================='
echo 'Building the React-Viro library'
echo '========================================================================='

# Generate React Native autolinking config before ANY gradle command
# This avoids the issue with Gradle not being able to find npx
# Store it in .gradle directory so it won't be cleaned by gradle clean
echo 'Generating autolinking configuration...'
mkdir -p android/.gradle
npx react-native config > android/.gradle/autolinking.json

# Get the full path to node for Gradle to avoid PATH issues
NODE_PATH="$(command -v node)"

cd android
./gradlew -PnodeExecutable="$NODE_PATH" :viro_bridge:clean
./gradlew -PnodeExecutable="$NODE_PATH" :viro_bridge:assembleRelease
cd ..

echo '========================================================================='
echo 'Checking for build artifacts'
echo '========================================================================='
if [ ! -f android/viro_bridge/build/outputs/aar/viro_bridge-release.aar ]; then
    echo -e "Unable to find viro-bridge release output!" >&2
    exit 1
fi

echo '========================================================================='
echo 'Copying build artifacts to the lib directory'
echo '========================================================================='
rm -f android/react_viro/*.aar
cp android/viro_bridge/build/outputs/aar/viro_bridge-release.aar android/react_viro/react_viro-release.aar

echo '========================================================================='
echo 'Building the visionOS xcframework'
echo '========================================================================='

# Why this is in the release script at all:
#
# npm pack ships whatever is on disk under ios/dist — the `files` allowlist in package.json
# wins over .gitignore, so the xcframework does make it into the tarball (2515 entries).
# But nothing here ever *built* it, and it is gitignored, so the two silent failure modes
# were publishing a weeks-old xcframework, or publishing none at all from a fresh clone.
# Either one surfaces to a consumer as `pod install` failing on a missing vendored
# framework, which reads like a bug in withViroVisionOS rather than a skipped build step.
#
# Building here makes the artifact in the tarball necessarily match this commit's sources.
# That matters more than usual because the xcframework is derived: build_visionos.sh
# regenerates ViroShadersSource.txt from Shaders.metal and stages ~340 headers.
#
# Set SKIP_VISIONOS=1 to publish deliberately without it. There is no automatic skip: on a
# machine without the xros SDK this fails, because quietly shipping a stale binary is the
# exact problem this step exists to prevent.

VISIONOS_BUILD="../virocore/ios/build_visionos.sh"
XCFRAMEWORK="ios/dist/ViroRendererVisionOS/ViroKit.xcframework"

if [ "${SKIP_VISIONOS:-0}" = "1" ]; then
    echo "SKIPPED — SKIP_VISIONOS=1"
    echo "  The tarball will ship whatever is currently at $XCFRAMEWORK, or nothing."
elif [ ! -f "$VISIONOS_BUILD" ]; then
    echo -e "Cannot find $VISIONOS_BUILD — is virocore checked out alongside viro?" >&2
    echo -e "Set SKIP_VISIONOS=1 to publish without visionOS support." >&2
    exit 1
elif ! xcrun --sdk xros --show-sdk-path >/dev/null 2>&1; then
    echo -e "The xros SDK is not installed, so the visionOS xcframework cannot be built." >&2
    echo -e "Install the visionOS platform in Xcode, or set SKIP_VISIONOS=1 to publish without it." >&2
    exit 1
else
    "$VISIONOS_BUILD"

    for slice in xros-arm64 xros-arm64_x86_64-simulator; do
        if [ ! -f "$XCFRAMEWORK/$slice/libViroKitVisionOS.a" ]; then
            echo -e "Missing $slice slice in the xcframework!" >&2
            exit 1
        fi
    done
    # 32 files in ios/ViroReact import <ViroKit/ViroKit.h>. Without this forwarding header
    # the pod does not compile, and nothing notices until a consumer builds.
    if [ ! -f "$XCFRAMEWORK/xros-arm64/Headers/ViroKit/ViroKit.h" ]; then
        echo -e "ViroKit/ViroKit.h forwarding header missing — the ViroReact pod will not compile!" >&2
        exit 1
    fi
fi

echo '========================================================================='
echo 'Packing Tarball for NPM'
echo '========================================================================='
npm pack
