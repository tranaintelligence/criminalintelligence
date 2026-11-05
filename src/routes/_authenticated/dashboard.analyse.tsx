import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { analyseSituation, type Analysis } from "@/lib/analyse.functions";

export const Route = createFileRoute("/_authenticated/dashboard/analyse")({
  head: () => ({
    meta: [
      { title: "Citizens Dashboard — TRANA" },
      { name: "description", content: "Describe what happened or upload the FIR/complaint and understand your rights and next steps." },
      { property: "og:title", content: "Citizens Dashboard — TRANA" },
      { property: "og:description", content: "Let us understand your situation in plain language." },
    ],
  }),
  component: Analyse,
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card p-7">
      <h3 className="font-display text-2xl">{title}</h3>
      <div className="mt-4 text-sm leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

function Analyse() {
  const run = useServerFn(analyseSituation);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setErr("Please upload a file under 5 MB.");
    setErr(null); setFile(f);
  }

  async function submit() {
    setBusy(true); setErr(null); setResult(null);
    try {
      const payload = file
        ? { name: file.name, type: file.type, dataUrl: await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); }) }
        : null;
      const out = await run({ data: { situation: text, file: payload } });
      setResult(out.result);
      qc.invalidateQueries({ queryKey: ["activity"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="bg-paper p-8 text-ink md:p-10 border border-paper-border">
        <span className="inline-block border border-ink px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em]">
          AI-Assisted · In Development
        </span>
        <h1 className="mt-4 font-display text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.15] text-balance">
          Let Us Understand Your Situation
        </h1>
        <p className="mt-3.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Describe what happened or upload the FIR/complaint. TRANA will help you understand it and connect you to a lawyer if needed.
        </p>
      </div>

      <div className="mt-8 border border-foreground/80 bg-card p-7">
        <label htmlFor="situation" className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Describe your legal situation</label>
        <textarea
          id="situation"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Example: My brother was arrested last night. The police mentioned Section 420. I don't know what this means or what to do..."
          className="mt-3 w-full resize-y border border-border bg-background p-4 text-sm placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <p className="mt-6 text-sm text-muted-foreground">Or upload a document (FIR, notice, summons)</p>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
          className={`mt-3 flex cursor-pointer flex-col items-center justify-center border border-dashed p-8 text-center text-sm transition-colors ${drag ? "border-foreground" : "border-border"}`}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          {file ? (
            <span className="mt-3 flex items-center gap-2">{file.name}
              <button aria-label="Remove file" onClick={(e) => { e.stopPropagation(); setFile(null); }}><X className="h-4 w-4" /></button>
            </span>
          ) : (
            <span className="mt-3 text-muted-foreground">Drag and drop, or click to choose PDF or photo, up to 5 MB</span>
          )}
          <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
        <button onClick={submit} disabled={busy || (!text.trim() && !file)} className="btn-solid mt-6 disabled:opacity-40">
          {busy ? "Analysing…" : "Analyse Now"}
        </button>
        {busy && <p className="mt-3 text-xs text-muted-foreground">This can take up to a minute.</p>}
      </div>

      {result && (
        <div className="mt-10 space-y-5">
          <Card title="What This Means">
            {result.meaning.split(/\n+/).map((p, i) => <p key={i} className="mb-3">{p}</p>)}
            {result.sections.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Sections identified</p>
                <ul className="space-y-2">
                  {result.sections.map((s, i) => <li key={i}><span className="font-medium">{s.code}</span> {s.explanation}</li>)}
                </ul>
              </div>
            )}
          </Card>
          <Card title="Your Rights">
            <ul className="list-disc space-y-2 pl-5">{result.rights.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </Card>
          {result.is_criminal && (
            <Card title="Bail Information">
              <p className="mb-3"><span className="uppercase tracking-[0.15em] text-muted-foreground">Status: </span>{result.bail.status}</p>
              <p>{result.bail.summary}</p>
              {result.bail.steps.length > 0 && <ul className="mt-3 list-disc space-y-2 pl-5">{result.bail.steps.map((s, i) => <li key={i}>{s}</li>)}</ul>}
            </Card>
          )}
          <Card title="Next Steps">
            <ol className="list-decimal space-y-2 pl-5">{result.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </Card>
          <div className="bg-primary p-8 text-primary-foreground md:p-10">
            <h3 className="font-display text-3xl">Speak to a Lawyer About This</h3>
            <p className="mt-3 max-w-2xl text-sm opacity-80">TRANA has given you information but a qualified lawyer can give you advice specific to your case.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/dashboard/lawyers" className="btn-ink">Find a Lawyer Now</Link>
              <Link to="/dashboard/lawyers" className="inline-flex items-center border border-primary-foreground px-7 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.14em] hover:bg-primary-foreground hover:text-primary">Schedule a Consultation</Link>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This analysis is generated by AI for informational purposes only. It is not legal advice. Always consult a qualified lawyer before taking any legal action.
          </p>
        </div>
      )}
    </div>
  );
}
