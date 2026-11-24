import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Trash2, Sparkles, Loader2, RefreshCw, Skull, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  clearAssistantConversation,
  generateAssistantReply,
  getAssistantConversation,
  saveAssistantMessage,
  saveAssistantReply,
} from "@/lib/assistant.functions";

export function AssistantEmpty() {
  const { lang } = useI18n();
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-5 text-center lg:min-h-[600px]">
      <Skull aria-hidden="true" className="size-16 text-primary" />
      <h2 className="font-display text-xl font-bold uppercase">
        TABOOBOX {lang === "ar" ? "المساعد" : "Assistant"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {lang === "ar"
          ? "اختر محادثة أو أنشئ محادثة جديدة."
          : "Select a conversation or start a new chat."}
      </p>
      <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles aria-hidden="true" className="size-4 text-primary" />
        {lang === "ar"
          ? "تُنشأ الإجابات كمسودات قبل الحفظ"
          : "AI replies are generated as drafts before saving"}
      </span>
    </div>
  );
}

export function AssistantChat({ threadId }: { threadId: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { user } = useAuth();
  const input = useRef<HTMLTextAreaElement>(null);
  const lock = useRef(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const get = useServerFn(getAssistantConversation);
  const save = useServerFn(saveAssistantMessage);
  const generate = useServerFn(generateAssistantReply);
  const persistReply = useServerFn(saveAssistantReply);
  const clear = useServerFn(clearAssistantConversation);
  const client = useQueryClient();
  const queryKey = ["assistant-conversation", user?.id, threadId];
  const conversation = useQuery({
    queryKey,
    queryFn: () => get({ data: { threadId } }),
    enabled: user?.isAdmin === true,
  });
  const draftReply = drafts[threadId];
  const busy = Boolean(pending) || generating || savingDraft || clearing;
  useEffect(() => {
    input.current?.focus();
  }, [threadId, conversation.isSuccess]);

  async function send() {
    const value = text.trim();
    if (!value || lock.current || draftReply || !conversation.isSuccess) return;
    lock.current = true;
    setPending(value);
    setText("");
    setError("");
    setNotice("");
    input.current?.focus();
    let messageSaved = false;
    try {
      await save({ data: { threadId, text: value } });
      messageSaved = true;
      setPending("");
      setGenerating(true);
      await Promise.all([
        client.invalidateQueries({ queryKey }),
        client.invalidateQueries({ queryKey: ["assistant-threads"] }),
      ]);
      const result = await generate({ data: { threadId } });
      setDrafts((current) => ({ ...current, [threadId]: result.text }));
      setNotice(
        ar
          ? "تم إنشاء مسودة الرد. لم تُحفظ بعد."
          : "AI draft generated. It has not been saved yet.",
      );
    } catch {
      setError(
        messageSaved
          ? ar
            ? "تم حفظ رسالتك، لكن تعذر إنشاء مسودة رد. لم يُحفظ أي رد."
            : "Your message was saved, but an AI draft could not be generated. No reply was saved."
          : ar
            ? "لم يتم حفظ الرسالة. حاول مرة أخرى."
            : "Message was not saved. Please try again.",
      );
      if (!messageSaved) setText(value);
      await client.invalidateQueries({ queryKey });
    } finally {
      lock.current = false;
      setPending("");
      setGenerating(false);
      input.current?.focus();
    }
  }

  async function saveDraft() {
    if (!draftReply || lock.current) return;
    lock.current = true;
    setSavingDraft(true);
    setError("");
    setNotice("");
    try {
      await persistReply({ data: { threadId, text: draftReply } });
      await Promise.all([
        client.invalidateQueries({ queryKey }),
        client.invalidateQueries({ queryKey: ["assistant-threads"] }),
      ]);
      setDrafts((current) => {
        const next = { ...current };
        delete next[threadId];
        return next;
      });
      setNotice(
        ar ? "تم حفظ رد المساعد في هذه المحادثة." : "Assistant reply saved to this conversation.",
      );
    } catch {
      setError(
        ar
          ? "تعذر حفظ المسودة. بقي النص هنا ويمكنك المحاولة مجددًا."
          : "Draft could not be saved. It is still here, so you can retry.",
      );
    } finally {
      lock.current = false;
      setSavingDraft(false);
    }
  }

  function discardDraft() {
    setDrafts((current) => {
      const next = { ...current };
      delete next[threadId];
      return next;
    });
    setNotice(ar ? "تم تجاهل المسودة دون حفظها." : "Draft discarded without saving.");
  }

  async function clearConfirmed() {
    setClearing(true);
    setError("");
    try {
      await clear({ data: { threadId, confirmed: true } });
      await Promise.all([
        client.invalidateQueries({ queryKey }),
        client.invalidateQueries({ queryKey: ["assistant-threads"] }),
        client.invalidateQueries({ queryKey: ["assistant-activity"] }),
      ]);
      setNotice("");
      setConfirm(false);
    } catch {
      setError(ar ? "تعذر مسح المحادثة." : "Could not clear the conversation.");
      setConfirm(false);
    } finally {
      setClearing(false);
      input.current?.focus();
    }
  }

  return (
    <div
      className="flex h-[calc(100dvh-15rem)] min-h-[420px] min-w-0 flex-col md:h-[600px] lg:h-[660px]"
      aria-busy={busy}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3">
        <h2 dir="auto" className="min-w-0 truncate text-sm font-semibold">
          {conversation.data?.thread.title || (ar ? "المحادثة" : "Conversation")}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={ar ? "مسح المحادثة" : "Clear conversation"}
          title={ar ? "مسح المحادثة" : "Clear conversation"}
          disabled={!conversation.data?.messages.length || busy || Boolean(draftReply)}
          onClick={() => setConfirm(true)}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="flex shrink-0 gap-2 border-b bg-surface px-4 py-3 text-xs text-muted-foreground">
        <Sparkles aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <p>
          {ar
            ? "تُنشأ الإجابات عبر Vercel AI Gateway كمسودات. لا تُحفظ في سجل المحادثة حتى تضغط حفظ، ولا تُنفّذ إجراءات تلقائيًا."
            : "Replies are generated through Vercel AI Gateway as drafts. They are not added to chat history until you choose Save, and no actions run automatically."}
        </p>
      </div>
      <Conversation className="min-h-0">
        <ConversationContent className="gap-5 p-3 sm:p-4">
          {conversation.isPending && (
            <div className="flex justify-center p-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {conversation.isError && (
            <div role="alert" className="text-center text-sm text-destructive">
              {ar ? "تعذر تحميل هذه المحادثة." : "Could not load this conversation."}
              <Button variant="ghost" size="sm" onClick={() => conversation.refetch()}>
                <RefreshCw />
                {ar ? "إعادة المحاولة" : "Retry"}
              </Button>
            </div>
          )}
          {conversation.isSuccess && !conversation.data.messages.length && !pending && (
            <ConversationEmptyState title="" description="">
              <Skull aria-hidden="true" className="size-12 text-primary" />
              <h3 className="font-display text-lg uppercase">
                {ar ? "محادثة جديدة" : "New conversation"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "أرسل رسالة لإنشاء مسودة رد غير محفوظة."
                  : "Send a message to generate an unsaved AI reply draft."}
              </p>
            </ConversationEmptyState>
          )}
          {conversation.data?.messages.map((message) => (
            <Message key={message.id} from={message.role === "assistant" ? "assistant" : "user"}>
              <MessageContent className="group-[.is-user]:bg-secondary group-[.is-user]:text-secondary-foreground">
                <div
                  dir="auto"
                  className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                >
                  {message.parts.map((part, index) =>
                    message.role === "assistant" ? (
                      <MessageResponse key={index}>{part.text}</MessageResponse>
                    ) : (
                      <span key={index}>{part.text}</span>
                    ),
                  )}
                </div>
              </MessageContent>
              <time
                dateTime={message.created_at}
                className="text-end text-[11px] text-muted-foreground"
              >
                {new Date(message.created_at).toLocaleString(ar ? "ar" : "en", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </Message>
          ))}
          {pending && (
            <>
              <Message from="user">
                <MessageContent>
                  <p
                    dir="auto"
                    className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                  >
                    {pending}
                  </p>
                </MessageContent>
              </Message>
              <div role="status" className="text-sm text-muted-foreground">
                <Shimmer>{ar ? "جارٍ حفظ الرسالة…" : "Saving message…"}</Shimmer>
              </div>
            </>
          )}
          {generating && (
            <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles aria-hidden="true" className="size-4 text-primary" />
              <Shimmer>{ar ? "جارٍ إنشاء مسودة الرد…" : "Generating an AI reply draft…"}</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label={ar ? "آخر رسالة" : "Latest message"} />
      </Conversation>

      {draftReply && (
        <section
          aria-labelledby="assistant-draft-title"
          className="shrink-0 space-y-3 border-t bg-surface p-3 sm:px-4"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id="assistant-draft-title"
              className="flex items-center gap-2 text-xs font-semibold"
            >
              <Sparkles aria-hidden="true" className="size-4 text-primary" />
              {ar
                ? "مسودة ردّ مُنشأة بالذكاء الاصطناعي · غير محفوظة"
                : "AI-generated reply draft · not saved"}
            </h3>
            <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
              {ar ? "لن تظهر في السجل بعد" : "Not in conversation history yet"}
            </span>
          </div>
          <div
            dir="auto"
            className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-background p-3 text-sm [overflow-wrap:anywhere]"
          >
            <MessageResponse>{draftReply}</MessageResponse>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={savingDraft}
              onClick={discardDraft}
            >
              <X className="size-4" />
              {ar ? "تجاهل" : "Discard"}
            </Button>
            <Button type="button" size="sm" disabled={savingDraft} onClick={() => void saveDraft()}>
              {savingDraft ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {ar ? "حفظ الرد" : "Save reply"}
            </Button>
          </div>
        </section>
      )}

      <div className="shrink-0 border-t bg-background p-2 sm:p-3">
        {error && (
          <p role="alert" className="mb-2 text-xs text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-2 text-xs text-muted-foreground">
            {notice}
          </p>
        )}
        <PromptInput onSubmit={send}>
          <PromptInputTextarea
            ref={input}
            dir="auto"
            aria-label={ar ? "الرسالة" : "Message"}
            placeholder={ar ? "اكتب رسالتك…" : "Write a message…"}
            value={text}
            maxLength={20000}
            onChange={(event) => setText(event.target.value)}
            disabled={!conversation.isSuccess || busy || Boolean(draftReply)}
            className="min-h-14 max-h-32 sm:min-h-20 sm:max-h-40"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              status={busy ? "submitted" : "ready"}
              disabled={!text.trim() || busy || Boolean(draftReply) || !conversation.isSuccess}
              aria-label={ar ? "إرسال الرسالة" : "Send message"}
              title={ar ? "إرسال الرسالة" : "Send message"}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </div>
      <AlertDialog
        open={confirm}
        onOpenChange={(open) => {
          if (!clearing) setConfirm(open);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "مسح هذه المحادثة؟" : "Clear this conversation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "سيتم حذف جميع رسائل هذه المحادثة نهائيًا وتسجيل العملية في سجل النشاط."
                : "All messages in this conversation will be permanently removed. This action will be recorded in activity history."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearing}
              onClick={(event) => {
                event.preventDefault();
                void clearConfirmed();
              }}
            >
              {clearing ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}
              {ar ? "مسح المحادثة" : "Clear conversation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
