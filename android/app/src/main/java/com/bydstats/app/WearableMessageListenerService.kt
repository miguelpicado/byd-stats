package com.bydstats.app

import android.util.Log
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

class WearableMessageListenerService : WearableListenerService() {

    override fun onMessageReceived(messageEvent: MessageEvent) {
        val path = messageEvent.path
        Log.d("WearableService", "Message received from wear device: $path")

        if (path == "/byd/action/unlock") {
            // TODO: In Phase 2 this only prints a log. 
            // Future integration with Capacitor/Firebase functions will happen here.
            Log.i("WearableService", "BYD Action triggered: UNLOCK")
        }
    }
}
