package com.viromedia.bridge.utility;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.lang.ref.WeakReference;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.Test;

/**
 * ControllerModule holds each getControllerRayAsync / getControllerForwardAsync request
 * here until the renderer answers or the request times out (workaround ID
 * viroreact-controller-ray-weak-callback).
 */
public class PendingRequestsTest {

    @Test
    public void aPendingRequestSurvivesGarbageCollection() {
        PendingRequests pending = new PendingRequests();
        // Held the way the renderer holds a callback: weakly, and by nothing else.
        WeakReference<Object> rendererRef = addUnreferenced(pending);
        for (int i = 0; i < 20; i++) {
            System.gc();
        }
        Object request = rendererRef.get();
        assertNotNull("a pending request must stay reachable", request);
        assertTrue(pending.claim(request));
        assertEquals(0, pending.size());
    }

    private static WeakReference<Object> addUnreferenced(PendingRequests pending) {
        Object request = new Object();
        pending.add(request);
        return new WeakReference<>(request);
    }

    @Test
    public void onlyTheFirstClaimSettles() {
        PendingRequests pending = new PendingRequests();
        Object request = new Object();
        pending.add(request);
        assertTrue(pending.claim(request));
        assertFalse(pending.claim(request));
        assertFalse(pending.claim(new Object()));
    }

    @Test
    public void anAnswerAndATimeoutRacingSettleEachRequestOnce() throws InterruptedException {
        final PendingRequests pending = new PendingRequests();
        final int requests = 10000;
        final Object[] all = new Object[requests];
        for (int i = 0; i < requests; i++) {
            all[i] = new Object();
            pending.add(all[i]);
        }
        final AtomicInteger settled = new AtomicInteger();
        final CountDownLatch start = new CountDownLatch(1);
        Runnable claimAll = new Runnable() {
            @Override
            public void run() {
                try {
                    start.await();
                } catch (InterruptedException e) {
                    return;
                }
                for (Object request : all) {
                    if (pending.claim(request)) {
                        settled.incrementAndGet();
                    }
                }
            }
        };
        Thread answer = new Thread(claimAll);
        Thread timeout = new Thread(claimAll);
        answer.start();
        timeout.start();
        start.countDown();
        answer.join();
        timeout.join();
        assertEquals(requests, settled.get());
        assertEquals(0, pending.size());
    }
}
