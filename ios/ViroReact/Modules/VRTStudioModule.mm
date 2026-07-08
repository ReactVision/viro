#import "VRTStudioModule.h"
#import <React/RCTUtils.h>

static NSString *const kBaseUrl      = @"https://platform.reactvision.xyz";
static NSString *const kApiKeyKey    = @"RVApiKey";
static NSString *const kProjectIdKey = @"RVProjectId";
static const NSTimeInterval kTimeout = 30.0;
// scene-api-request waits on the upstream API (timeout_ms caps at 30s), so the
// transport must outlive the proxy's own timeout or valid requests get cut off.
static const NSTimeInterval kApiRequestTimeout = 40.0;

// @internal session auth for first-party apps (e.g. StudioGo). When set, the
// fetch methods target this base URL with Authorization: Bearer + x-rv-client
// and send NO x-api-key, so the server's resolveApiAuth takes the JWT path.
// Immutable snapshot; module methods run serially on one methodQueue.
static NSDictionary *gStudioSession = nil;

@implementation VRTStudioModule

RCT_EXPORT_MODULE(VRTStudio);

- (NSString *)readInfoString:(NSString *)key {
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    NSString *v = info[key];
    return (v.length > 0) ? v : nil;
}

- (NSString *)readApiKey    { return [self readInfoString:kApiKeyKey]; }
- (NSString *)readProjectId { return [self readInfoString:kProjectIdKey]; }

// Resolves { baseUrl, headers } for the active auth mode. A set session wins
// over the manifest RVApiKey. Returns nil when neither is available.
- (NSDictionary *)authContext {
    NSDictionary *session = gStudioSession;
    if (session) {
        NSMutableDictionary *headers = [NSMutableDictionary new];
        headers[@"Authorization"] = [NSString stringWithFormat:@"Bearer %@", session[@"accessToken"]];
        NSString *clientTag = session[@"clientTag"];
        if (clientTag.length > 0) headers[@"x-rv-client"] = clientTag;
        return @{@"baseUrl": session[@"baseUrl"], @"headers": headers};
    }
    NSString *apiKey = [self readApiKey];
    if (!apiKey) return nil;
    return @{@"baseUrl": kBaseUrl, @"headers": @{@"x-api-key": apiKey}};
}

- (void)runGet:(NSString *)url headers:(NSDictionary *)headers resolve:(RCTPromiseResolveBlock)resolve {
    NSURL *nsUrl = [NSURL URLWithString:url];
    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:nsUrl
                                                       cachePolicy:NSURLRequestUseProtocolCachePolicy
                                                   timeoutInterval:kTimeout];
    [req setHTTPMethod:@"GET"];
    [headers enumerateKeysAndObjectsUsingBlock:^(NSString *name, NSString *value, BOOL *stop) {
        [req setValue:value forHTTPHeaderField:name];
    }];

    NSURLSession *session = [NSURLSession sharedSession];
    [[session dataTaskWithRequest:req completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        NSMutableDictionary *r = [NSMutableDictionary new];
        if (error) {
            [r setObject:@NO  forKey:@"success"];
            [r setObject:error.localizedDescription forKey:@"error"];
            resolve(r);
            return;
        }
        NSHTTPURLResponse *http = (NSHTTPURLResponse *)response;
        BOOL ok = http.statusCode >= 200 && http.statusCode < 300;
        [r setObject:@(ok) forKey:@"success"];
        if (ok && data) {
            NSString *body = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
            if (body) [r setObject:body forKey:@"data"];
        }
        if (!ok) {
            NSString *body = data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
            [r setObject:body ?: [NSString stringWithFormat:@"HTTP %ld", (long)http.statusCode] forKey:@"error"];
        }
        resolve(r);
    }] resume];
}

