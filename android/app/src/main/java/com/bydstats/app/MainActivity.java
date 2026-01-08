package com.bydstats.app;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;


public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {


    private void configureStatusBar() {
        Window window = getWindow();

        // Detect if system is in dark mode
        int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        boolean isDarkMode = nightModeFlags == Configuration.UI_MODE_NIGHT_YES;

        // Enable edge-to-edge display
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            // Set background color matching the theme
            window.setStatusBarColor(isDarkMode ? 0xFF0F172A : 0xFFF8FAFC);
        }

        // CRITICAL: Use WindowInsetsControllerCompat for consistent behavior
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
        if (insetsController != null) {
            // isDarkMode == true -> appearanceLightStatusBars(false) -> White icons
            // isDarkMode == false -> appearanceLightStatusBars(true) -> Dark icons
            insetsController.setAppearanceLightStatusBars(!isDarkMode);
        }

        // Additional approach for Android M to Q (API 23-29)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            View decorView = window.getDecorView();
            int flags = decorView.getSystemUiVisibility();
            if (isDarkMode) {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; // White icons
            } else {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; // Dark icons
            }
            decorView.setSystemUiVisibility(flags);
        }

        // Modern approach for Android R+ (API 30+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.getInsetsController().setSystemBarsAppearance(
                isDarkMode ? 0 : android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
            );
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable WebView debugging for troubleshooting
        WebView.setWebContentsDebuggingEnabled(true);

        // Configure status bar
        configureStatusBar();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-apply status bar configuration in case something overrode it
        configureStatusBar();
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}

