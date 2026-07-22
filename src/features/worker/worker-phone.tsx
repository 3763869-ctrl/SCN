"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bell, MessageSquare, Mic, Phone, PhoneOff, Send } from "lucide-react";
import type { Call, Device } from "@twilio/voice-sdk";

import { Button } from "@/components/ui/button";

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
  voicemails: Array<{
    id: string;
    from_number: string | null;
    recording_url: string | null;
    duration_seconds: number | null;
    transcription: string | null;
    status: string;
    created_at: string;
  }>;
};

type WorkerPhoneProps = {
  data: WorkerPhoneData;
  visible?: boolean;
};

function getDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function WorkerPhone({ data, visible = true }: WorkerPhoneProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState(data.threads[0]?.id ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const deviceRef = useRef<Device | null>(null);
  const phoneNumberInputRef = useRef<HTMLInputElement | null>(null);
  const ringAudioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<number | null>(null);
  const selectedThread = data.threads.find((thread) => thread.id === selectedThreadId);
  const selectedMessages = useMemo(
    () => data.messages.filter((message) => message.thread_id === selectedThreadId),
    [data.messages, selectedThreadId],
  );
  const phoneEnabled = Boolean(data.settings?.phone_enabled);
  const canCall = Boolean(phoneEnabled && data.settings?.calling_enabled && data.config.voiceReady);
  const canText = Boolean(phoneEnabled && data.settings?.texting_enabled && data.config.messagingReady);

  function stopRinging() {
    if (ringIntervalRef.current) {
      window.clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }

    void ringAudioContextRef.current?.close();
    ringAudioContextRef.current = null;
  }

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

  function getPhoneErrorMessage(error: { code?: number; message?: string }) {
    if (error.code === 31000) {
      return "Twilio rejected the call setup. Check the Twilio Auth Token, TwiML App, phone number, and webhooks in Settings.";
    }

    return error.message || "Phone connection error.";
  }

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
          fetch("/api/phone/token"),
        ]);

        if (!tokenResponse.ok) {
          const error = (await tokenResponse.json().catch(() => null)) as { error?: string } | null;
          setStatusMessage(error?.error ?? "Phone calling is not ready.");
          return;
        }

        const tokenData = (await tokenResponse.json()) as { token: string };
        const device = new VoiceDevice(tokenData.token, {
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
            setStatusMessage("Phone disconnected. Refresh this page before calling.");
          }
        });
        device.on("incoming", (call) => {
          setIncomingCall(call);
          setStatusMessage("Incoming call.");
          call.on("cancel", () => setIncomingCall(null));
          call.on("disconnect", () => setIncomingCall(null));
          call.on("reject", () => setIncomingCall(null));
        });
        device.on("error", (error) => {
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
  }, [canCall]);

  useEffect(() => {
    if (!incomingCall) {
      stopRinging();
      return;
    }

    playRingTone();
    ringIntervalRef.current = window.setInterval(playRingTone, 2000);

    return stopRinging;
  }, [incomingCall]);

  function makeCall() {
    startTransition(async () => {
      setStatusMessage(null);
      const numberToCall = phoneNumberInputRef.current?.value.trim() || phoneNumber.trim();

      if (!numberToCall) {
        setStatusMessage("Enter a number before calling.");
        return;
      }

      if (!deviceRef.current || !deviceReady) {
        setStatusMessage("Phone is still connecting. Try again in a moment.");
        return;
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

      let call: Call;

      try {
        call = await deviceRef.current.connect({
          params: {
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
      call.on("disconnect", () => setActiveCall(null));
      call.on("cancel", () => setActiveCall(null));
      call.on("error", (error) => setStatusMessage(getPhoneErrorMessage(error)));
      call.on("reject", () => setActiveCall(null));
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
                  incomingCall.accept();
                  stopRinging();
                  setActiveCall(incomingCall);
                  setIncomingCall(null);
                }}
              >
                Answer
              </Button>
              <Button
                onClick={() => {
                  incomingCall.reject();
                  stopRinging();
                  setIncomingCall(null);
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
            <h2 className="text-base font-semibold">SCN Phone</h2>
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
                  setActiveCall(null);
                }}
                variant="danger"
              >
                <PhoneOff className="h-4 w-4" />
                Hang Up
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Browser calls require microphone permission in Chrome.
            </p>
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
                  <p className="font-semibold">{voicemail.from_number || "Unknown caller"}</p>
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
