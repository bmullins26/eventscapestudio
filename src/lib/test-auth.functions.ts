import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Input = z.object({
  pin: z.string().min(1),
});

function isEnabled(value: string | undefined) {
  return value === "1" || value === "true" || value === "yes";
}

export const testPinLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const enabled = isEnabled(process.env.TEST_PIN_LOGIN_ENABLED);
    if (!enabled) {
      throw new Error("Test PIN login is disabled");
    }

    const expectedPin = process.env.TEST_PIN_LOGIN_PIN;
    const email = process.env.TEST_PIN_LOGIN_EMAIL;
    const password = process.env.TEST_PIN_LOGIN_PASSWORD;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!expectedPin || !email || !password) {
      throw new Error("Test PIN login is not configured");
    }
    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error("Supabase environment is missing");
    }
    if (data.pin.trim() !== expectedPin.trim()) {
      throw new Error("Invalid PIN");
    }

    const supabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !signInData.session) {
      throw new Error(error?.message ?? "Test PIN login failed");
    }

    return {
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
    };
  });
