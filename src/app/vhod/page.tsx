import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 p-5">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Гласов склад</h1>
        <p className="mt-3 text-xl">Въведете ПИН кода на магазина</p>
      </div>
      <LoginForm />
    </main>
  );
}
