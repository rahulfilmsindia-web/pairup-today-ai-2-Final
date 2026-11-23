package com.pairuptoday.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

/**
 * Rapido Captain-Style Full Screen Activity
 * Displays over Lock Screen and wakes up display automatically
 */
public class IncomingBookingActivity extends Activity {

    private CountDownTimer countDownTimer;
    private String bookingId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Turn on screen and show over keyguard/lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }

        Intent intent = getIntent();
        bookingId = intent.getStringExtra("booking_id");
        String amount = intent.getStringExtra("amount_rupees");
        String client = intent.getStringExtra("client_name");
        String location = intent.getStringExtra("client_location");
        String distance = intent.getStringExtra("distance_km");
        String time = intent.getStringExtra("scheduled_time");

        // Layout creation or view binding
        setContentView(R.layout.activity_incoming_booking);

        TextView tvAmount = findViewById(R.id.tv_booking_amount);
        TextView tvClient = findViewById(R.id.tv_client_info);
        TextView tvLocation = findViewById(R.id.tv_meeting_location);
        TextView tvTimer = findViewById(R.id.tv_countdown_timer);
        Button btnAccept = findViewById(R.id.btn_accept);
        Button btnDecline = findViewById(R.id.btn_decline);

        if (tvAmount != null) tvAmount.setText("₹" + (amount != null ? amount : "0"));
        if (tvClient != null) tvClient.setText(client + " • " + distance + " km away");
        if (tvLocation != null) tvLocation.setText(location + " (" + time + ")");

        // 30-Second Countdown Timer
        countDownTimer = new CountDownTimer(30000, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                if (tvTimer != null) {
                    tvTimer.setText(String.valueOf(millisUntilFinished / 1000) + "s");
                }
            }

            @Override
            public void onFinish() {
                handleDecline();
            }
        }.start();

        if (btnAccept != null) {
            btnAccept.setOnClickListener(v -> handleAccept());
        }
        if (btnDecline != null) {
            btnDecline.setOnClickListener(v -> handleDecline());
        }
    }

    private void handleAccept() {
        PairUpFirebaseMessagingService.stopAlarmAndVibration();
        if (countDownTimer != null) countDownTimer.cancel();

        // Launch MainActivity and navigate to Companion live session
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.putExtra("action", "ACCEPT_BOOKING");
        mainIntent.putExtra("booking_id", bookingId);
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(mainIntent);
        finish();
    }

    private void handleDecline() {
        PairUpFirebaseMessagingService.stopAlarmAndVibration();
        if (countDownTimer != null) countDownTimer.cancel();
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        PairUpFirebaseMessagingService.stopAlarmAndVibration();
        if (countDownTimer != null) countDownTimer.cancel();
    }
}
