"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { createServiceClient } from "@/lib/supabase/admin";

export type PostCommentResult = { ok: true } | { ok: false; error: string };

/**
 * Inserts a root comment. Requires Clerk sign-in; otherwise redirects to `/sign-in`.
 * Uses the service role after Clerk verification so RLS does not depend on Supabase Auth.
 */
export async function postComment(input: {
  threadId: string;
  body: string;
}): Promise<PostCommentResult> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const trimmed = input.body.trim();
  if (!trimmed) {
    return { ok: false, error: "Comment cannot be empty." };
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Server is missing Supabase service configuration.",
    };
  }

  const user = await currentUser();
  const username =
    user?.username ??
    user?.firstName ??
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ??
    "User";
  const avatarUrl = user?.imageUrl ?? null;

  const { error: upsertUserErr } = await supabase.from("users").upsert(
    {
      id: userId,
      username: username.slice(0, 80),
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (upsertUserErr) {
    return { ok: false, error: upsertUserErr.message };
  }

  const { error } = await supabase.from("comments").insert({
    thread_id: input.threadId,
    user_id: userId,
    parent_id: null,
    body: trimmed,
    tag: null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
