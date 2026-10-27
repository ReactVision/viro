#import "VRTUsageModule.h"
#import <sys/utsname.h>

static NSString *const kInstallIdKey = @"com.reactvision.viro.installId";

static id VRTOrNull(id value) {
    return value ?: [NSNull null];
}

static NSString *VRTInfoString(NSString *key) {
    id value = [[NSBundle mainBundle] objectForInfoDictionaryKey:key];
    return ([value isKindOfClass:[NSString class]] && [value length] > 0) ? value : nil;
}

@implementation VRTUsageModule

RCT_EXPORT_MODULE(VRTUsageModule)

RCT_EXPORT_METHOD(getUsageInfo:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject) {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *installId = [defaults stringForKey:kInstallIdKey];
    if (installId.length == 0) {
        installId = [[NSUUID UUID].UUIDString lowercaseString];
        [defaults setObject:installId forKey:kInstallIdKey];
    }

    struct utsname systemInfo;
    NSString *deviceModel = nil;
    if (uname(&systemInfo) == 0) {
        deviceModel = [NSString stringWithCString:systemInfo.machine encoding:NSUTF8StringEncoding];
    }

    NSOperatingSystemVersion os = [NSProcessInfo processInfo].operatingSystemVersion;
    NSString *osVersion = os.patchVersion > 0
        ? [NSString stringWithFormat:@"%ld.%ld.%ld", (long)os.majorVersion, (long)os.minorVersion, (long)os.patchVersion]
        : [NSString stringWithFormat:@"%ld.%ld", (long)os.majorVersion, (long)os.minorVersion];

#if TARGET_OS_VISION
    NSString *platform = @"visionos";
#else
    NSString *platform = @"ios";
#endif

    // Absent means enabled; a String "false" from a hand-edited plist reads as NO too.
    id telemetry = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"ViroTelemetryEnabled"];
    BOOL telemetryEnabled = telemetry == nil
        || ([telemetry respondsToSelector:@selector(boolValue)] && [telemetry boolValue]);

    resolve(@{
        @"install_id": installId,
        @"app_id": VRTOrNull([NSBundle mainBundle].bundleIdentifier),
        @"platform": platform,
        @"os_version": osVersion,
        @"device_model": VRTOrNull(deviceModel),
        @"app_version": VRTOrNull(VRTInfoString(@"CFBundleShortVersionString")),
        @"app_build": VRTOrNull(VRTInfoString(@"CFBundleVersion")),
        @"has_rv_credentials": @(VRTInfoString(@"RVApiKey") != nil),
        @"rv_project_id": VRTOrNull(VRTInfoString(@"RVProjectId")),
        @"telemetry_enabled": @(telemetryEnabled),
    });
}

@end
