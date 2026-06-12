#import "VRTStudioModule.h"
#import <React/RCTUtils.h>

static NSString *const kBaseUrl      = @"https://platform.reactvision.xyz";
static NSString *const kApiKeyKey    = @"RVApiKey";
static NSString *const kProjectIdKey = @"RVProjectId";
static const NSTimeInterval kTimeout = 30.0;
// scene-api-request waits on the upstream API (timeout_ms caps at 30s), so the
// transport must outlive the proxy's own timeout or valid requests get cut off.
static const NSTimeInterval kApiRequestTimeout = 40.0;

@implementation VRTStudioModule

RCT_EXPORT_MODULE(VRTStudio);

- (NSString *)readInfoString:(NSString *)key {
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    NSString *v = info[key];
    return (v.length > 0) ? v : nil;
}

- (NSString *)readApiKey    { return [self readInfoString:kApiKeyKey]; }
- (NSString *)readProjectId { return [self readInfoString:kProjectIdKey]; }

- (void)runGet:(NSString *)url apiKey:(NSString *)apiKey resolve:(RCTPromiseResolveBlock)resolve {
    NSURL *nsUrl = [NSURL URLWithString:url];
    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:nsUrl
                                                       cachePolicy:NSURLRequestUseProtocolCachePolicy
                                                   timeoutInterval:kTimeout];
    [req setHTTPMethod:@"GET"];
    [req setValue:apiKey forHTTPHeaderField:@"x-api-key"];

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
         apiKey:(NSString *)apiKey
        resolve:(RCTPromiseResolveBlock)resolve {
    NSURL *nsUrl = [NSURL URLWithString:url];
    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:nsUrl
                                                       cachePolicy:NSURLRequestReloadIgnoringLocalCacheData
                                                   timeoutInterval:kApiRequestTimeout];
    [req setHTTPMethod:@"POST"];
    [req setValue:apiKey forHTTPHeaderField:@"x-api-key"];
    [req setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
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
    NSString *apiKey = [self readApiKey];
    if (!apiKey) {
        resolve(@{@"success": @NO, @"error": @"RVApiKey not set in Info.plist"});
        return;
    }
    NSString *url = [NSString stringWithFormat:@"%@/functions/v1/scene-api-request", kBaseUrl];
    [self runPost:url body:bodyJson apiKey:apiKey resolve:resolve];
}

RCT_EXPORT_METHOD(rvGetScene:(NSString *)sceneId
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject) {
    NSString *apiKey = [self readApiKey];
    if (!apiKey) {
        resolve(@{@"success": @NO, @"error": @"RVApiKey not set in Info.plist"});
        return;
    }
    NSString *url = [NSString stringWithFormat:@"%@/functions/v1/scenes/%@",
                     kBaseUrl,
                     [sceneId stringByAddingPercentEncodingWithAllowedCharacters:NSCharacterSet.URLPathAllowedCharacterSet]];
    [self runGet:url apiKey:apiKey resolve:resolve];
}

RCT_EXPORT_METHOD(rvGetProject:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject) {
    NSString *apiKey = [self readApiKey];
    if (!apiKey) {
        resolve(@{@"success": @NO, @"error": @"RVApiKey not set in Info.plist"});
        return;
    }
    NSString *projectId = [self readProjectId];
    if (!projectId) {
        resolve(@{@"success": @NO, @"error": @"RVProjectId not set in Info.plist"});
        return;
    }
    NSString *url = [NSString stringWithFormat:@"%@/functions/v1/projects/%@",
                     kBaseUrl,
                     [projectId stringByAddingPercentEncodingWithAllowedCharacters:NSCharacterSet.URLPathAllowedCharacterSet]];
    [self runGet:url apiKey:apiKey resolve:resolve];
}

RCT_EXPORT_METHOD(rvGetProjectId:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject) {
    NSString *projectId = [self readProjectId];
    resolve(projectId ?: [NSNull null]);
}

@end
