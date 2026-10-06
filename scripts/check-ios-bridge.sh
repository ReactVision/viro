#!/usr/bin/env bash
#
# Checks that the iOS bridge archive and the sources agree.
#
# iOS links the prebuilt ios/dist/lib/libViroReact.a, which ViroReact.xcodeproj builds from the
# files in its Sources phase, and ios/ViroReact.podspec keeps every bridge .mm out of the pod's
# compile when that archive exists. Two things therefore have to hold for a view to exist on iOS:
#
#   1. its .mm is in the Xcode target, or no rebuild will ever carry it;
#   2. its class is in the archive, or the podspec lists it under archive_fallback_sources so it
#      compiles from source until the next rebuild.
#
# VRTObjectDetectorView broke both in 3.0.2 and mounted as "View config not found". Run from
# anywhere; `npm run check:ios-bridge` and prepare_release.sh call it.

set -euo pipefail
cd "$(dirname "$0")/.."

PBXPROJ=ios/ViroReact.xcodeproj/project.pbxproj
ARCHIVE=ios/dist/lib/libViroReact.a
PODSPEC=ios/ViroReact.podspec

# Two files import headers that exist nowhere in the repository (VRTButton.h, VROTextManager.h),
# so they cannot be in any target. The podspec excludes them from visionOS for the same reason.
KNOWN_DEAD='VRTButton.mm VROTextManager.mm'

status=0

echo "1. every bridge source is in the Xcode target that builds $ARCHIVE"
while IFS= read -r file; do
    base=$(basename "$file")
    case " $KNOWN_DEAD " in *" $base "*) continue ;; esac
    if ! grep -q -F "/* $base in Sources */" "$PBXPROJ"; then
        echo "   NOT IN TARGET: $file (add it to ViroReact.xcodeproj, Sources phase)"
        status=1
    fi
done < <(find ios/ViroReact -type f \( -name '*.m' -o -name '*.mm' \) -not -path 'ios/ViroReact/VisionOS/*' | sort)

echo "2. every view manager is in the archive, or compiled from source by the podspec"
if [ ! -f "$ARCHIVE" ]; then
    echo "   no archive at $ARCHIVE; the pod compiles everything from source, nothing to check"
    exit $status
fi
# The podspec's list, one quoted path per line between `archive_fallback_sources = [` and `]`.
fallback=$(sed -n '/archive_fallback_sources = \[/,/^  \]/p' "$PODSPEC" | grep -o "'[^']*'" | tr -d "'" || true)
while IFS= read -r file; do
    cls=$(basename "$file" .mm)
    case " $KNOWN_DEAD " in *" $cls.mm "*) continue ;; esac
    if grep -q -a -F "_OBJC_CLASS_\$_$cls" "$ARCHIVE"; then
        continue
    fi
    if printf '%s\n' "$fallback" | grep -q -x -F "${file#ios/}"; then
        echo "   from source: $cls (not in the archive; the podspec compiles it until the next rebuild)"
        continue
    fi
    echo "   MISSING: $cls is in neither $ARCHIVE nor the podspec's archive_fallback_sources"
    echo "            rebuild the archive from ViroReact.xcodeproj, or list $file in the podspec"
    status=1
done < <(find ios/ViroReact -type f -name '*Manager.mm' -not -path 'ios/ViroReact/VisionOS/*' | sort)

if [ $status -eq 0 ]; then
    echo "ok"
fi
exit $status
