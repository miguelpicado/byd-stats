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

        // FORCE white status bar icons (for dark background)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decorView = window.getDecorView();
            // Get current flags and ensure light status bar flag is NOT set
            int flags = decorView.getSystemUiVisibility();
            // Remove light status bar flag if present (this makes icons white)
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            // Apply the flags
            decorView.setSystemUiVisibility(flags);

            // Also use WindowInsetsController for Android 11+ (additional insurance)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.getInsetsController().setSystemBarsAppearance(0,
                    android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        }
    }
}
