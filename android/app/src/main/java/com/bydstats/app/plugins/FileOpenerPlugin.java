package com.bydstats.app.plugins;

import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

@CapacitorPlugin(name = "FileOpener")
public class FileOpenerPlugin extends Plugin {

    @PluginMethod
    public void readFileFromUri(PluginCall call) {
        String uriString = call.getString("uri");

        if (uriString == null || uriString.isEmpty()) {
            call.reject("URI is required");
            return;
        }

        try {
            Uri uri = Uri.parse(uriString);
            ContentResolver contentResolver = getContext().getContentResolver();

            // Get file name
            String fileName = getFileName(uri, contentResolver);

            // Read file content
            InputStream inputStream = contentResolver.openInputStream(uri);
            if (inputStream == null) {
                call.reject("Could not open file");
                return;
            }

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            int nRead;
            byte[] data = new byte[16384];

            while ((nRead = inputStream.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, nRead);
            }

            inputStream.close();
            byte[] fileData = buffer.toByteArray();

            // Convert to base64
            String base64Data = Base64.encodeToString(fileData, Base64.DEFAULT);

            JSObject result = new JSObject();
            result.put("data", base64Data);
            result.put("fileName", fileName);
            result.put("mimeType", contentResolver.getType(uri));

            call.resolve(result);
        } catch (Exception e) {
            call.reject("Error reading file: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getSharedFile(PluginCall call) {
        Intent intent = getActivity().getIntent();
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_VIEW.equals(action) || Intent.ACTION_SEND.equals(action)) {
            Uri uri = null;

            if (Intent.ACTION_VIEW.equals(action)) {
                uri = intent.getData();
            } else if (Intent.ACTION_SEND.equals(action)) {
                uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            }

            if (uri != null) {
                JSObject result = new JSObject();
                result.put("uri", uri.toString());
                result.put("type", type);
                call.resolve(result);
                return;
            }
        }

        call.resolve(new JSObject());
    }

    private String getFileName(Uri uri, ContentResolver contentResolver) {
        String fileName = "unknown.db";

        if (uri.getScheme().equals("content")) {
            android.database.Cursor cursor = contentResolver.query(uri, null, null, null, null);
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        int nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                        if (nameIndex >= 0) {
                            fileName = cursor.getString(nameIndex);
                        }
                    }
                } finally {
                    cursor.close();
                }
            }
        } else if (uri.getScheme().equals("file")) {
            fileName = uri.getLastPathSegment();
        }

        return fileName;
    }
}
