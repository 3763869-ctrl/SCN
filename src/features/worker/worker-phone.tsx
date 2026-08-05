"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Bell,
  MessageSquare,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneOff,
  Play,
  Send,
  UserPlus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Call, Device } from "@twilio/voice-sdk";

import { Button } from "@/components/ui/button";
import { savePhoneContact, updateVoicemailWorkflow } from "@/features/worker/phone-actions";

type WorkerPhoneData = {
  settings: {
    extension: string | null;
    phone_enabled: boolean;
    calling_enabled: boolean;
    texting_enabled: boolean;
    voicemail_greeting: string | null;
  } | null;
  config: {
    voiceReady: boolean;
    messagingReady: boolean;
  };
  callLogs: Array<{
    id: string;
    direction: string;
    from_number: string | null;
    to_number: string | null;
    caller_name: string | null;
    status: string;
    duration_seconds: number | null;
    created_at: string;
  }>;
  threads: Array<{
    id: string;
    contact_number: string;
    contact_name: string | null;
    last_message_at: string;
  }>;
  messages: Array<{
    id: string;
    thread_id: string;
    direction: string;
    from_number: string;
    to_number: string;
    body: string;
    status: string;
    created_at: string;
  }>;
  contacts: Array<{
    id: string;
    display_name: string | null;
    phone_number: string;
    notes: string | null;
    created_at: string;
  }>;
  voicemails: Array<{
    id: string;
    assigned_worker_id: string | null;
    completed_at: string | null;
    completed_by: string | null;
    from_number: string | null;
    recording_url: string | null;
    duration_seconds: number | null;
    transcription: string | null;
    status: string;
    created_at: string;
  }>;
  workers: Array<{
    id: string;
    full_name: string | null;
    email: string;
  }>;
};

type WorkerPhoneProps = {
  data: WorkerPhoneData;
  visible?: boolean;
};

type MergedParticipant = {
  callSid: string;
  muted: boolean;
  phoneNumber: string;
};

function getDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizePhoneNumber(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await registration.update().catch(() => undefined);

  return registration;
}

function getInitialNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

