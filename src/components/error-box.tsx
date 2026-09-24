export function ErrorBox({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Нещо се обърка.";
  return (
    <p role="alert" className="alert-error">
      {message}
    </p>
  );
}
