"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-xl font-semibold">ПИН код</span>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          autoFocus
          className="field text-center text-3xl tracking-[0.4em]"
        />
      </label>
      {state.error && (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Проверявам…" : "Влез"}
      </button>
    </form>
  );
}