export function WorkerPhone({ data, visible = true }: WorkerPhoneProps) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [mergePhoneNumber, setMergePhoneNumber] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState(data.threads[0]?.id ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [activeConferenceName, setActiveConferenceName] = useState<string | null>(null);
  const [mergedParticipants, setMergedParticipants] = useState<MergedParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(getInitialNotificationPermission);
  const [savingVoicemailId, setSavingVoicemailId] = useState<string | null>(null);
  const [voicemailOverrides, setVoicemailOverrides] = useState<
    Record<string, { assignedWorkerId: string | null; completed: boolean }>
  >({});
  const [isPending, startTransition] = useTransition();
  const deviceRef = useRef<Device | null>(null);
  const phoneNumberInputRef = useRef<HTMLInputElement | null>(null);
  const ringAudioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<number | null>(null);
  const browserNotificationRef = useRef<Notification | null>(null);
  const activeCallNumber =
    activeCall?.parameters.To || activeCall?.parameters.From || phoneNumber.trim();
  const selectedThread = data.threads.find((thread) => thread.id === selectedThreadId);
  const selectedMessages = useMemo(
    () => data.messages.filter((message) => message.thread_id === selectedThreadId),
    [data.messages, selectedThreadId],
  );
  const contactsByPhone = useMemo(() => {
    const contacts = new Map<string, { display_name: string | null; phone_number: string }>();

    data.contacts.forEach((contact) => {
      const normalized = normalizePhoneNumber(contact.phone_number);

      if (normalized) {
        contacts.set(normalized, contact);
      }
    });

    return contacts;
  }, [data.contacts]);
  const phoneEnabled = Boolean(data.settings?.phone_enabled);
  const canCall = Boolean(phoneEnabled && data.settings?.calling_enabled && data.config.voiceReady);
  const canText = Boolean(phoneEnabled && data.settings?.texting_enabled && data.config.messagingReady);

  const stopRinging = useCallback(() => {
    if (ringIntervalRef.current) {
      window.clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }

    void ringAudioContextRef.current?.close();
    ringAudioContextRef.current = null;
    browserNotificationRef.current?.close();
    browserNotificationRef.current = null;

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then((registration) => registration.getNotifications({ tag: "rm-support-incoming-call" }))
        .then((notifications) => {
          notifications.forEach((notification) => notification.close());
        })
        .catch(() => undefined);
    }
  }, []);

  const resetActiveCallState = useCallback(() => {
    setActiveCall(null);
    setActiveConferenceName(null);
    setMergePhoneNumber("");
    setMergedParticipants([]);
    setIsMuted(false);
    setIsOnHold(false);
  }, []);

  const answerIncomingCall = useCallback((call: Call) => {
    call.accept();
    stopRinging();
    setIsMuted(false);
    setIsOnHold(false);
    setActiveCall(call);
    setIncomingCall(null);
    call.on("disconnect", resetActiveCallState);
    call.on("cancel", resetActiveCallState);
    call.on("reject", resetActiveCallState);
  }, [resetActiveCallState, stopRinging]);

  const denyIncomingCall = useCallback((call: Call) => {
    call.reject();
    stopRinging();
    setIncomingCall(null);
  }, [stopRinging]);

  const fetchVoiceToken = useCallback(async () => {
    const tokenResponse = await fetch("/api/phone/token", { cache: "no-store" });

    if (!tokenResponse.ok) {
      const error = (await tokenResponse.json().catch(() => null)) as { error?: string } | null;

      throw new Error(error?.error ?? "Phone calling is not ready.");
    }

    return ((await tokenResponse.json()) as { token: string }).token;
  }, []);

  const refreshDeviceToken = useCallback(async () => {
    if (!deviceRef.current) {
      return false;
    }

    const token = await fetchVoiceToken();
    deviceRef.current.updateToken(token);

    return true;
  }, [fetchVoiceToken]);

  const reconnectPhone = useCallback(async () => {
    if (!deviceRef.current) {
      setStatusMessage("Phone is still starting. Try again in a moment.");
      return false;
    }

    try {
      setStatusMessage("Reconnecting phone...");
      await refreshDeviceToken();
      await deviceRef.current.register();
      setDeviceReady(true);
      setStatusMessage("Phone is ready for calls.");
      return true;
    } catch (error) {
      setDeviceReady(false);
      setStatusMessage(error instanceof Error ? error.message : "Phone could not reconnect.");
      return false;
    }
  }, [refreshDeviceToken]);

  function playRingTone() {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    const audioContext = ringAudioContextRef.current ?? new AudioContextConstructor();
    ringAudioContextRef.current = audioContext;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.65);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.7);
  }

  async function requestChromeCallAlerts() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setStatusMessage("Chrome notifications are not supported in this browser.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      await ensureServiceWorker().catch(() => null);
      setStatusMessage("Chrome call alerts are enabled.");
    } else {
      setStatusMessage("Chrome call alerts are not enabled.");
    }
  }

  const showChromeCallNotification = useCallback(async (call: Call) => {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const caller = call.parameters.From || "Unknown caller";
    const notificationOptions = {
      actions: [
        { action: "answer-call", title: "Answer" },
        { action: "deny-call", title: "Deny" },
      ],
      body: `${caller} is calling RM Support. Click to answer in the worker workspace.`,
      data: { type: "incoming-call", url: window.location.href },
      icon: "/window.svg",
      requireInteraction: true,
      tag: "rm-support-incoming-call",
    };

    try {
      const registration = await ensureServiceWorker();

      if (registration?.showNotification) {
        await registration.showNotification("Incoming RM Support Call", notificationOptions);
        return;
      }
    } catch {
      // Fall back to the page notification API below.
    }

    browserNotificationRef.current?.close();
    const notification = new Notification("Incoming RM Support Call", notificationOptions);
    browserNotificationRef.current = notification;
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }, []);

  function getPhoneErrorMessage(error: { code?: number; message?: string }) {
    if (error.code === 31000) {
      return "Twilio rejected the call setup. Check the Twilio Auth Token, TwiML App, phone number, and webhooks in Settings.";
    }

    return error.message || "Phone connection error.";
  }

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    function handleServiceWorkerMessage(event: MessageEvent) {
      const message = event.data as { action?: string; type?: string } | undefined;

      if (message?.type !== "incoming-call-action" || !incomingCall) {
        return;
      }

      if (message.action === "answer-call") {
        answerIncomingCall(incomingCall);
      }

      if (message.action === "deny-call") {
        denyIncomingCall(incomingCall);
      }
    }

    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [answerIncomingCall, denyIncomingCall, incomingCall]);

  useEffect(() => {
    let mounted = true;

    async function setupVoiceDevice() {
      if (!canCall || deviceRef.current) {
        return;
      }

      try {
        setStatusMessage("Connecting phone...");
        const [{ Device: VoiceDevice }, tokenResponse] = await Promise.all([
          import("@twilio/voice-sdk"),
          fetchVoiceToken(),
        ]);

        const device = new VoiceDevice(tokenResponse, {
          closeProtection: true,
        });

        device.on("registered", () => {
          if (mounted) {
            setDeviceReady(true);
            setStatusMessage("Phone is ready for calls.");
          }
        });
        device.on("unregistered", () => {
          if (mounted) {
            setDeviceReady(false);
            setStatusMessage("Phone disconnected. Reconnecting...");
            window.setTimeout(() => {
              void reconnectPhone();
            }, 800);
          }
        });
        device.on("tokenWillExpire", () => {
          void refreshDeviceToken().catch((error) => {
            setStatusMessage(
              error instanceof Error ? error.message : "Phone token could not refresh.",
            );
          });
        });
        device.on("incoming", (call) => {
          setIncomingCall(call);
          setStatusMessage("Incoming call.");
          void showChromeCallNotification(call);
          call.on("cancel", () => setIncomingCall(null));
          call.on("disconnect", () => setIncomingCall(null));
          call.on("reject", () => setIncomingCall(null));
        });
        device.on("error", (error) => {
          if (error.code === 20104 || error.code === 20101 || error.code === 31205) {
            void reconnectPhone();
          }

          setStatusMessage(getPhoneErrorMessage(error));
        });
        await device.register();
        deviceRef.current = device;
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : "Could not start the phone.",
        );
      }
    }

    setupVoiceDevice();

    return () => {
      mounted = false;
      deviceRef.current?.destroy();
      deviceRef.current = null;
      stopRinging();
    };
  }, [canCall, fetchVoiceToken, reconnectPhone, refreshDeviceToken, showChromeCallNotification, stopRinging]);

  useEffect(() => {
    if (!incomingCall) {
      stopRinging();
      return;
    }

    playRingTone();
    ringIntervalRef.current = window.setInterval(playRingTone, 2000);

    return stopRinging;
  }, [incomingCall, stopRinging]);

  function makeCall() {
    startTransition(async () => {
      setStatusMessage(null);
      const numberToCall = phoneNumberInputRef.current?.value.trim() || phoneNumber.trim();

      if (!numberToCall) {
        setStatusMessage("Enter a number before calling.");
        return;
      }

      if (!deviceRef.current || !deviceReady) {
        const reconnected = await reconnectPhone();

        if (!reconnected || !deviceRef.current) {
          return;
        }
      }

      const logResponse = await fetch("/api/phone/calls/outbound", {
        body: JSON.stringify({ to: numberToCall }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!logResponse.ok) {
        const error = (await logResponse.json().catch(() => null)) as { error?: string } | null;
        setStatusMessage(error?.error ?? "Call could not be started.");
        return;
      }

      const callSetup = (await logResponse.json().catch(() => null)) as {
        conferenceName?: string;
        to?: string;
      } | null;

      let call: Call;

      try {
        call = await deviceRef.current.connect({
          params: {
            ConferenceName: callSetup?.conferenceName ?? "",
            To: numberToCall,
          },
        });
      } catch (error) {
        setStatusMessage(
          getPhoneErrorMessage(error instanceof Error ? error : { message: "Call failed." }),
        );
        return;
      }

      setActiveCall(call);
      setActiveConferenceName(callSetup?.conferenceName ?? null);
      setIsMuted(false);
      setIsOnHold(false);
      call.on("disconnect", resetActiveCallState);
      call.on("cancel", resetActiveCallState);
      call.on("error", (error) => setStatusMessage(getPhoneErrorMessage(error)));
      call.on("reject", resetActiveCallState);
    });
  }

  function toggleMute() {
    if (!activeCall) {
      return;
    }

    const nextMuted = !isMuted;

    activeCall.mute(nextMuted);
    setIsMuted(nextMuted);

    if (!nextMuted) {
      setIsOnHold(false);
    }
  }

  function toggleHold() {
    if (!activeCall) {
      return;
    }

    const nextOnHold = !isOnHold;

    activeCall.mute(nextOnHold);
    setIsOnHold(nextOnHold);
    setIsMuted(nextOnHold);
    setStatusMessage(
      nextOnHold
        ? "Call is on hold. Your microphone is muted."
        : "Call resumed. Your microphone is live.",
    );
  }

  function addCallToConference() {
    startTransition(async () => {
      const numberToAdd = mergePhoneNumber.trim();

      if (!activeCall || !activeConferenceName) {
        setStatusMessage("Start a call before adding another person.");
        return;
      }

      if (!numberToAdd) {
        setStatusMessage("Enter a number to add.");
        return;
      }

      const response = await fetch("/api/phone/calls/add-participant", {
        body: JSON.stringify({
          conferenceName: activeConferenceName,
          to: numberToAdd,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatusMessage(error?.error ?? "Could not add this call.");
        return;
      }

      const result = (await response.json().catch(() => null)) as {
        callSid?: string;
        to?: string;
      } | null;

      if (result?.callSid && result.to) {
        setMergedParticipants((current) => [
          ...current,
          { callSid: result.callSid ?? "", muted: false, phoneNumber: result.to ?? numberToAdd },
        ]);
      }

      setStatusMessage("Call added.");
      setMergePhoneNumber("");
    });
  }

  function setParticipantMuted(participant: MergedParticipant, muted: boolean) {
    startTransition(async () => {
      if (!activeConferenceName) {
        setStatusMessage("The merged call is not active.");
        return;
      }

      const response = await fetch("/api/phone/calls/mute-participant", {
        body: JSON.stringify({
          callSid: participant.callSid,
          conferenceName: activeConferenceName,
          muted,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatusMessage(error?.error ?? "Could not update caller mute.");
        return;
      }

      setMergedParticipants((current) =>
        current.map((currentParticipant) =>
          currentParticipant.callSid === participant.callSid
            ? { ...currentParticipant, muted }
            : currentParticipant,
        ),
      );
      setStatusMessage(muted ? "Caller was force muted." : "Caller was unmuted.");
    });
  }

  function saveContactFromForm(formData: FormData) {
    startTransition(async () => {
      const result = await savePhoneContact(formData);

      setStatusMessage(result.message);

      if (result.success) {
        router.refresh();
      }
    });
  }

  function sendMessage() {
    const to = selectedThread?.contact_number || phoneNumber;

    startTransition(async () => {
      if (!to.trim() || !messageBody.trim()) {
        setStatusMessage("Enter a number and message.");
        return;
      }

      const response = await fetch("/api/phone/messages/send", {
        body: JSON.stringify({ body: messageBody, to }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatusMessage(error?.error ?? "Text message could not be sent.");
        return;
      }

      setMessageBody("");
      setStatusMessage("Text message sent.");
    });
  }

  function saveVoicemailWorkflow({
    assignedWorkerId,
    completed,
    voicemailId,
  }: {
    assignedWorkerId: string | null;
    completed: boolean;
    voicemailId: string;
  }) {
    const formData = new FormData();

    formData.set("voicemail_id", voicemailId);

    if (assignedWorkerId) {
      formData.set("assigned_worker_id", assignedWorkerId);
    }

    if (completed) {
      formData.set("completed", "on");
    }

    setSavingVoicemailId(voicemailId);
    setVoicemailOverrides((current) => ({
      ...current,
      [voicemailId]: { assignedWorkerId, completed },
    }));

    startTransition(async () => {
      const result = await updateVoicemailWorkflow(formData);

      setStatusMessage(result.message);
      setSavingVoicemailId(null);
      router.refresh();
    });
  }

  return (
    <section className={visible ? "space-y-4" : "contents"}>
      {incomingCall ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/75 px-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-2xl">
            <Bell className="mx-auto h-10 w-10 text-accent" />
            <h2 className="mt-4 text-xl font-semibold">Incoming Call</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {incomingCall.parameters.From || "Unknown caller"}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                onClick={() => {
                  answerIncomingCall(incomingCall);
                }}
              >
                Answer
              </Button>
              <Button
                onClick={() => {
                  denyIncomingCall(incomingCall);
                }}
                variant="danger"
              >
                Decline
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {visible ? (
        <>
      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">RM Support Phone</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Extension {data.settings?.extension || "not assigned"} -{" "}
              {phoneEnabled ? "Enabled" : "Disabled by admin"}
            </p>
          </div>
          <span className="rounded-md border border-border px-3 py-2 text-sm font-semibold">
            {deviceReady ? "Ready for calls" : "Phone standby"}
          </span>
        </div>
        {statusMessage ? (
          <p className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            {statusMessage}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h3 className="text-base font-semibold">Dialer</h3>
            <input
              className="mt-4 h-12 w-full rounded-md border border-border bg-background px-3 text-lg font-semibold"
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+1 555 555 5555"
              ref={phoneNumberInputRef}
              type="tel"
              value={phoneNumber}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button disabled={!canCall || !deviceReady || isPending || Boolean(activeCall)} onClick={makeCall}>
                <Phone className="h-4 w-4" />
                {canCall && !deviceReady ? "Connecting..." : "Call"}
              </Button>
              <Button
                disabled={!activeCall}
                onClick={() => {
                  activeCall?.disconnect();
                  resetActiveCallState();
                }}
                variant="danger"
              >
                <PhoneOff className="h-4 w-4" />
                Hang Up
              </Button>
            </div>
            {activeCall ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={toggleMute} type="button" variant="secondary">
                  {isMuted ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  {isMuted ? "Unmute" : "Mute"}
                </Button>
                <Button onClick={toggleHold} type="button" variant="secondary">
                  {isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {isOnHold ? "Resume" : "Hold"}
                </Button>
              </div>
            ) : null}
            {activeCall ? (
              <div className="mt-3 rounded-md border border-border bg-background p-3">
                <label className="text-xs font-semibold text-muted-foreground">
                  Add Call
                  <input
                    className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                    onChange={(event) => setMergePhoneNumber(event.target.value)}
                    placeholder="+1 555 555 5555"
                    type="tel"
                    value={mergePhoneNumber}
                  />
                </label>
                <Button
                  className="mt-2 w-full"
                  disabled={!activeConferenceName || isPending}
                  onClick={addCallToConference}
                  type="button"
                  variant="secondary"
                >
                  Add & Merge
                </Button>
                {mergedParticipants.length ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Merged Callers
                    </p>
                    {mergedParticipants.map((participant) => (
                      <div
                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2"
                        key={participant.callSid}
                      >
                        <div>
                          <p className="text-sm font-semibold">{participant.phoneNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {participant.muted ? "Force muted" : "Can speak"}
                          </p>
                        </div>
                        <Button
                          disabled={isPending}
                          onClick={() => setParticipantMuted(participant, !participant.muted)}
                          type="button"
                          variant={participant.muted ? "secondary" : "danger"}
                        >
                          {participant.muted ? (
                            <Volume2 className="h-4 w-4" />
                          ) : (
                            <VolumeX className="h-4 w-4" />
                          )}
                          {participant.muted ? "Unmute" : "Force Mute"}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {activeCall ? (
              <p className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground">
                Active call: {activeCallNumber || "Unknown number"}
                {isOnHold ? " - On hold" : isMuted ? " - Muted" : ""}
              </p>
            ) : null}
            {!deviceReady && canCall ? (
              <Button
                className="mt-3 w-full"
                disabled={isPending}
                onClick={() => {
                  void reconnectPhone();
                }}
                type="button"
                variant="secondary"
              >
                Reconnect Phone
              </Button>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Browser calls require microphone permission in Chrome.
            </p>
            <div className="mt-3 rounded-md border border-border bg-background p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Chrome Call Alerts</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {notificationPermission === "granted"
                      ? "Enabled. Incoming calls can show real Chrome notifications."
                      : notificationPermission === "denied"
                        ? "Blocked in Chrome. Allow notifications in site settings to use this."
                        : notificationPermission === "default"
                          ? "Enable this so calls alert you outside the RM Support page."
                          : "Not supported in this browser."}
                  </p>
                </div>
                {notificationPermission === "default" ? (
                  <Button onClick={requestChromeCallAlerts} type="button" variant="secondary">
                    <Bell className="h-4 w-4" />
                    Enable Alerts
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h3 className="text-base font-semibold">Contacts</h3>
            <form action={saveContactFromForm} className="mt-3 grid gap-2">
              <input
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                name="display_name"
                placeholder="Contact name"
              />
              <input
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                defaultValue={activeCallNumber || phoneNumber}
                name="phone_number"
                placeholder="+1 555 555 5555"
                required
                type="tel"
              />
              <input
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                name="notes"
                placeholder="Notes"
              />
              <Button disabled={isPending} type="submit" variant="secondary">
                <UserPlus className="h-4 w-4" />
                Add Contact
              </Button>
            </form>
            <div className="mt-4 space-y-2">
              {data.contacts.map((contact) => (
                <button
                  className="w-full rounded-md border border-border bg-background p-3 text-left text-sm transition hover:bg-surface-muted"
                  key={contact.id}
                  onClick={() => setPhoneNumber(contact.phone_number)}
                  type="button"
                >
                  <span className="block font-semibold">
                    {contact.display_name || contact.phone_number}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {contact.phone_number}
                    {contact.notes ? ` - ${contact.notes}` : ""}
                  </span>
                </button>
              ))}
              {!data.contacts.length ? (
                <p className="text-sm text-muted-foreground">
                  No saved contacts yet.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h3 className="text-base font-semibold">Call History</h3>
            <div className="mt-3 space-y-2">
              {data.callLogs.map((call) => (
                <div className="rounded-md border border-border bg-background p-3 text-sm" key={call.id}>
                  <p className="font-semibold">
                    {call.direction === "inbound" ? "Incoming" : "Outgoing"} - {call.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {call.direction === "inbound" ? call.from_number : call.to_number}
                    {" - "}
                    {getDateTimeLabel(call.created_at)}
                  </p>
                </div>
              ))}
              {!data.callLogs.length ? (
                <p className="text-sm text-muted-foreground">No call history yet.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Text Messages</h3>
              <MessageSquare className="h-5 w-5 text-accent" />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                {data.threads.map((thread) => (
                  <button
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      thread.id === selectedThreadId
                        ? "border-accent bg-surface-muted"
                        : "border-border bg-background"
                    }`}
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    type="button"
                  >
                    <span className="block font-semibold">
                      {thread.contact_name || thread.contact_number}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {getDateTimeLabel(thread.last_message_at)}
                    </span>
                  </button>
                ))}
                {!data.threads.length ? (
                  <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                    No text history yet.
                  </p>
                ) : null}
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {selectedMessages.map((message) => (
                    <div
                      className={`rounded-md px-3 py-2 text-sm ${
                        message.direction === "outbound"
                          ? "ml-auto bg-accent text-accent-foreground"
                          : "mr-auto bg-surface-muted"
                      } max-w-[85%]`}
                      key={message.id}
                    >
                      <p>{message.body}</p>
                      <p className="mt-1 text-[11px] opacity-75">
                        {getDateTimeLabel(message.created_at)}
                      </p>
                    </div>
                  ))}
                  {!selectedMessages.length ? (
                    <p className="text-sm text-muted-foreground">
                      Pick a thread or enter a number in the dialer to start texting.
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm"
                    onChange={(event) => setMessageBody(event.target.value)}
                    placeholder="Text message"
                    value={messageBody}
                  />
                  <Button disabled={!canText || isPending} onClick={sendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Voicemail</h3>
              <Mic className="h-5 w-5 text-accent" />
            </div>
            <div className="mt-3 space-y-2">
              {data.voicemails.map((voicemail) => (
                <div className="rounded-md border border-border bg-background p-3 text-sm" key={voicemail.id}>
                  {(() => {
                    const override = voicemailOverrides[voicemail.id];
                    const assignedWorkerId =
                      override?.assignedWorkerId ?? voicemail.assigned_worker_id ?? "";
                    const completed = override?.completed ?? Boolean(voicemail.completed_at);
                    const callerContact = contactsByPhone.get(
                      normalizePhoneNumber(voicemail.from_number),
                    );

                    return (
                      <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{callerContact?.display_name || "Unknown caller"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        From: {voicemail.from_number || "Unknown phone number"}
                      </p>
                      {completed ? (
                        <p className="mt-1 text-xs font-semibold text-accent">
                          Done
                        </p>
                      ) : (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Needs follow-up
                        </p>
                      )}
                    </div>
                    {savingVoicemailId === voicemail.id ? (
                      <span className="text-xs font-semibold text-muted-foreground">
                        Saving...
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getDateTimeLabel(voicemail.created_at)}
                    {voicemail.duration_seconds ? ` - ${voicemail.duration_seconds}s` : ""}
                  </p>
                  {voicemail.recording_url ? (
                    <audio
                      className="mt-3 w-full"
                      controls
                      preload="none"
                      src={`/api/phone/voicemails/${voicemail.id}/recording`}
                    >
                      <a href={`/api/phone/voicemails/${voicemail.id}/recording`}>
                        Play recording
                      </a>
                    </audio>
                  ) : null}
                  <div className="mt-3 grid gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Assigned Worker
                      <select
                        className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                        disabled={savingVoicemailId === voicemail.id}
                        onChange={(event) =>
                          saveVoicemailWorkflow({
                            assignedWorkerId: event.target.value || null,
                            completed,
                            voicemailId: voicemail.id,
                          })
                        }
                        value={assignedWorkerId}
                        name="assigned_worker_id"
                      >
                        <option value="">Not assigned</option>
                        {data.workers.map((worker) => (
                          <option key={worker.id} value={worker.id}>
                            {worker.full_name || worker.email}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold">
                      <input
                        className="h-4 w-4 accent-accent"
                        checked={completed}
                        disabled={savingVoicemailId === voicemail.id}
                        name="completed"
                        onChange={(event) =>
                          saveVoicemailWorkflow({
                            assignedWorkerId: assignedWorkerId || null,
                            completed: event.target.checked,
                            voicemailId: voicemail.id,
                          })
                        }
                        type="checkbox"
                      />
                      Done
                    </label>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
              {!data.voicemails.length ? (
                <p className="text-sm text-muted-foreground">No voicemails yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
        </>
      ) : null}
    </section>
  );
}
