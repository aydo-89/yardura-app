#!/usr/bin/env python3
import os, time, json, requests, subprocess
from datetime import datetime

API_URL = os.environ.get("INGEST_URL")  # e.g., https://app.yardura.com/api/ingest
DEVICE_ID = os.environ.get("DEVICE_ID")
DEVICE_KEY = os.environ.get("DEVICE_KEY")
ORG_ID = os.environ.get("ORG_ID")
CUSTOMER_ID = os.environ.get("CUSTOMER_ID")
JOB_ID = os.environ.get("JOB_ID")


def capture_image(out="/tmp/sample.jpg"):
    # Use libcamera-still on Pi OS
    subprocess.run([
        "libcamera-still","-n","-o",out,"--width","1280","--height","960","--timeout","1"
    ], check=True)
    return out


def read_sensors():
    # Replace with real serial reads from Arduino/HX711/moisture sensor
    return {"weightG": 120.4, "moistureRaw": 612, "temperatureC": 21.7}


def post_sample(img_path, data):
    with open(img_path, "rb") as f:
        files = {"image": f}
        payload = {
            "deviceId": DEVICE_ID,
            "deviceKey": DEVICE_KEY,
            "orgId": ORG_ID,
            "customerId": CUSTOMER_ID,
            "jobId": JOB_ID,
            "capturedAt": datetime.utcnow().isoformat() + "Z",
            **data,
        }
        r = requests.post(API_URL, data=payload, files=files, timeout=20)
        print("Status", r.status_code, r.text)


if __name__ == "__main__":
    img = capture_image()
    sensors = read_sensors()
    post_sample(img, sensors)

