"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";

import { postComment } from "@/app/actions/comments";
import { HighlightPin } from "@/components/HighlightPin";
import { tryCreateClient } from "@/lib/supabase/client";
import type { CommentWithAuthor, HighlightPinRow } from "@/types/thread";

type CommentThreadProps = {
  threadId: string;
  initialComments: CommentWithAuthor[];
  initialPins: HighlightPinRow[];
  /** From `hasClerkConfigured()` in the server page — avoids Clerk hooks when auth env is missing. */
  clerkEnabled: boolean;
};

type RealtimeCommentPayload = {
  id: string;
  thread_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  upvotes: number;
  tag: string | null;
  created_at: string;
};

function formatCommentTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function CommentInput({
  threadId,
  onPosted,
  clerkEnabled,
}: {
  threadId: string;
  onPosted: () => void;
  clerkEnabled: boolean;
}) {
  const [hasSupabase, setHasSupabase] = useState(false);

  useEffect(() => {
    setHasSupabase(!!tryCreateClient());
  }, []);

  if (!clerkEnabled) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-400">
        Comments need Clerk: add <code className="text-zinc-300">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
        <code className="text-zinc-300">CLERK_SECRET_KEY</code> to <code className="text-zinc-300">.env.local</code>, plus{" "}
        <code className="text-zinc-300">SUPABASE_SERVICE_ROLE_KEY</code> for posting. Restart the dev server after saving.
      </p>
    );
  }

  return <CommentInputWithClerk threadId={threadId} onPosted={onPosted} hasSupabase={hasSupabase} />;
}

function CommentInputWithClerk({
  threadId,
  onPosted,
  hasSupabase,
}: {
  threadId: string;
  onPosted: () => void;
  hasSupabase: boolean;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const { userId, isLoaded } = useAuth();

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setPostError(null);
    setSending(true);
    try {
      const result = await postComment({ threadId, body: trimmed });
      if (!result.ok) {
        setPostError(result.error);
        return;
      }
      setBody("");
      onPosted();
    } finally {
      setSending(false);
    }
  };

  if (!hasSupabase) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-500">
        Configure Supabase to post comments.
      </p>
    );
  }

  if (!isLoaded) {
    return <div className="h-24 animate-pulse rounded-lg bg-zinc-900/60" />;
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      {!userId ? (
        <p className="mb-3 text-xs text-zinc-500">
          You must be signed in to post. Submitting redirects you to sign in if you are not signed in yet.
        </p>
      ) : null}
      <label htmlFor="comment-input" className="sr-only">
        New comment
      </label>
      <textarea
        id="comment-input"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a comment…"
        className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      {postError ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {postError}
        </p>
      ) : null}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={sending || !body.trim()}
          onClick={() => void submit()}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition enabled:hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "Posting…" : "Post comment"}
        </button>
      </div>
    </div>
  );
}

function TagBadge({ tag }: { tag: string }) {
  const isHighlight = tag.toLowerCase() === "highlight";
  return (
    <span
      className={
        isHighlight
          ? "rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-200 ring-1 ring-amber-500/40"
          : "rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-300 ring-1 ring-zinc-600"
      }
    >
      {tag}
    </span>
  );
}

