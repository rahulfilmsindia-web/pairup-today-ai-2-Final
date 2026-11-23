package com.pairuptoday.app;

import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * High-Priority FCM Wakeup Service for PairUpToday (Rapido Captain Style)
 * Intercepts high-priority data messages even when app is killed or minimized.
 * Launches Floating Overlay (if SYSTEM_ALERT_WINDOW granted) or Full-Screen Intent over Lock Screen.
 */
public class PairUpFirebaseMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "pairuptoday_incoming_booking_channel";
    private static Ringtone ringtoneInstance;
    private static Vibrator vibratorInstance;

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        if (data == null || data.isEmpty()) return;

        String type = data.get("type");
        if ("INCOMING_BOOKING".equals(type)) {
            handleIncomingBooking(data);
        }
    }

    private void handleIncomingBooking(Map<String, String> data) {
        String bookingId = data.get("booking_id");
        String amountRupees = data.get("amount_rupees");
        String clientName = data.get("client_name");
        String clientLocation = data.get("client_location");
        String distanceKm = data.get("distance_km");
        String scheduledTime = data.get("scheduled_time");
        String selectedServices = data.get("selected_services");

        // 1. Play continuous loud alarm ringtone + vibration
        startLoudAlarmAndVibration();

        // 2. Check if screen is locked or if app has overlay permission
        KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        boolean isLocked = keyguardManager != null && keyguardManager.isKeyguardLocked();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this) && !isLocked) {
            // Draw floating overlay window directly over current app (YouTube, Facebook, Call)
            Intent overlayIntent = new Intent(this, BookingOverlayService.class);
            overlayIntent.putExtra("booking_id", bookingId);
            overlayIntent.putExtra("amount_rupees", amountRupees);
            overlayIntent.putExtra("client_name", clientName);
            overlayIntent.putExtra("client_location", clientLocation);
            overlayIntent.putExtra("distance_km", distanceKm);
            overlayIntent.putExtra("scheduled_time", scheduledTime);
            overlayIntent.putExtra("selected_services", selectedServices);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(overlayIntent);
            } else {
                startService(overlayIntent);
            }
        } else {
            // Screen is locked or overlay permission pending: Launch Full-Screen Intent over Lock Screen
            launchFullScreenBookingIntent(data);
        }
    }

    private void launchFullScreenBookingIntent(Map<String, String> data) {
        createNotificationChannel();

        Intent fullScreenIntent = new Intent(this, IncomingBookingActivity.class);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        for (Map.Entry<String, String> entry : data.entrySet()) {
            fullScreenIntent.putExtra(entry.getKey(), entry.getValue());
        }

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this,
                (int) System.currentTimeMillis(),
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("🚨 New Booking Request: ₹" + data.get("amount_rupees"))
                .setContentText("Client: " + data.get("client_name") + " (" + data.get("distance_km") + " km away)")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setAutoCancel(true)
                .setOngoing(true)
                .build();

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(1099, notification);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "PairUpToday Incoming Booking Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("High-priority full-screen incoming booking requests");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private synchronized void startLoudAlarmAndVibration() {
        try {
            Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (alertUri == null) alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);

            if (ringtoneInstance == null) {
                ringtoneInstance = RingtoneManager.getRingtone(getApplicationContext(), alertUri);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    ringtoneInstance.setAudioAttributes(
                            new AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_ALARM)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                    .build()
                    );
                }
            }
            if (!ringtoneInstance.isPlaying()) {
                ringtoneInstance.play();
            }

            if (vibratorInstance == null) {
                vibratorInstance = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibratorInstance != null && vibratorInstance.hasVibrator()) {
                long[] pattern = {0, 600, 200, 600, 200, 600};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibratorInstance.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibratorInstance.vibrate(pattern, 0);
                }
            }
        } catch (Exception ignored) {}
    }

    public static synchronized void stopAlarmAndVibration() {
        try {
            if (ringtoneInstance != null && ringtoneInstance.isPlaying()) {
                ringtoneInstance.stop();
            }
            if (vibratorInstance != null) {
                vibratorInstance.cancel();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        // Token will be synced to Supabase companion_profiles on next login/app open
    }
}
