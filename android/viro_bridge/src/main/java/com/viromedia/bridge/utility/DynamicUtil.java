package com.viromedia.bridge.utility;
import com.facebook.react.bridge.Dynamic;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;

public class DynamicUtil {
    public static Dynamic create(ReadableMap map, String key) {
        return new Dynamic() {
            @Override
            public void recycle() {

            }

            @Override
            public int asInt() {
                return 0;
            }

            @Override
            public boolean isNull() {
                return false;
            }

            @Override
            public ReadableType getType() {
                return map.getType(key);
            }

            @Override
            public double asDouble() {
                return map.getDouble(key);
            }

            @Override
            public String asString() {
                return map.getString(key);
            }

            @Override
            public boolean asBoolean() {
                return map.getBoolean(key);
            }

            @Override
            public ReadableMap asMap() {
                return map.getMap(key);
            }

            @Override
            public ReadableArray asArray() {
                return map.getArray(key);
            }
        };
    }
}