- (void)runPost:(NSString *)url
           body:(NSString *)bodyJson
        headers:(NSDictionary *)headers
        resolve:(RCTPromiseResolveBlock)resolve {
    NSURL *nsUrl = [NSURL URLWithString:url];
    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:nsUrl
                                                       cachePolicy:NSURLRequestReloadIgnoringLocalCacheData
                                                   timeoutInterval:kApiRequestTimeout];
    [req setHTTPMethod:@"POST"];
    [req setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    [headers enumerateKeysAndObjectsUsingBlock:^(NSString *name, NSString *value, BOOL *stop) {
        [req setValue:value forHTTPHeaderField:name];
    }];
    [req setHTTPBody:[bodyJson dataUsingEncoding:NSUTF8StringEncoding]];

    NSURLSession *session = [NSURLSession sharedSession];
    [[session dataTaskWithRequest:req completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        NSMutableDictionary *r = [NSMutableDictionary new];
        if (error) {
            [r setObject:@NO  forKey:@"success"];
            [r setObject:error.localizedDescription forKey:@"error"];
            resolve(r);
            return;
        }
        NSHTTPURLResponse *http = (NSHTTPURLResponse *)response;
        BOOL ok = http.statusCode >= 200 && http.statusCode < 300;
        [r setObject:@(ok) forKey:@"success"];
        if (ok && data) {
            NSString *body = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
            if (body) [r setObject:body forKey:@"data"];
        }
        if (!ok) {
            NSString *body = data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
            [r setObject:body ?: [NSString stringWithFormat:@"HTTP %ld", (long)http.statusCode] forKey:@"error"];
        }
        resolve(r);
    }] resume];
}

// JS sends the full scene-api-request body ({"function_id", "variables"}) as a
// pre-serialised string; native only transmits it, so there is no JSON
// construction to keep in sync across platforms.
RCT_EXPORT_METHOD(rvStudioApiRequest:(NSString *)bodyJson
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject) {
    NSDictionary *ctx = [self authContext];
    if (!ctx) {
        resolve(@{@"success": @NO, @"error": @"RVApiKey not set in Info.plist"});
        return;
    }
    NSString *url = [NSString stringWithFormat:@"%@/functions/v1/scene-api-request", ctx[@"baseUrl"]];
    [self runPost:url body:bodyJson headers:ctx[@"headers"] resolve:resolve];
}

RCT_EXPORT_METHOD(rvGetScene:(NSString *)sceneId
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject) {
    NSDictionary *ctx = [self authContext];
    if (!ctx) {
        resolve(@{@"success": @NO, @"error": @"RVApiKey not set in Info.plist"});
        return;
    }
    NSString *url = [NSString stringWithFormat:@"%@/functions/v1/scenes/%@",
                     ctx[@"baseUrl"],
                     [sceneId stringByAddingPercentEncodingWithAllowedCharacters:NSCharacterSet.URLPathAllowedCharacterSet]];
    [self runGet:url headers:ctx[@"headers"] resolve:resolve];
}

RCT_EXPORT_METHOD(rvGetProject:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject) {
    NSDictionary *ctx = [self authContext];
    if (!ctx) {
        resolve(@{@"success": @NO, @"error": @"RVApiKey not set in Info.plist"});
        return;
    }
    NSString *projectId = [self readProjectId];
    if (!projectId) {
        resolve(@{@"success": @NO, @"error": @"RVProjectId not set in Info.plist"});
        return;
    }
    NSString *url = [NSString stringWithFormat:@"%@/functions/v1/projects/%@",
                     ctx[@"baseUrl"],
                     [projectId stringByAddingPercentEncodingWithAllowedCharacters:NSCharacterSet.URLPathAllowedCharacterSet]];
    [self runGet:url headers:ctx[@"headers"] resolve:resolve];
}

RCT_EXPORT_METHOD(rvGetProjectId:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject) {
    NSString *projectId = [self readProjectId];
    resolve(projectId ?: [NSNull null]);
}

// @internal — sets/clears the first-party session auth (see gStudioSession).
// A dict { baseUrl, accessToken, clientTag? } enables session mode; null /
// NSNull / malformed reverts to manifest RVApiKey mode.
RCT_EXPORT_METHOD(rvSetStudioSession:(id)config
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject) {
    NSString *baseUrl     = [config isKindOfClass:[NSDictionary class]] ? config[@"baseUrl"] : nil;
    NSString *accessToken = [config isKindOfClass:[NSDictionary class]] ? config[@"accessToken"] : nil;
    if (baseUrl.length == 0 || accessToken.length == 0) {
        gStudioSession = nil;
        resolve([NSNull null]);
        return;
    }
    while ([baseUrl hasSuffix:@"/"]) {
        baseUrl = [baseUrl substringToIndex:baseUrl.length - 1];
    }
    NSMutableDictionary *snapshot =
        [@{ @"baseUrl": baseUrl, @"accessToken": accessToken } mutableCopy];
    NSString *clientTag = config[@"clientTag"];
    if (clientTag.length > 0) snapshot[@"clientTag"] = clientTag;
    gStudioSession = [snapshot copy];
    resolve([NSNull null]);
}

@end
