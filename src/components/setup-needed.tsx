export function SetupNeeded({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 p-5">
      <h1 className="text-3xl font-bold">Приложението още не е настроено</h1>
      <p className="text-xl">Липсват следните настройки:</p>
      <ul className="card flex flex-col gap-2 font-mono text-xl">
        {missing.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p className="text-xl">
        Добавете ги във Vercel → проекта → Settings → Environment Variables и направете
        Redeploy. Подробно обяснение има във файла README.md.
      </p>
    </main>
  );
}
