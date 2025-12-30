package com.bydstats.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable WebView debugging for troubleshooting
        WebView.setWebContentsDebuggingEnabled(true);

        // Configure status bar to be visible and styled
        Window window = getWindow();

        // Make status bar visible (don't draw behind it)
        WindowCompat.setDecorFitsSystemWindows(window, true);

        // Set status bar color to match app theme (dark blue)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(0xFF0F172A); // #0f172a
        }

        // Set status bar icons to light/white color (for dark background)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decorView = window.getDecorView();
            // Clear the light status bar flag to make icons white
            int flags = decorView.getSystemUiVisibility();
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; // Remove light flag = white icons
            decorView.setSystemUiVisibility(flags);
        }
    }
}
