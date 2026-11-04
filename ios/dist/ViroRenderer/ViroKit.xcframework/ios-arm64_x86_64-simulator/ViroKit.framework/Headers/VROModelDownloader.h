//
//  VROModelDownloader.h
//  ViroKit
//
//  Copyright © 2024 Viro Media. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Callback block for model download completion.
 * @param localPath The local file path where the model was saved, or nil if download failed.
 * @param error The error that occurred during download, or nil if successful.
 */
typedef void (^VROModelDownloadCompletion)(NSString * _Nullable localPath, NSError * _Nullable error);

/**
 * Callback block for download progress updates.
 * @param progress The download progress from 0.0 to 1.0.
 */
typedef void (^VROModelDownloadProgress)(float progress);

/**
 * VROModelDownloader manages on-demand downloading of ML models for ViroCore.
 *
 * Models are downloaded to the Application Support directory and persisted
 * across app launches. The downloader handles:
 * - Checking if a model is already downloaded
 * - Downloading models from a remote URL
 * - Extracting compressed model archives (zip)
 * - Progress reporting during download
 * - Cleanup of temporary files
 *
 * Usage:
 *   [VROModelDownloader downloadModelIfNeeded:@"DepthPro"
 *                                     fromURL:baseURL
 *                                    progress:^(float progress) { ... }
 *                                  completion:^(NSString *path, NSError *error) { ... }];
 */
@interface VROModelDownloader : NSObject

#pragma mark - Model Status

/**
 * Check if a model is already downloaded and available locally.
 * @param modelName The name of the model (e.g., "DepthPro").
 * @return YES if the model exists locally, NO otherwise.
 */
+ (BOOL)isModelDownloaded:(NSString *)modelName;

/**
 * Get the local file path for a model.
 * @param modelName The name of the model.
 * @return The local path where the model is/would be stored.
 */
+ (NSString *)localPathForModel:(NSString *)modelName;

/**
 * Get the size of a downloaded model in bytes.
 * @param modelName The name of the model.
 * @return The size in bytes, or 0 if not downloaded.
 */
+ (unsigned long long)modelSizeOnDisk:(NSString *)modelName;

#pragma mark - Download

/**
 * Download a model if it's not already available locally.
 *
 * If the model is already downloaded, completion is called immediately with the local path.
 * If not, the model is downloaded from the specified base URL, extracted, and saved.
 *
 * @param modelName The name of the model (e.g., "DepthPro").
 * @param baseURL The base URL where models are hosted. The full URL will be:
 *                baseURL/modelName.mlmodelc.zip
 * @param progressBlock Called periodically during download with progress (0.0-1.0). May be nil.
 * @param completion Called when download completes or fails. Called on main thread.
 */
+ (void)downloadModelIfNeeded:(NSString *)modelName
                      fromURL:(NSURL *)baseURL
                     progress:(nullable VROModelDownloadProgress)progressBlock
                   completion:(VROModelDownloadCompletion)completion;

/**
 * Download a model, overwriting any existing local copy.
 *
 * @param modelName The name of the model.
 * @param baseURL The base URL where models are hosted.
 * @param progressBlock Called periodically during download with progress. May be nil.
 * @param completion Called when download completes or fails. Called on main thread.
 */
+ (void)downloadModel:(NSString *)modelName
              fromURL:(NSURL *)baseURL
             progress:(nullable VROModelDownloadProgress)progressBlock
           completion:(VROModelDownloadCompletion)completion;

#pragma mark - Cleanup

/**
 * Delete a downloaded model from local storage.
 * @param modelName The name of the model to delete.
 * @return YES if deletion was successful or model didn't exist, NO on error.
 */
+ (BOOL)deleteModel:(NSString *)modelName;

/**
 * Delete all downloaded models.
 * @return YES if all deletions were successful, NO if any failed.
 */
+ (BOOL)deleteAllModels;

#pragma mark - Configuration

/**
 * Get the directory where models are stored.
 * Creates the directory if it doesn't exist.
 * @return The models directory path.
 */
+ (NSString *)modelsDirectory;

@end

NS_ASSUME_NONNULL_END
