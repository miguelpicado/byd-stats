package com.bydstats.app.wear.complications

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.MonochromaticImage
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.bydstats.app.wear.R

class UnlockComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        return createComplicationData(type)
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        return createComplicationData(request.complicationType)
    }

    private fun createComplicationData(type: ComplicationType): ComplicationData? {
        // Intent to trigger the action
        val intent = Intent(this, ComplicationActionReceiver::class.java).apply {
            action = "com.bydstats.app.wear.ACTION_UNLOCK"
        }
        
        val pendingIntent = PendingIntent.getBroadcast(
            this, 0, intent, 
            PendingIntent.FLAG_UPDATE_CURRENT or (if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val icon = Icon.createWithResource(this, R.drawable.ic_unlock_white)

        return when (type) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(
                text = PlainComplicationText.Builder("").build(), // Empty text
                contentDescription = PlainComplicationText.Builder("Abrir coche").build()
            )
            .setMonochromaticImage(MonochromaticImage.Builder(icon).build())
            .setTapAction(pendingIntent)
            .build()
            
            ComplicationType.MONOCHROMATIC_IMAGE -> androidx.wear.watchface.complications.data.MonochromaticImageComplicationData.Builder(
                monochromaticImage = MonochromaticImage.Builder(icon).build(),
                contentDescription = PlainComplicationText.Builder("Abrir coche").build()
            )
            .setTapAction(pendingIntent)
            .build()

            else -> null
        }
    }
}
