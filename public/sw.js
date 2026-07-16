self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  if (payload.type !== "presence-check") {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "SCN check-in", {
      actions: [
        {
          action: "still-here",
          title: "Yes, still here",
        },
      ],
      body:
        payload.body ||
        "Press Yes within 1 minute or you will be clocked out.",
      data: {
        checkId: payload.checkId,
        url: payload.url || "/worker",
      },
      icon: "/window.svg",
      badge: "/window.svg",
      requireInteraction: true,
      tag: payload.checkId ? `presence-${payload.checkId}` : "presence-check",
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
