package com.xcelsama.anyfileviewer;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

@CapacitorPlugin(name = "FileHandler")
public class FileHandlerPlugin extends Plugin {

    // Mirrors lib/constants.js's MAX_BINARY_FILE_SIZE. Reading the whole file
    // into a byte[] and then Base64-encoding it roughly triples peak memory
    // use, so anything much bigger than this risks OOMing the WebView on a
    // low-end device before the JS-side size checks ever get a chance to run.
    private static final long MAX_FILE_SIZE_BYTES = 100L * 1024 * 1024; // 100 MB

    @PluginMethod
    public void getLaunchFile(PluginCall call) {
        JSObject data = extractFile(getActivity().getIntent());
        call.resolve(data != null ? data : new JSObject());
    }

    public void handleNewIntent(Intent intent) {
        JSObject data = extractFile(intent);
        if (data != null) {
            notifyListeners("fileOpened", data);
        }
    }

    private JSObject extractFile(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return null;
        Uri uri = intent.getData();
        if (uri == null) return null;

        String mimeType = getContext().getContentResolver().getType(uri);
        if (mimeType == null) mimeType = "application/octet-stream";

        String name = "file";
        long size = -1;
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIdx >= 0) name = cursor.getString(nameIdx);
                int sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) size = cursor.getLong(sizeIdx);
            }
        } catch (Exception ignored) {
        }

        if (size > MAX_FILE_SIZE_BYTES) {
            Log.w("FileHandlerPlugin", "Refusing to open \"" + name + "\" (" + size +
                " bytes) via intent — exceeds the " + MAX_FILE_SIZE_BYTES + " byte safety limit.");
            return null;
        }

        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) return null;
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }
            JSObject result = new JSObject();
            result.put("name", name);
            result.put("mimeType", mimeType);
            result.put("data", Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP));
            return result;
        } catch (Exception e) {
            return null;
        }
    }
}
