package com.xcelsama.anyfileviewer;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

@CapacitorPlugin(name = "FileHandler")
public class FileHandlerPlugin extends Plugin {

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
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) name = cursor.getString(idx);
            }
        } catch (Exception ignored) {
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
