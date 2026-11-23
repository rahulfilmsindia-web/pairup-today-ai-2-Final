package com.pairuptoday.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.CountDownTimer;
import android.os.IBinder;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;

/**
 * Rapido Captain Floating Window Service (Display Over Other Apps)
 * Draws a high-priority incoming booking card over Facebook, YouTube, Phone Calls, etc.
 */
public class BookingOverlayService extends Service {

    private WindowManager windowManager;
    private View overlayView;
    private CountDownTimer timer;
    private String bookingId;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            bookingId = intent.getStringExtra("booking_id");
            String amount = intent.getStringExtra("amount_rupees");
            String client = intent.getStringExtra("client_name");
            String location = intent.getStringExtra("client_location");
            String distance = intent.getStringExtra("distance_km");
            showOverlay(amount, client, location, distance);
        }
        startForegroundNotification();
        return START_NOT_STICKY;
    }

    private void startForegroundNotification() {
        String channelId = "pairuptoday_overlay_service_channel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel chan = new NotificationChannel(
                    channelId,
                    "PairUpToday Overlay Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null) mgr.createNotificationChannel(chan);
        }

        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("PairUpToday Companion Online")
                .setContentText("Displaying incoming booking alert...")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        startForeground(2099, notification);
    }

    private void showOverlay(String amount, String client, String location, String distance) {
        if (overlayView != null) removeOverlay();

        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        LayoutInflater inflater = (LayoutInflater) getSystemService(Context.LAYOUT_INFLATER_SERVICE);

        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
                PixelFormat.TRANSLUCENT
        );

        params.gravity = Gravity.CENTER;

        try {
            overlayView = inflater.inflate(R.layout.overlay_incoming_booking, null);

            TextView tvAmount = overlayView.findViewById(R.id.overlay_amount);
            TextView tvClient = overlayView.findViewById(R.id.overlay_client_info);
            TextView tvLocation = overlayView.findViewById(R.id.overlay_location);
            TextView tvCountdown = overlayView.findViewById(R.id.overlay_countdown);
            Button btnAccept = overlayView.findViewById(R.id.overlay_btn_accept);
            Button btnDecline = overlayView.findViewById(R.id.overlay_btn_decline);

            if (tvAmount != null) tvAmount.setText("₹" + (amount != null ? amount : "0"));
            if (tvClient != null) tvClient.setText(client + " • " + distance + " km away");
            if (tvLocation != null) tvLocation.setText(location);

            // 30s Countdown
            timer = new CountDownTimer(30000, 1000) {
                @Override
                public void onTick(long millis) {
                    if (tvCountdown != null) tvCountdown.setText((millis / 1000) + "s");
                }

                @Override
                public void onFinish() {
                    dismiss();
                }
            }.start();

            if (btnAccept != null) {
                btnAccept.setOnClickListener(v -> {
                    dismiss();
                    Intent mainIntent = new Intent(this, MainActivity.class);
                    mainIntent.putExtra("action", "ACCEPT_BOOKING");
                    mainIntent.putExtra("booking_id", bookingId);
                    mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(mainIntent);
                });
            }

            if (btnDecline != null) {
                btnDecline.setOnClickListener(v -> dismiss());
            }

            windowManager.addView(overlayView, params);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void dismiss() {
        PairUpFirebaseMessagingService.stopAlarmAndVibration();
        if (timer != null) timer.cancel();
        removeOverlay();
        stopSelf();
    }

    private void removeOverlay() {
        if (windowManager != null && overlayView != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {}
            overlayView = null;
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        dismiss();
    }
}
