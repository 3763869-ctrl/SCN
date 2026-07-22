self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  if (payload.type !== "presence-check" && payload.type !== "clock-paused") {
    return;
  }

  const isPausedNotification = payload.type === "clock-paused";

  event.waitUntil(
    self.registration.showNotification(payload.title || "RM Support check-in", {
      actions: [
        {
          action: isPausedNotification ? "resume-clock" : "still-here",
          title: isPausedNotification ? "Resume Clock" : "Yes, still here",
        },
      ],
      body:
        payload.body ||
        (isPausedNotification
          ? "Your clock is paused. Press Resume Clock when you are back."
          : "Press Yes within 1 minute or your clock will be paused."),
      data: {
        checkId: payload.checkId,
        url: payload.url || "/worker",
      },
      icon: "/window.svg",
      badge: "/window.svg",
      requireInteraction: true,
      tag: payload.checkId
        ? `${payload.type}-${payload.checkId}`
        : payload.type,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const checkId = event.notification.data?.checkId;
  const targetUrl = event.notification.data?.url || "/worker";

  if (event.action === "still-here" && checkId) {
    event.waitUntil(
      fetch("/api/worker/presence-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ checkId }),
      }).then(() => undefined),
    );
    return;
  }

  if (event.action === "resume-clock") {
    event.waitUntil(
      fetch("/api/worker/resume-clock", {
        method: "POST",
      }).then(() =>
        self.clients.matchAll({ type: "window" }).then((clientList) => {
          for (const client of clientList) {
            if ("focus" in client && client.url.includes(targetUrl)) {
              return client.focus();
            }
          }

          if (self.clients.openWindow) {
            return self.clients.openWindow(targetUrl);
          }

          return undefined;
        }),
      ),
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(targetUrl)) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
