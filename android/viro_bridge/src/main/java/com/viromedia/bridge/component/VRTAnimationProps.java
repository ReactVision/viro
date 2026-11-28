package com.viromedia.bridge.component;

/**
 * The values of an `animation` prop that decide how the animation plays. Two props with
 * the same values are equal, whatever objects carried them.
 *
 * Under Fabric a parent that re-renders with a new but equal `animation` object has the
 * prop applied again. A node compares the incoming values with the ones it last applied
 * and leaves a prop that changed nothing alone.
 */
public final class VRTAnimationProps {
    public final String name;
    public final boolean run;
    public final boolean loop;
    /** Milliseconds, or -1 when not given. */
    public final float delay;
    /** Milliseconds, or -1 when not given. */
    public final long duration;
    public final boolean interruptible;

    public VRTAnimationProps(String name, boolean run, boolean loop, float delay, long duration,
                             boolean interruptible) {
        this.name = name;
        this.run = run;
        this.loop = loop;
        this.delay = delay;
        this.duration = duration;
        this.interruptible = interruptible;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof VRTAnimationProps)) return false;
        VRTAnimationProps other = (VRTAnimationProps) o;
        return run == other.run
                && loop == other.loop
                && Float.compare(delay, other.delay) == 0
                && duration == other.duration
                && interruptible == other.interruptible
                && (name == null ? other.name == null : name.equals(other.name));
    }

    @Override
    public int hashCode() {
        int result = name == null ? 0 : name.hashCode();
        result = 31 * result + (run ? 1 : 0);
        result = 31 * result + (loop ? 1 : 0);
        result = 31 * result + Float.floatToIntBits(delay);
        result = 31 * result + (int) (duration ^ (duration >>> 32));
        result = 31 * result + (interruptible ? 1 : 0);
        return result;
    }
}
