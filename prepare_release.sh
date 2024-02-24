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
cd android
./gradlew :viro_bridge:clean
./gradlew :viro_bridge:assembleRelease
cd ..

echo '========================================================================='
echo 'Checking for build artifacts'
echo '========================================================================='
if [ ! -f android/viro_bridge/build/outputs/aar/viro_bridge-release.aar ]; then
    echo -e "Unable to find viro-bridge release output!"
    exit
fi

echo '========================================================================='
echo 'Copying build artifacts to the lib directory'
echo '========================================================================='
rm -f android/react_viro/*.aar
cp android/viro_bridge/build/outputs/aar/viro_bridge-release.aar android/react_viro/react_viro-release.aar

echo '========================================================================='
echo 'Packing Tarball for NPM'
echo '========================================================================='
npm pack
