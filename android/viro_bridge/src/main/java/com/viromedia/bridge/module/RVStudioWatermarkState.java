package com.viromedia.bridge.module;

import org.json.JSONObject;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Process-wide source of truth for the Free-tier "Powered by ReactVision
 * Studio" watermark. Written only from the native rvGetScene response, never
 * from JS, so a consumer cannot strip the watermark by editing JS. Listeners
 * may fire on a background thread; post UI work to the main thread.
 */
public final class RVStudioWatermarkState {

    public interface Listener {
        void onWatermarkChanged(boolean freeTier);
    }

    private static final RVStudioWatermarkState INSTANCE = new RVStudioWatermarkState();

    private volatile boolean mFreeTier = false;
    private final Set<Listener> mListeners =
            Collections.newSetFromMap(new ConcurrentHashMap<Listener, Boolean>());

    private RVStudioWatermarkState() {}

    public static RVStudioWatermarkState getInstance() {
        return INSTANCE;
    }

    public boolean isFreeTier() {
        return mFreeTier;
    }

    public void addListener(Listener listener) {
        mListeners.add(listener);
    }

    public void removeListener(Listener listener) {
        mListeners.remove(listener);
    }

    // Malformed/absent is_free_tier defaults to false (no watermark).
    public void updateFromSceneJson(String json) {
        boolean freeTier = false;
        if (json != null) {
            try {
                JSONObject obj = new JSONObject(json);
                freeTier = obj.optBoolean("is_free_tier", false);
            } catch (Exception ignored) {
            }
        }
        setFreeTier(freeTier);
    }

    private void setFreeTier(boolean freeTier) {
        if (mFreeTier == freeTier) {
            return;
        }
        mFreeTier = freeTier;
        for (Listener listener : mListeners) {
            listener.onWatermarkChanged(freeTier);
        }
    }
}
