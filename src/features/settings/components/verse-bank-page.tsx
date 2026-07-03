"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { BIBLE_BOOKS, type BibleBook } from "@/features/bible/structure";
import { verseKey } from "@/features/bible/lookup";
import { bankClient } from "@/features/bible/bank-client";
import { settingsApi } from "../api";
import { LineEditor } from "@/features/notes/components/line-editor";

// Browse the whole Bible (Recovery Version structure) and fill in your own
// verse text: Testament -> book -> chapter -> per-verse editors. Every slot
// exists up front; verses you've typed in any note appear here automatically.

type View = { book: BibleBook | null; chapter: number | null };

type Props = { onBankEdit: (key: string, text: string) => void };

export function VerseBankPage({ onBankEdit }: Props) {
  const [view, setView] = useState<View>({ book: null, chapter: null });
  // bump to recompute filled counts after edits
  const [tick, setTick] = useState(0);

  // filled-verse counts per book and per chapter of the open book
  const counts = useMemo(() => {
    void tick;
    const perBook = new Map<string, number>();
    const perChapter = new Map<number, number>();
    for (const key of Object.keys(bankClient.all())) {
      const [bookId, ch] = key.split(":");
      perBook.set(bookId, (perBook.get(bookId) ?? 0) + 1);
      if (view.book && bookId === view.book.id)
        perChapter.set(Number(ch), (perChapter.get(Number(ch)) ?? 0) + 1);
    }
    return { perBook, perChapter };
  }, [tick, view.book]);

  // debounced bulk save of edited verses
  const pending = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = (key: string, text: string) => {
    bankClient.setByKey(key, text);
    onBankEdit(key, text);
    pending.current[key] = text;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const updates = pending.current;
      pending.current = {};
      settingsApi.saveBank(updates);
      setTick((t) => t + 1);
    }, 600);
  };

  return (
    <div className="flex h-full flex-col">
      <Breadcrumb view={view} onNavigate={setView} />
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {!view.book && <BookGrid perBook={counts.perBook} onOpen={(book) => setView({ book, chapter: null })} />}
        {view.book && view.chapter === null && (
          <ChapterGrid
            book={view.book}
            perChapter={counts.perChapter}
            onOpen={(chapter) => setView({ book: view.book, chapter })}
          />
        )}
        {view.book && view.chapter !== null && (
          <VerseList book={view.book} chapter={view.chapter} onEdit={queueSave} />
        )}
      </div>
    </div>
  );
}

function Breadcrumb({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const crumb = (label: string, target: View | null) =>
    target ? (
      <button
        onClick={() => onNavigate(target)}
        className="text-[var(--link)] hover:underline"
      >
        {label}
      </button>
    ) : (
      <span className="font-semibold text-[var(--text)]">{label}</span>
    );

  return (
    <div className="flex items-center gap-1.5 px-6 py-4 text-sm">
      {crumb("Verse Bank", view.book ? { book: null, chapter: null } : null)}
      {view.book && (
        <>
          <span className="text-[var(--faint)]">/</span>
          {crumb(view.book.name, view.chapter !== null ? { book: view.book, chapter: null } : null)}
        </>
      )}
      {view.book && view.chapter !== null && (
        <>
          <span className="text-[var(--faint)]">/</span>
          {crumb(`Chapter ${view.chapter}`, null)}
        </>
      )}
    </div>
  );
}

function BookGrid({
  perBook,
  onOpen,
}: {
  perBook: Map<string, number>;
  onOpen: (book: BibleBook) => void;
}) {
  const section = (title: string, testament: "OT" | "NT") => (
    <div className="mb-6">
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        {title}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {BIBLE_BOOKS.filter((b) => b.testament === testament).map((book) => {
          const filled = perBook.get(book.id) ?? 0;
          return (
            <button
              key={book.id}
              onClick={() => onOpen(book)}
              className="btn-light flex items-center justify-between gap-1 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[var(--text)]"
            >
              <span className="truncate">{book.name}</span>
              {filled > 0 && (
                <span className="shrink-0 rounded-full bg-[var(--ink)] px-1.5 py-px text-[10px] font-medium text-white">
                  {filled}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {section("Old Testament", "OT")}
      {section("New Testament", "NT")}
    </>
  );
}

function ChapterGrid({
  book,
  perChapter,
  onOpen,
}: {
  book: BibleBook;
  perChapter: Map<number, number>;
  onOpen: (chapter: number) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {book.chapters.map((verseCount, i) => {
        const ch = i + 1;
        const filled = perChapter.get(ch) ?? 0;
        return (
          <button
            key={ch}
            onClick={() => onOpen(ch)}
            className={clsx(
              "btn-light rounded-lg px-2 py-2 text-center",
              filled === verseCount && "!bg-[var(--ink)] !text-white",
            )}
            title={`${filled}/${verseCount} verses filled`}
          >
            <div className="text-sm font-semibold tabular-nums">{ch}</div>
            <div className={clsx("text-[10px] tabular-nums", filled === verseCount ? "text-white/70" : "text-[var(--faint)]")}>
              {filled}/{verseCount}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function VerseList({
  book,
  chapter,
  onEdit,
}: {
  book: BibleBook;
  chapter: number;
  onEdit: (key: string, text: string) => void;
}) {
  const verseCount = book.chapters[chapter - 1] ?? 0;
  return (
    <div>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--faint)]">
        {book.abbrev} {chapter} — {verseCount} verses
      </div>
      {Array.from({ length: verseCount }, (_, i) => {
        const v = i + 1;
        const key = verseKey(book.id, chapter, v);
        return (
          <div key={key} className="flex items-start gap-2 py-0.5">
            <span className="w-7 shrink-0 select-none pt-0.5 text-right text-[11px] font-medium tabular-nums text-[var(--faint)]">
              {v}
            </span>
            <LineEditor value={bankClient.getByKey(key)} onChange={(html) => onEdit(key, html)} />
          </div>
        );
      })}
    </div>
  );
}
