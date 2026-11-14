import 'dotenv/config';
import { databaseAdapter, getDatabaseType } from '../services/database.ts';
import { cleanupExpiredLocations, isFirebaseConfigured } from '../services/firebase.ts';
import { sendToMultipleDevices } from '../services/fcm.ts';

async function deliverPendingPushNotifications(): Promise<void> {
  const claims = await databaseAdapter.claimNotificationPushes(undefined, 100);
  for (const claim of claims) {
    const notification = claim.notification;
    try {
      const data = Object.fromEntries(
        Object.entries(notification.data || {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      );
      if (!claim.deviceTokens.length) {
        await databaseAdapter.finishNotificationPush(notification.id, true);
        continue;
      }
      const result = await sendToMultipleDevices(claim.deviceTokens, {
        title: notification.title,
        body: notification.body || ''
      }, data);
      await Promise.all(result.invalidTokens.map((token: string) =>
        databaseAdapter.deleteDeviceToken(token, notification.user_id)
      ));
      await databaseAdapter.finishNotificationPush(
        notification.id,
        result.failure === 0,
        result.failure ? `${result.failure} device(s) rejected the push.` : undefined
      );
    } catch (error) {
      try {
        await databaseAdapter.finishNotificationPush(
          notification.id,
          false,
          error instanceof Error ? error.message : 'FCM delivery failed.'
        );
      } catch (finishError) {
        console.error(JSON.stringify({
          severity: 'ERROR',
          notificationId: notification.id,
          message: 'Could not persist notification delivery retry state.',
          error: finishError instanceof Error ? finishError.message : String(finishError)
        }));
      }
      console.error(JSON.stringify({
        severity: 'ERROR',
        notificationId: notification.id,
        message: 'FCM notification delivery failed.',
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }
}

async function runMaintenanceJob(): Promise<void> {
  if (getDatabaseType() !== 'supabase') throw new Error('Scheduled maintenance requires Supabase.');
  if (!isFirebaseConfigured()) throw new Error('Scheduled maintenance requires Firebase Realtime Database.');

  const jobName = 'maintenance';
  const idempotencyKey = new Date().toISOString().slice(0, 16);
  const claimed = await databaseAdapter.claimScheduledJobRun(jobName, idempotencyKey);
  if (!claimed) {
    console.info(JSON.stringify({ severity: 'INFO', jobName, idempotencyKey, duplicate: true }));
    return;
  }

  try {
    const maintenance = await databaseAdapter.runScheduledMaintenance();
    const removedLocations = await cleanupExpiredLocations();
    await deliverPendingPushNotifications();
    await databaseAdapter.finishScheduledJobRun(jobName, idempotencyKey);
    console.info(JSON.stringify({
      severity: 'INFO',
      jobName,
      idempotencyKey,
      maintenance,
      removedLocations
    }));
  } catch (error) {
    try {
      await databaseAdapter.finishScheduledJobRun(
        jobName,
        idempotencyKey,
        error instanceof Error ? error.message : 'Scheduled maintenance failed.'
      );
    } catch (finishError) {
      console.error(JSON.stringify({
        severity: 'ERROR',
        jobName,
        idempotencyKey,
        message: 'Could not persist scheduled-job failure state.',
        error: finishError instanceof Error ? finishError.message : String(finishError)
      }));
    }
    throw error;
  }
}

runMaintenanceJob().catch(error => {
  console.error(JSON.stringify({
    severity: 'ERROR',
    jobName: 'maintenance',
    message: error instanceof Error ? error.message : String(error)
  }));
  process.exitCode = 1;
});