function CommentItem({
  comment,
  repliesByParent,
  depth,
}: {
  comment: CommentWithAuthor;
  repliesByParent: Map<string, CommentWithAuthor[]>;
  depth: number;
}) {
  const replies = repliesByParent.get(comment.id) ?? [];

  return (
    <li
      id={`comment-${comment.id}`}
      className="scroll-mt-24 rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-3"
      style={{ marginLeft: depth === 0 ? 0 : Math.min(depth * 12, 48) }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-zinc-200">{comment.username}</span>
        <span className="text-xs text-zinc-500">{formatCommentTime(comment.created_at)}</span>
        {comment.tag ? <TagBadge tag={comment.tag} /> : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{comment.body}</p>
      <p className="mt-2 text-xs text-zinc-500">
        <span className="tabular-nums">{comment.upvotes}</span> upvotes
      </p>
      {replies.length > 0 ? (
        <ul className="mt-3 space-y-3 border-l border-zinc-800 pl-3">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              repliesByParent={repliesByParent}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

async function fetchUsernameMap(
  supabase: NonNullable<ReturnType<typeof tryCreateClient>>,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const { data } = await supabase.from("users").select("id, username").in("id", userIds);
  for (const row of data ?? []) {
    map.set(row.id, row.username);
  }
  return map;
}

function mergeHighlightStrip(
  pins: HighlightPinRow[],
  comments: CommentWithAuthor[],
): { key: string; title: string; timestampLabel: string; commentId: string }[] {
  const pinnedCommentIds = new Set(pins.map((p) => p.comment_id));
  const fromPins = pins.map((p) => ({
    key: `pin-${p.id}`,
    title: p.title?.trim() || "Highlight",
    timestampLabel: p.timestamp_label?.trim() || "—",
    commentId: p.comment_id,
  }));

  const fromComments = comments
    .filter((c) => (c.tag ?? "").toLowerCase() === "highlight" && !pinnedCommentIds.has(c.id))
    .map((c) => ({
      key: `tag-${c.id}`,
      title: c.body.length > 48 ? `${c.body.slice(0, 45)}…` : c.body,
      timestampLabel: formatCommentTime(c.created_at),
      commentId: c.id,
    }));

  return [...fromPins, ...fromComments];
}

export function CommentThread({
  threadId,
  initialComments,
  initialPins,
  clerkEnabled,
}: CommentThreadProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>(initialComments);
  const [pins, setPins] = useState<HighlightPinRow[]>(initialPins);

  const reload = useCallback(async () => {
    const supabase = tryCreateClient();
    if (!supabase) return;
    const { data: rows } = await supabase
      .from("comments")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    const list = rows ?? [];
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    const nameMap = await fetchUsernameMap(supabase, userIds);
    const merged: CommentWithAuthor[] = list.map((r) => ({
      ...r,
      username: nameMap.get(r.user_id) ?? "User",
    }));
    setComments(merged);

    const { data: pinRows } = await supabase
      .from("highlight_pins")
      .select("id, thread_id, comment_id, title, timestamp_label")
      .eq("thread_id", threadId);

    setPins(pinRows ?? []);
  }, [threadId]);

  useEffect(() => {
    setComments(initialComments);
    setPins(initialPins);
  }, [initialComments, initialPins]);

  useEffect(() => {
    const supabase = tryCreateClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`thread-comments-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const row = payload.new as RealtimeCommentPayload;
          const nameMap = await fetchUsernameMap(supabase, [row.user_id]);
          const username = nameMap.get(row.user_id) ?? "User";
          const next: CommentWithAuthor = { ...row, username };
          setComments((prev) => {
            if (prev.some((c) => c.id === next.id)) return prev;
            return [...prev, next].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            );
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "highlight_pins",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as HighlightPinRow;
          setPins((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId]);

  const repliesByParent = useMemo(() => {
    const map = new Map<string, CommentWithAuthor[]>();
    for (const c of comments) {
      const pid = c.parent_id;
      if (!pid) continue;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(c);
    }
    Array.from(map.values()).forEach((list) => {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    return map;
  }, [comments]);

  const roots = useMemo(
    () =>
      comments
        .filter((c) => !c.parent_id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [comments],
  );

  const stripItems = useMemo(
    () => mergeHighlightStrip(pins, comments),
    [pins, comments],
  );

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      {stripItems.length > 0 ? (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Highlights
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {stripItems.map((item) => (
              <HighlightPin
                key={item.key}
                title={item.title}
                timestampLabel={item.timestampLabel}
                commentId={item.commentId}
              />
            ))}
          </div>
        </div>
      ) : null}

      <h2 className="mb-4 text-lg font-semibold text-white">Discussion</h2>

      <CommentInput threadId={threadId} onPosted={() => void reload()} clerkEnabled={clerkEnabled} />

      <ul className="mt-8 space-y-4">
        {roots.length === 0 ? (
          <li className="rounded-lg border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
            No comments yet. Be the first to post.
          </li>
        ) : (
          roots.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              repliesByParent={repliesByParent}
              depth={0}
            />
          ))
        )}
      </ul>
    </section>
  );
}
