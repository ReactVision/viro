package com.viromedia.bridge.utility;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The requests the renderer has not answered yet.
 *
 * The renderer keeps the Java callback of an asynchronous request through a weak JNI
 * reference only. A callback nothing else holds can be collected before the answer, and
 * the renderer then drops the answer without a word, so the promise behind it never
 * settles. Holding the request here until it is answered keeps the callback alive, and
 * {@link #claim} lets the answer and a timeout race safely: whichever comes first
 * settles the promise, the other finds the request gone.
 */
public final class PendingRequests {
    private final Set<Object> mPending =
            Collections.newSetFromMap(new ConcurrentHashMap<Object, Boolean>());

    /** Hold the request until it is claimed. */
    public void add(Object request) {
        mPending.add(request);
    }

    /**
     * Stop holding the request. True for the first caller only, who then settles it;
     * false when it was already claimed (or never added).
     */
    public boolean claim(Object request) {
        return mPending.remove(request);
    }

    public int size() {
        return mPending.size();
    }
}
