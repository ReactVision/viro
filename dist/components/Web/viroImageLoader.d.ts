/**
 * Load an image into RGBA8 bytes for the texture C API. Uses an <img> + canvas
 * so the browser decodes any format (png/jpg/webp/…). Results are cached by URL.
 */
export interface ViroRGBAImage {
    pixels: Uint8Array;
    width: number;
    height: number;
}
/**
 * Resolve a Viro image source to a URL. Web supports a string URL or { uri }.
 * (react-native-web/bundlers turn require('./x.png') into a URL string.)
 */
export declare function resolveImageSource(source: unknown): string | undefined;
export declare function loadImageRGBA(url: string): Promise<ViroRGBAImage>;
