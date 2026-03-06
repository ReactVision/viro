// Copyright © 2026 ReactVision. All rights reserved.
// Proprietary and Confidential
//
// Called from C++ via JNI (NetworkClient_Android.cpp).
// Handles JSON, binary, and multipart HTTP requests using
// HttpURLConnection — no extra dependencies required.

package com.reactvision.cca;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class RVHttpClient {

    // -----------------------------------------------------------------------
    // JSON / binary request
    //
    // Returns String[3]: { statusCode, responseBody, errorMessage }
    // statusCode = "0" means a connection-level error (not HTTP error).
    // -----------------------------------------------------------------------
    public static String[] send(
            String method,
            String url,
            String apiKey,
            String contentType,
            byte[] body,
            int timeoutSec,
            String[] headerNames,
            String[] headerValues) {

        HttpURLConnection conn = null;
        try {
            conn = openConnection(url, method, apiKey, timeoutSec);

            if (headerNames != null) {
                for (int i = 0; i < headerNames.length; i++)
                    conn.setRequestProperty(headerNames[i], headerValues[i]);
            }

            if (body != null && body.length > 0) {
                conn.setDoOutput(true);
                if (contentType != null && !contentType.isEmpty()) {
                    conn.setRequestProperty("Content-Type", contentType);
                }
                conn.getOutputStream().write(body);
            }

            return readResponse(conn);

        } catch (Exception e) {
            return errorResult(e);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    // -----------------------------------------------------------------------
    // Multipart/form-data upload
    //
    // Text fields: textNames[i] → textValues[i]
    // File fields: fileNames[i], fileData[i], filenames[i], contentTypes[i]
    //
    // Returns String[3]: { statusCode, responseBody, errorMessage }
    // -----------------------------------------------------------------------
    public static String[] sendMultipart(
            String   url,
            String   apiKey,
            int      timeoutSec,
            String[] textNames,
            String[] textValues,
            String[] fileNames,
            byte[][] fileData,
            String[] filenames,
            String[] contentTypes) {

        HttpURLConnection conn = null;
        try {
            String boundary = "rvboundary"
                    + UUID.randomUUID().toString().replace("-", "");

            conn = openConnection(url, "POST", apiKey, timeoutSec);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type",
                    "multipart/form-data; boundary=" + boundary);

            try (DataOutputStream out =
                         new DataOutputStream(conn.getOutputStream())) {

                // Text fields
                if (textNames != null) {
                    for (int i = 0; i < textNames.length; i++) {
                        writeTextPart(out, boundary, textNames[i], textValues[i]);
                    }
                }

                // File fields
                if (fileNames != null) {
                    for (int i = 0; i < fileNames.length; i++) {
                        writeFilePart(out, boundary,
                                fileNames[i], filenames[i],
                                contentTypes[i], fileData[i]);
                    }
                }

                out.writeBytes("--" + boundary + "--\r\n");
            }

            return readResponse(conn);

        } catch (Exception e) {
            return errorResult(e);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    // -----------------------------------------------------------------------
    // Binary download — no auth header (URL is typically pre-signed)
    //
    // Returns byte[] or null on error.
    // -----------------------------------------------------------------------
    public static byte[] downloadBinary(String url, int timeoutSec) {
        HttpURLConnection conn = null;
        try {
            URL u = new URL(url);
            conn = (HttpURLConnection) u.openConnection();
            conn.setConnectTimeout(timeoutSec * 1000);
            conn.setReadTimeout(timeoutSec * 1000);

            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) return null;

            return readAllBytes(conn.getInputStream());

        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    private static HttpURLConnection openConnection(
            String url, String method, String apiKey, int timeoutSec)
            throws IOException {

        HttpURLConnection conn =
                (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod(method.toUpperCase());
        conn.setConnectTimeout(timeoutSec * 1000);
        conn.setReadTimeout(timeoutSec * 1000);
        conn.setRequestProperty("x-api-key", apiKey);
        conn.setInstanceFollowRedirects(true);
        return conn;
    }

    private static String[] readResponse(HttpURLConnection conn)
            throws IOException {

        int status = conn.getResponseCode();
        InputStream is = (status >= 200 && status < 300)
                ? conn.getInputStream()
                : conn.getErrorStream();

        String body = "";
        if (is != null) {
            body = new String(readAllBytes(is), StandardCharsets.UTF_8);
        }
        return new String[]{ String.valueOf(status), body, "" };
    }

    private static String[] errorResult(Exception e) {
        String msg = e.getMessage();
        return new String[]{ "0", "", msg != null ? msg : "Unknown error" };
    }

    private static byte[] readAllBytes(InputStream is) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
        return baos.toByteArray();
    }

    private static void writeTextPart(
            DataOutputStream out, String boundary,
            String name, String value) throws IOException {
        out.writeBytes("--" + boundary + "\r\n");
        out.writeBytes("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n");
        out.write(value.getBytes(StandardCharsets.UTF_8));
        out.writeBytes("\r\n");
    }

    private static void writeFilePart(
            DataOutputStream out, String boundary,
            String fieldName, String filename,
            String contentType, byte[] data) throws IOException {
        out.writeBytes("--" + boundary + "\r\n");
        out.writeBytes("Content-Disposition: form-data; name=\""
                + fieldName + "\"; filename=\"" + filename + "\"\r\n");
        out.writeBytes("Content-Type: " + contentType + "\r\n\r\n");
        out.write(data);
        out.writeBytes("\r\n");
    }
}
