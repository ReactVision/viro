package com.viromedia.bridge.component;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import org.junit.Test;

/**
 * VRTNode.setAnimation leaves an `animation` prop alone when its values equal the ones
 * last applied, so a re-render with a new but equal object no longer plays a running
 * animation again. These are the comparisons it makes.
 */
public class VRTAnimationPropsTest {

    private static VRTAnimationProps looping() {
        return new VRTAnimationProps("x", true, true, -1, -1, false);
    }

    /** What VRTNode.setAnimation does with each prop, counted. */
    private static final class Node {
        VRTAnimationProps applied = null;
        int updates = 0;

        void setAnimation(VRTAnimationProps props) {
            if (props.equals(applied)) {
                return;
            }
            applied = props;
            updates++;
        }
    }

    @Test
    public void aHundredEqualPropsUpdatePlaybackOnce() {
        Node node = new Node();
        for (int i = 0; i < 100; i++) {
            // A new object each time, as an inline `animation={{ ... }}` gives.
            node.setAnimation(looping());
        }
        assertEquals(1, node.updates);
    }

    @Test
    public void eachPlaybackValueCounts() {
        VRTAnimationProps base = looping();
        assertNotEquals(base, new VRTAnimationProps("y", true, true, -1, -1, false));
        assertNotEquals(base, new VRTAnimationProps(null, true, true, -1, -1, false));
        assertNotEquals(base, new VRTAnimationProps("x", false, true, -1, -1, false));
        assertNotEquals(base, new VRTAnimationProps("x", true, false, -1, -1, false));
        assertNotEquals(base, new VRTAnimationProps("x", true, true, 250, -1, false));
        assertNotEquals(base, new VRTAnimationProps("x", true, true, -1, 1000, false));
        assertNotEquals(base, new VRTAnimationProps("x", true, true, -1, -1, true));
    }

    @Test
    public void runTurnedOffAndOnAgainUpdatesEachTime() {
        Node node = new Node();
        node.setAnimation(looping());
        node.setAnimation(new VRTAnimationProps("x", false, true, -1, -1, false));
        node.setAnimation(looping());
        assertEquals(3, node.updates);
    }

    @Test
    public void equalPropsHashAlike() {
        assertEquals(looping().hashCode(), looping().hashCode());
        assertEquals(new VRTAnimationProps(null, false, false, -1, -1, false),
                new VRTAnimationProps(null, false, false, -1, -1, false));
    }
}
