import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-5 text-center">
      <h1 className="text-3xl font-bold">Няма такава страница</h1>
      <p className="text-xl">Може продуктът да е изтрит.</p>
      <Link href="/" className="btn btn-primary">
        Към наличностите
      </Link>
    </main>
  );
}
