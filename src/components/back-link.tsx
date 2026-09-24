import Link from "next/link";

export function BackLink() {
  return (
    <Link href="/" className="inline-flex min-h-14 items-center text-2xl font-semibold text-primary">
      ← Назад
    </Link>
  );
}
