package com.bydstats.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable WebView debugging for troubleshooting
        WebView.setWebContentsDebuggingEnabled(true);
    }
}
