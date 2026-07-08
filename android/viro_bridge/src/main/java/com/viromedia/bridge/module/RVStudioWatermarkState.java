package com.viromedia.bridge.module;

import org.json.JSONObject;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * RVStudioWatermarkState
 *
 * Process-wide, native-only source of truth for whether the currently loaded
 * Studio scene belongs to a Free-tier org and must therefore display the
 * "Powered by ReactVision Studio" watermark.
 *
 * The flag is written ONLY from the native rvGetScene response (see
 * VRTStudioModule), never from JavaScript, so an SDK consumer cannot strip the
 * watermark by editing JS. The AR scene navigator registers a Listener to
 * show/hide its native overlay. Listeners may be invoked on a background
 * thread; UI work must be posted to the main thread by the listener.
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

    /**
     * Parses a scenes endpoint response body and updates the flag from its
     * {@code is_free_tier} field. Malformed/absent → not free (no watermark).
     */
    public void updateFromSceneJson(String json) {
        boolean freeTier = false;
        if (json != null) {
            try {
                JSONObject obj = new JSONObject(json);
                freeTier = obj.optBoolean("is_free_tier", false);
            } catch (Exception ignored) {
                // Leave freeTier = false on parse failure.
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
