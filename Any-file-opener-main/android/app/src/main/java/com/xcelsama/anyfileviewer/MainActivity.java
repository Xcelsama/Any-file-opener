package com.xcelsama.anyfileviewer;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileHandlerPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Plugin plugin = getBridge().getPlugin("FileHandler").getInstance();
        if (plugin instanceof FileHandlerPlugin) {
            ((FileHandlerPlugin) plugin).handleNewIntent(intent);
        }
    }
}
