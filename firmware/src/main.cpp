#include <Arduino.h>
#include <EspUsbHost.h>

class MyEspUsbHost : public EspUsbHost {
public:
  void onConfig(const uint8_t bDescriptorType, const uint8_t *p) {
    if (bDescriptorType == USB_INTERFACE_DESC) {
      const usb_intf_desc_t *intf = (const usb_intf_desc_t *)p;
      Serial.printf("INTF: Class=%x Sub=%x Proto=%x\n", intf->bInterfaceClass,
                    intf->bInterfaceSubClass, intf->bInterfaceProtocol);

      if (intf->bInterfaceClass == 0x09) {
        Serial.println(">>> HUB DETECTED! <<<");
      } else if (intf->bInterfaceClass == 0x08) {
        Serial.println(">>> MASS STORAGE DEVICE DETECTED! <<<");
      }
    }
  }

  // Safe check to see if we have a valid handle
  bool isReady() { return (deviceHandle != NULL); }
};

MyEspUsbHost usbHost;
bool portsConfigsDone = false;
unsigned long lastAttemptTime = 0;

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("BYD Stats - Hub Power Logic (Smart Waiting)");
  usbHost.begin();
}

void loop() {
  usbHost.task();

  if (!portsConfigsDone && (millis() - lastAttemptTime > 2000)) {
    lastAttemptTime = millis();

    if (usbHost.isReady()) {
      Serial.println("Device Connected! Sending Port Power Command...");

      // Try Port 1
      esp_err_t err = usbHost.submitGenericControl(0x23, 0x03, 0x0008, 1, 0);

      if (err == ESP_OK) {
        Serial.println(">>> Port 1 Power ON command SENT! <<<");
        portsConfigsDone = true;
        // We could power others here too, but let's see if this one sticks
        // first.
        usbHost.submitGenericControl(0x23, 0x03, 0x0008, 2, 0);
        usbHost.submitGenericControl(0x23, 0x03, 0x0008, 3, 0);
        usbHost.submitGenericControl(0x23, 0x03, 0x0008, 4, 0);
      } else {
        Serial.printf("Command failed (Error 0x%x). Retrying...\n", err);
      }
    } else {
      // Only print occasionally to avoid spamming while waiting
      if (millis() % 4000 < 100)
        Serial.println("Waiting for Hub to be ready...");
    }
  }
}
