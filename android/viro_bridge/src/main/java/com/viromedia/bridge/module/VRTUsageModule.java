package com.viromedia.bridge.module;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

public class VRTUsageModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "VRTUsageModule";
    // In getNoBackupFilesDir(), so Auto Backup never restores the id onto another device.
    private static final String INSTALL_ID_FILE = "viro_install_id";
    private static final String API_KEY_META = "com.reactvision.RVApiKey";
    private static final String PROJECT_ID_META = "com.reactvision.RVProjectId";
    private static final String TELEMETRY_META = "com.reactvision.ViroTelemetryEnabled";
    private static final Pattern QUEST_MODEL = Pattern.compile("\\bquest\\b");

    // Also what keeps the id stable for the process when the file cannot be written.
    private static String sInstallId;

    public VRTUsageModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void getUsageInfo(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            Bundle meta = readMetaData(context);
            WritableMap info = Arguments.createMap();
            info.putString("install_id", installId(context));
            info.putString("app_id", context.getPackageName());
            info.putString("platform", isQuest() ? "quest" : "android");
            info.putString("os_version", Build.VERSION.RELEASE);
            info.putString("device_model", Build.MANUFACTURER + " " + Build.MODEL);
            putAppVersion(context, info);
            info.putBoolean("has_rv_credentials", metaString(meta, API_KEY_META) != null);
            info.putString("rv_project_id", metaString(meta, PROJECT_ID_META));
            info.putBoolean("telemetry_enabled", telemetryEnabled(meta));
            promise.resolve(info);
        } catch (Exception e) {
            promise.resolve(null);
        }
    }

    private static synchronized String installId(Context context) {
        if (sInstallId != null) return sInstallId;
        File file = new File(context.getNoBackupFilesDir(), INSTALL_ID_FILE);
        String stored = readFile(file);
        if (stored != null) {
            sInstallId = stored;
            return sInstallId;
        }
        sInstallId = UUID.randomUUID().toString();
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(sInstallId.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) {
        }
        return sInstallId;
    }

    private static String readFile(File file) {
        if (!file.isFile()) return null;
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[64];
            int length = in.read(buffer);
            if (length <= 0) return null;
            String value = new String(buffer, 0, length, StandardCharsets.UTF_8).trim();
            return value.isEmpty() ? null : value;
        } catch (Exception e) {
            return null;
        }
    }

    // Same rule as isQuest in components/Utilities/ViroPlatform.ts.
    private static boolean isQuest() {
        String manufacturer = lower(Build.MANUFACTURER);
        String brand = lower(Build.BRAND);
        if (manufacturer.equals("oculus") || manufacturer.equals("meta")
                || brand.equals("oculus") || brand.equals("meta")) {
            return true;
        }
        return QUEST_MODEL.matcher(lower(Build.MODEL)).find();
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    @SuppressWarnings("deprecation")
    private static void putAppVersion(Context context, WritableMap info) {
        try {
            PackageInfo pi = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            info.putString("app_version", pi.versionName);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? pi.getLongVersionCode()
                    : pi.versionCode;
            info.putString("app_build", String.valueOf(code));
        } catch (Exception e) {
            info.putNull("app_version");
            info.putNull("app_build");
        }
    }

    private static Bundle readMetaData(Context context) {
        try {
            ApplicationInfo ai = context.getPackageManager()
                    .getApplicationInfo(context.getPackageName(), PackageManager.GET_META_DATA);
            return ai.metaData;
        } catch (Exception e) {
            return null;
        }
    }

    private static String metaString(Bundle meta, String key) {
        String value = meta != null ? meta.getString(key) : null;
        return (value != null && !value.isEmpty()) ? value : null;
    }

    // The manifest parses android:value="false" into a Boolean, not a String.
    @SuppressWarnings("deprecation")
    private static boolean telemetryEnabled(Bundle meta) {
        Object value = meta != null ? meta.get(TELEMETRY_META) : null;
        if (value instanceof Boolean) return (Boolean) value;
        if (value instanceof String) return !"false".equalsIgnoreCase(((String) value).trim());
        return true;
    }
}
