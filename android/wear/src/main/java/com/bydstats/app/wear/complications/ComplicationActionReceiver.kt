package com.bydstats.app.wear.complications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class ComplicationActionReceiver : BroadcastReceiver() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "com.bydstats.app.wear.ACTION_UNLOCK") {
            Log.i("WearComplication", "Unlock action triggered from complication")
            
            scope.launch {
                try {
                    sendMessageToPhone(context, "/byd/action/unlock")
                } catch (e: Exception) {
                    Log.e("WearComplication", "Error sending message from complication", e)
                }
            }
        }
    }

    private suspend fun sendMessageToPhone(context: Context, path: String) {
        val capabilityInfo = Wearable.getCapabilityClient(context)
            .getCapability("byd_stats_phone_app", com.google.android.gms.wearable.CapabilityClient.FILTER_REACHABLE)
            .await()
        
        val nodes = capabilityInfo.nodes
        if (nodes.isEmpty()) {
            // Fallback to connected nodes
            Wearable.getNodeClient(context).connectedNodes.await().forEach { node ->
                Wearable.getMessageClient(context).sendMessage(node.id, path, ByteArray(0))
            }
            return
        }

        for (node in nodes) {
            Wearable.getMessageClient(context).sendMessage(node.id, path, ByteArray(0))
        }
    }
}
