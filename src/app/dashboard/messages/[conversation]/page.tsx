import { redirect } from "next/navigation";

type ConversationRedirectPageProps = {
  params: Promise<{
    conversation: string;
  }>;
};

export default async function ConversationRedirectPage({ params }: ConversationRedirectPageProps) {
  const { conversation } = await params;
  redirect(`/dashboard/messages?chat=${encodeURIComponent(conversation)}`);
}
