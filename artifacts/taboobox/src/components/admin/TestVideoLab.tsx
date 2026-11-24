import { useState } from "react";
import { Check, CircleCheck, RotateCcw, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TestStatus = "review" | "approved" | "test-published";
type TestVideo = {
  id: string;
  title: string;
  description: string;
  duration: string;
  status: TestStatus;
};

const initialSamples: TestVideo[] = [
  {
    id: "sample-review",
    title: "Flower Meadow · Review",
    description: "A public-domain sample clip for checking the review and thumbnail experience.",
    duration: "0:06",
    status: "review",
  },
  {
    id: "sample-approved",
    title: "Flower Meadow · Approval",
    description: "Advance this isolated sample through the admin approval step.",
    duration: "0:06",
    status: "approved",
  },
  {
    id: "sample-published",
    title: "Flower Meadow · Test Publish",
    description: "A test-published state that is visible only in this admin browser session.",
    duration: "0:06",
    status: "test-published",
  },
];
const poster = "/test-archive/flower-poster.png";
const sampleVideo = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export function TestVideoLab() {
  const [samples, setSamples] = useState(initialSamples);
  const [selected, setSelected] = useState<TestVideo | null>(null);
  const updateStatus = (id: string, status: TestStatus) =>
    setSamples((current) =>
      current.map((sample) => (sample.id === id ? { ...sample, status } : sample)),
    );
  const resetSamples = () => setSamples(initialSamples);
  const label = (status: TestStatus) =>
    status === "review"
      ? "Needs review · test only"
      : status === "approved"
        ? "Approved · test only"
        : "Test-published · private";
  const actionLabel = (status: TestStatus) =>
    status === "review"
      ? "Approve for test"
      : status === "approved"
        ? "Publish in test archive"
        : "Reset to review";

  return (
    <section
      aria-labelledby="test-video-lab-title"
      className="panel flex flex-col gap-4 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="outline" className="mb-2 w-fit gap-1.5 uppercase tracking-wide">
            <ShieldCheck aria-hidden="true" className="size-3.5" /> Admin-only · sandbox
          </Badge>
          <h2 id="test-video-lab-title" className="font-display text-xl font-bold uppercase">
            Video workflow test lab
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Test thumbnails, details, playback, approval, and the publish-state transition using
            sample media. Nothing here is written to Supabase or the public archive.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={resetSamples}>
          <RotateCcw data-icon="inline-start" /> Reset tests
        </Button>
      </div>

      <Alert
        role="note"
        className="flex gap-2 bg-surface-2/60 text-muted-foreground [&>svg]:static [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-primary [&>svg~*]:pl-0"
      >
        <ShieldCheck aria-hidden="true" />
        <AlertDescription>
          <strong className="text-foreground">Preview-only data.</strong> These three rows exist
          only in component state. “Publish in test archive” changes a local badge and never calls
          the production publish function.
        </AlertDescription>
      </Alert>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {samples.map((sample) => (
          <li key={sample.id} className="overflow-hidden rounded-xl border bg-background">
            <button
              type="button"
              onClick={() => setSelected(sample)}
              aria-label={`Open details for ${sample.title}`}
              className="group block w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-video overflow-hidden bg-surface-2">
                <img
                  src={poster}
                  alt="Red flower in a sunlit meadow, sample video thumbnail"
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <span className="absolute bottom-2 end-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">
                  {sample.duration}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3">
                <h3 className="truncate text-sm font-semibold">{sample.title}</h3>
                <p className="line-clamp-2 min-h-10 text-xs text-muted-foreground">
                  {sample.description}
                </p>
                <Badge variant="outline" className="w-fit gap-1">
                  {sample.status === "test-published" ? (
                    <CircleCheck aria-hidden="true" />
                  ) : (
                    <Video aria-hidden="true" />
                  )}
                  {label(sample.status)}
                </Badge>
              </div>
            </button>
            <div className="flex flex-wrap gap-2 border-t p-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelected(sample)}
              >
                View details & playback
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sample.status === "test-published" ? "outline" : "default"}
                onClick={() =>
                  updateStatus(
                    sample.id,
                    sample.status === "review"
                      ? "approved"
                      : sample.status === "approved"
                        ? "test-published"
                        : "review",
                  )
                }
              >
                {sample.status === "review" ? (
                  <Check data-icon="inline-start" />
                ) : sample.status === "test-published" ? (
                  <RotateCcw data-icon="inline-start" />
                ) : (
                  <CircleCheck data-icon="inline-start" />
                )}
                {actionLabel(sample.status)}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.description} This sample is isolated from the live archive.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="flex flex-col gap-4">
              <video
                key={selected.id}
                controls
                playsInline
                preload="metadata"
                poster={poster}
                aria-label={`Playback preview: ${selected.title}`}
                className="aspect-video w-full rounded-lg bg-black"
              >
                <source src={sampleVideo} type="video/mp4" />
                Your browser does not support HTML video.
              </video>
              <dl className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Workflow state</dt>
                  <dd className="mt-1 font-medium">{label(selected.status)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Duration</dt>
                  <dd className="mt-1 font-medium">{selected.duration}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Storage</dt>
                  <dd className="mt-1 font-medium">Browser state only</dd>
                </div>
              </dl>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button
                  type="button"
                  variant={selected.status === "test-published" ? "outline" : "default"}
                  onClick={() => {
                    const nextStatus =
                      selected.status === "review"
                        ? "approved"
                        : selected.status === "approved"
                          ? "test-published"
                          : "review";
                    updateStatus(selected.id, nextStatus);
                    setSelected({ ...selected, status: nextStatus });
                  }}
                >
                  {actionLabel(selected.status)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
