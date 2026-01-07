import { startPushNotificationWorker } from "@/lib/jobs/pushNotificationScheduler";

startPushNotificationWorker();

console.log("Push notification scheduler worker is running. Press Ctrl+C to exit.");
