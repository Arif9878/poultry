import type { Profile } from "../types/models";
import { assertSupabaseConfigured, supabase } from "../lib/supabase";
import { withCache } from "./localCache.service";

export async function getProfileById(userId: string) {
  assertSupabaseConfigured();

  return withCache(`profile:${userId}`, async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Profil pengguna tidak ditemukan");
    }

    return data as Profile;
  });
}
