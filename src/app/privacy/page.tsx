import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

// ログインしていなくても見られるページ（middleware の isPublicPath で許可）。
// 運営者名・連絡先・制定日は .env で設定する（サーバー起動時の値を使うため、リクエストごとに描画）。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "プライバシーポリシー | TeamNotes",
};

export default function PrivacyPage() {
  const operator = process.env.PRIVACY_OPERATOR_NAME?.trim() || "本サービスの運営者";
  const contact = process.env.PRIVACY_CONTACT_EMAIL?.trim();
  const effectiveDate = process.env.PRIVACY_EFFECTIVE_DATE?.trim();

  return (
    <main className="min-h-full bg-sidebar px-4 py-12">
      <article className="mx-auto max-w-2xl rounded-xl bg-white p-8 text-[15px] leading-relaxed shadow-sm ring-1 ring-black/5 sm:p-12">
        <header className="mb-8">
          <Link href={ROUTES.login} className="text-sm text-muted hover:underline">
            ← TeamNotes に戻る
          </Link>
          <h1 className="mt-4 text-3xl font-bold">プライバシーポリシー</h1>
          <p className="mt-3 text-muted">
            {operator}（以下「運営者」）は、チーム向けワークスペース「TeamNotes」（以下「本サービス」）における利用者の情報の取り扱いについて、以下のとおり定めます。
          </p>
        </header>

        <Section title="1. 取得する情報">
          <p>本サービスは、次の情報を取得します。</p>
          <h3 className="mt-4 font-medium">Google アカウントから取得する情報</h3>
          <p className="mt-1">
            「Googleでログイン」を利用した際に、Google から次の情報を受け取ります。これ以外の情報（Gmail、Google ドライブ、連絡先など）にはアクセスしません。
          </p>
          <ul>
            <li>氏名（Google アカウントに登録された表示名）</li>
            <li>メールアドレス</li>
            <li>プロフィール画像の URL</li>
            <li>Google アカウントを識別するための ID</li>
          </ul>
          <h3 className="mt-4 font-medium">本サービスの利用に伴って記録される情報</h3>
          <ul>
            <li>利用者が作成・編集したページ、データベース、その他のコンテンツ</li>
            <li>コンテンツの作成者・最終更新者と、その日時</li>
            <li>お気に入りの設定</li>
            <li>参加申請・承認の状態、権限、最終ログイン日時</li>
          </ul>
        </Section>

        <Section title="2. 利用目的">
          <ul>
            <li>利用者の本人確認とログイン状態の維持</li>
            <li>参加申請の受付と、管理者による承認・利用停止などのメンバー管理</li>
            <li>ページの作成者・更新者の表示、担当者の設定など、本サービスの機能の提供</li>
            <li>不正利用の防止と、障害発生時の調査・対応</li>
          </ul>
          <p>取得した情報を、上記以外の目的（広告配信など）に利用することはありません。</p>
        </Section>

        <Section title="3. 第三者への提供">
          <p>運営者は、次の場合を除き、利用者の情報を第三者に提供しません。</p>
          <ul>
            <li>利用者本人の同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>人の生命、身体または財産の保護のために必要で、本人の同意を得ることが困難な場合</li>
          </ul>
          <p>
            なお、本サービスのコンテンツや利用者の氏名・メールアドレス・プロフィール画像は、本サービスで承認された同じワークスペースのメンバー間で共有されます。
          </p>
        </Section>

        <Section title="4. Google ユーザーデータの取り扱い">
          <p>
            Google API から受け取った情報の利用および他のアプリへの転送は、
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Google API サービスのユーザーデータに関するポリシー
            </a>
            （限定的使用の要件を含む）に従います。Google から受け取った情報を販売したり、広告に利用したりすることはありません。
          </p>
        </Section>

        <Section title="5. Cookie の利用">
          <p>本サービスは、次の目的でのみ Cookie を使用します。広告や行動分析のための Cookie は使用しません。</p>
          <ul>
            <li>ログイン状態の維持（有効期間 30 日）</li>
            <li>Google ログイン処理中の一時的な安全確認（有効期間 10 分）</li>
          </ul>
        </Section>

        <Section title="6. 情報の保管と安全管理">
          <ul>
            <li>情報は、運営者が管理するサーバー上に保管します。</li>
            <li>通信は HTTPS により暗号化します。</li>
            <li>本サービスは利用者のパスワードを保管しません（認証は Google が行います）。</li>
            <li>障害に備え、データのバックアップを取得し、一定期間保管します。</li>
          </ul>
        </Section>

        <Section title="7. 保存期間と削除">
          <p>
            取得した情報は、利用者が本サービスを利用している間、および利用停止後に運営者が必要と判断する期間、保管します。利用者は、運営者に連絡することで、自身のアカウント情報の削除を求めることができます。ただし、他のメンバーと共有しているコンテンツについては、ワークスペースの運営上必要な範囲で保持する場合があります。
          </p>
        </Section>

        <Section title="8. 開示・訂正・削除などのお問い合わせ">
          <p>
            自身の情報の開示、訂正、利用停止、削除などを希望する場合、または本ポリシーに関するお問い合わせは、次の連絡先までご連絡ください。
          </p>
          <p className="mt-2 rounded-lg bg-sidebar px-4 py-3">
            {operator}
            <br />
            {contact ? (
              <a href={`mailto:${contact}`} className="text-accent hover:underline">
                {contact}
              </a>
            ) : (
              <span className="text-muted">連絡先：本サービスの管理者</span>
            )}
          </p>
        </Section>

        <Section title="9. 本ポリシーの変更">
          <p>
            運営者は、必要に応じて本ポリシーを変更することがあります。重要な変更を行う場合は、本サービス上でお知らせします。
          </p>
        </Section>

        {effectiveDate && <p className="mt-10 text-right text-sm text-muted">制定日：{effectiveDate}</p>}
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 [&_li]:mt-1 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
      <h2 className="border-b border-line pb-1 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
