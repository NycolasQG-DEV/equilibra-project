import Link from "next/link";
export default function Page() {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Conversa sobre o trabalho</h1>
      <p>
        Abra o link da campanha enviado pela organização para participar da
        conversa guiada. Esse convite apresenta o aviso de privacidade e
        registra suas escolhas.
      </p>
      <p>
        Para acolhimento ou apuração de uma situação individual, procure um
        canal reservado da organização.
      </p>
      <Link href="/colaborador" className="text-purple-700 underline">
        Acessar participação
      </Link>
    </main>
  );
}
