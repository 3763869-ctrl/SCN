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
  const notificationType = event.notification.data?.type;

  function targetPathMatches(clientUrl) {
    try {
      const clientPath = new URL(clientUrl).pathname;
      const targetPath = new URL(targetUrl, self.location.origin).pathname;

      return clientPath === targetPath;
    } catch {
      return clientUrl.includes(targetUrl);
    }
  }

  function focusOrOpenTarget(message) {
    return self.clients
      .matchAll({ includeUncontrolled: true, type: "window" })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client && targetPathMatches(client.url)) {
            if (message && "postMessage" in client) {
              client.postMessage(message);
            }

            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl).then((client) => {
            if (client && message && "postMessage" in client) {
              client.postMessage(message);
            }

            return client;
          });
        }

        return undefined;
      });
  }

  if (notificationType === "incoming-call") {
    event.waitUntil(
      focusOrOpenTarget(
        event.action
          ? {
              action: event.action === "deny-call" ? "deny-call" : "answer-call",
              type: "incoming-call-action",
            }
          : undefined,
      ),
    );
    return;
  }

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
      }).then(() => focusOrOpenTarget()),
    );
    return;
  }

  event.waitUntil(focusOrOpenTarget());
});
